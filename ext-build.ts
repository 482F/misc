#!/usr/bin/env -S deno run --watch -A

// deno run -A  --unstable-detect-cjs https://raw.githubusercontent.com/482F/misc/refs/heads/master/ext-build.ts

// TODO: 引数によるポートの変更
import * as path from 'jsr:@std/path'
import * as esbuild from 'npm:esbuild@0.25.3'
import Vue from 'npm:unplugin-vue@6.1.0/esbuild'
import { createUnplugin } from 'npm:unplugin@2.3.2'
import { debounce } from 'jsr:@es-toolkit/es-toolkit@1.35.0'

import { Hono } from 'jsr:@hono/hono'
import { upgradeWebSocket } from 'jsr:@hono/hono/deno'
import type { WSContext } from 'jsr:@hono/hono/ws'

const manifestPath = './src/manifest.json'
const port = 18759
const reloadAll = await reloader()

async function reloader() {
  const wss = new Map<WSContext<WebSocket>, string>()
  let latestBuildId: string = ''
  function reload(ws: WSContext<WebSocket>) {
    if (wss.get(ws) === latestBuildId) {
      return
    }
    ws.send('reload')
  }
  function reloadAll(newBuildId: string) {
    latestBuildId = newBuildId
    wss.keys().forEach(reload)
  }

  const app = new Hono()
  app.get(
    '/ws',
    upgradeWebSocket(() => {
      return {
        onMessage(event, ws) {
          const buildId: string = JSON.parse(event.data.toString()).buildId
          wss.set(ws, buildId)
          reload(ws)
        },
        onError(_, ws) {
          wss.delete(ws)
        },
        onClose(_, ws) {
          wss.delete(ws)
        },
      }
    }),
  )

  setInterval(() => {
    wss.keys().forEach((ws) => ws.send('keepalive'))
  }, 1000 * 10)

  while (true) {
    try {
      Deno.serve({ port }, app.fetch)
      break
    } catch (_) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }
  return reloadAll
}

async function build() {
  const manifest: {
    action?: {
      default_popup?: string
    }
    background?: {
      service_worker?: string
      type?: string
    }
    content_scripts?: {
      js?: string[]
    }[]
    web_accessible_resources?: {
      resources?: string[]
    }[]
    options_page?: string
  } = await Deno
    .readTextFile(manifestPath)
    .then((t) => JSON.parse(t))

  const originalBackground = manifest.background?.service_worker
  manifest.background ??= {}
  manifest.background.service_worker ??= 'bg.ts'
  manifest.background.service_worker =
    manifest.background.service_worker.replace(/\.[^\/]+$/, '') + '.ws.ts'
  manifest.background.type ??= 'module'
  const scripts = [
    ...(manifest.content_scripts?.flatMap(({ js }) => js) ??
      []),
    ...(manifest.web_accessible_resources?.flatMap(({ resources }) =>
      resources
    ) ?? []).filter((path) => path?.match(/\.(js|ts|vue)$/)),
    manifest.background.service_worker,
  ].filter(Boolean)
  const pages = [
    manifest.action?.default_popup,
    manifest.options_page,
  ]
    .filter(Boolean)
    .map((path) => path + '.js')

  const ctx = await esbuild.context({
    entryPoints: [...scripts, ...pages]
      .map((script) => 'src/' + script),
    bundle: true,
    format: 'esm',
    sourcemap: 'inline',
    outbase: 'src',
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    outdir: 'dist',

    plugins: [
      createUnplugin(() => {
        const background = manifest.background?.service_worker
        if (!background) {
          throw null
        }

        let buildId = ''
        return {
          name: 'reload',
          buildStart() {
            buildId = crypto.randomUUID()
          },
          resolveId(source) {
            if (background === path.relative('src', source)) {
              return source
            }
            return null
          },
          load(id) {
            if (background !== path.relative('src', id)) {
              return null
            }

            const externalVars = Object.entries({ buildId, port }).map((
              [name, value],
            ) => `const ${name} = ${JSON.stringify(value)}`).join('\n')
            async function wsClient() {
              while (true) {
                const ws = new WebSocket(`ws://localhost:${port}/ws`)
                ws.addEventListener('open', () => {
                  ws.send(JSON.stringify({ buildId }))
                })
                ws.addEventListener('message', (message) => {
                  if (message.data.toString() === 'reload') {
                    chrome.runtime.reload()
                  }
                })
                await new Promise((resolve) => {
                  ws.addEventListener('close', resolve)
                  ws.addEventListener('error', resolve)
                })

                await new Promise((resolve) => setTimeout(resolve, 1000))
              }
            }
            return `
                ;(() => {
                  ${externalVars}
                  ;(${wsClient})()
                })()
              ` + (originalBackground
              ? `export * from "./${originalBackground}"`
              : '')
          },
          writeBundle() {
            reloadAll(buildId)
          },
        }
      }).esbuild(),
      createUnplugin(() => {
        const pageInfos = Object.fromEntries(pages.map((page) => {
          const splitted = path.basename(page).split(/\./)
          return [page, {
            dir: path.dirname(page),
            ext: splitted.at(-2),
            name: splitted.slice(0, -2).join('.'),
          }]
        }))

        const converter = ([
          ...pages.map((page) => {
            const { name, ext } = pageInfos[page] ?? {}
            return (json: string) =>
              json.replaceAll(`${name}.${ext}`, `${name}.html`)
          }),
          (json) => json.replaceAll(/\.ts/g, '.js'),
        ] satisfies ((json: string) => string)[]).reduce(
          (current, accum) => (json) => accum(current(json)),
          (json) => json,
        )

        return {
          name: 'build-vue',
          resolveId(source) {
            if (pageInfos[path.relative('src', source)]) {
              return source
            }
            return null
          },
          load(id) {
            const info = pageInfos[path.relative('src', id)]
            if (!info) {
              return null
            }
            const { ext, name, dir } = info
            if (!ext) {
              return null
            }

            this.emitFile({
              type: 'asset',
              fileName: 'manifest.json',
              source: converter(JSON.stringify(manifest, null, '  ')),
            })
            this.emitFile({
              type: 'asset',
              fileName: dir + '/' + name + '.html',
              source: `
                <html>
                  <head>
                    <script src="./${name}.${ext}.js" type="module"></script>
                    <link href="./${name}.${ext}.css" rel="stylesheet" type="text/css"></link>
                  </head>
                  <body>
                    <div id="app"></div>
                  </body>
                </html>`,
            })
            if (ext === 'vue') {
              return `
                import { createApp } from "vue";
                import * as m from "./${name}.${ext}";

                document.addEventListener("DOMContentLoaded", () => {
                  const plugin = m[\`\${"plugin"}\`]; // prevent import-is-undefined
                  (plugin ?? ((a) => a))(createApp(m.default)).mount("#app");
                });`
            } else if (['js', 'ts'].includes(ext)) {
              return `export * from "./${name}.${ext}"`
            }
          },
        }
      }).esbuild(),
      createUnplugin(() => {
        const colors = {
          blue: 94,
          bgBlue: 104,
        }
        const c = Object.fromEntries(
          Object.entries(colors).map((
            [name, num],
          ) => [name, (str: string) => `\x1b[${num}m${str}\x1b[0m`]),
        ) as { [name in keyof typeof colors]: (str: string) => string }

        return {
          name: 'writeBundle-notifier',
          writeBundle: (() => {
            return () => {
              console.log(
                `${c.blue('ℹ️')}${c.bgBlue(' INFO ')} writeBundle\n`,
              )
            }
          })(),
        }
      }).esbuild(),
      Vue({
        style: {
          preprocessLang: 'scss',
        },
      }),
    ],
  })

  ctx.watch()
  return () => ctx.dispose()
}

let dispose = await build()
const rebuild = debounce(async () => {
  await dispose()
  dispose = await build()
}, 1000)
for await (
  const event of Deno.watchFs([
    manifestPath,
    './package.json',
    './tsconfig.json',
  ])
) {
  if (!['create', 'remove', 'rename', 'modify'].includes(event.kind)) {
    continue
  }
  rebuild()
}
