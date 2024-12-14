#!/usr/bin/env -S deno run --no-config --allow-env --allow-read --allow-write=. --allow-net --ext ts

import {
  dirname,
  join,
  resolve,
  toFileUrl,
} from 'https://deno.land/std@0.205.0/path/mod.ts'
import { Command } from 'https://deno.land/x/cliffy@v0.25.7/command/mod.ts'
import Spinner from 'https://deno.land/x/cli_spinners@v0.0.2/mod.ts'
import { format } from 'https://deno.land/std@0.205.0/datetime/format.ts'
import {
  keypress,
  KeyPressEvent,
} from 'https://deno.land/x/cliffy@v1.0.0-rc.2/keypress/mod.ts'

import * as esbuild from 'npm:esbuild@0.20.2'

import { denoPlugins } from 'jsr:@luca/esbuild-deno-loader@0.11.1'

async function closestFilePath(
  dir: string,
  searcher: (entry: Deno.DirEntry) => Promise<boolean> | boolean,
) {
  let resolvedDir = resolve(dir)
  while (resolvedDir !== '/') {
    for await (const entry of Deno.readDir(resolvedDir)) {
      if (entry.isFile && await searcher(entry)) {
        return join(resolvedDir, entry.name)
      }
    }
    resolvedDir = dirname(resolvedDir)
  }
}

export async function getRebuilder(
  filePath: string,
  configPath: string | undefined,
  option: {
    minify: boolean
    sourcemap: boolean | 'linked' | 'inline' | 'external' | 'both'
  },
) {
  const context = await esbuild.context({
    plugins: [...denoPlugins({
      configPath: configPath,
    })],
    entryPoints: [toFileUrl(resolve(filePath)).toString()],
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxImportSource: 'react',
    bundle: true,
    metafile: true,
    format: 'esm',
    sourcemap: option.sourcemap,
    minify: option.minify,
    write: false,
  })
  return [async function rebuild() {
    return await context.rebuild()
      .then((r) => ({
        inputs: Object.keys(r.metafile.inputs),
        outputFiles: r.outputFiles,
        error: null,
      }))
      .catch((e) => ({ outputFiles: null, inputs: null, error: e }))
  }, () => context.dispose()] as const
}

async function getWriter(filePath: string, destPath: string, option: {
  minify: boolean
  inlineSourcemap: boolean
}) {
  const spinner = Spinner.getInstance()

  const spinnerStartPromise = spinner.start('bundling')

  const configPath = await closestFilePath(
    dirname(filePath),
    (entry) => Boolean(entry.name.match(/deno\.jsonc?/)),
  ).then((path) => path ? resolve(path) : path)

  const [rebuild, stop] = await getRebuilder(filePath, configPath, {
    minify: option.minify,
    sourcemap: option.inlineSourcemap ? 'inline' : false,
  })

  return [
    async function write() {
      await spinnerStartPromise

      await waitFilesExist([filePath])
      const result = await rebuild()
      const contents = result?.outputFiles?.[0]?.contents
      if (contents) {
        await spinner.succeed(
          `[${format(new Date(), 'HH:mm:ss.SSS')}] bundled '${destPath}'`,
        )
        console.log('')
        await Deno.writeFile(destPath, contents)
      } else {
        await spinner.fail(
          `[${format(new Date(), 'HH:mm:ss.SSS')}] bundle failed`,
        )
        console.log('')
        console.error(result?.error)
      }

      return result.inputs
    },
    () => stop(),
  ] as const
}

async function wait<T>(
  fn: () => T,
  intervalMs: number,
  timeoutMs: number,
): Promise<Awaited<T>> {
  let timeouted = false
  setTimeout(() => {
    timeouted = true
  }, timeoutMs)

  while (true) {
    const result = await fn()
    if (result) {
      return result
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
    if (timeouted) {
      throw new Error('timeouted')
    }
  }
}

async function waitFilesExist(filePaths: string[]) {
  for (const filePath of filePaths) {
    await wait(() => Deno.open(filePath).catch(() => false), 100, 1000)
  }
}

function createWatcherAndUpdater() {
  const dummyWatcher = {
    close() {},
    async *[Symbol.asyncIterator]() {
      await new Promise(() => {})
      yield {
        kind: 'any' as const,
        paths: [],
      }
    },
  }

  // let filePathSet = new Set<string>()
  let watcher: AsyncIterable<Deno.FsEvent> & { close: () => void } =
    dummyWatcher

  return [
    async function* () {
      while (true) {
        for await (const event of watcher) {
          yield event
        }
      }
    },
    async (filePaths: string[]) => {
      // const diffLength = filePathSet.size !== filePaths.length
      // const hasNew =
      //   0 < filePaths.filter((path) => !filePathSet.has(path)).length

      // 何故か neovim で編集すると remove イベントが発生してそれ以降の modify を監視できなくなる
      // そのため、modify ごとに watcher を作りなおす
      // if (diffLength || hasNew) {
      // filePathSet = new Set(filePaths)
      watcher.close()
      await waitFilesExist(filePaths)
      watcher = Deno.watchFs(filePaths)
      // }
    },
  ] as const
}

function resolveRelativeFiles(
  inputs: string[] | null,
  prevFilePaths: string[],
) {
  if (!inputs) {
    return prevFilePaths
  }
  return inputs
    .filter((url) => !url.startsWith('http'))
    .map((path) => '/' + path)
}

async function waitCtrlC() {
  return await new Promise((resolve) =>
    keypress().addEventListener('keydown', (event: KeyPressEvent) => {
      if (event.ctrlKey && event.key === 'c') {
        resolve(undefined)
        keypress().dispose()
      }
    })
  )
}

if (import.meta.main) {
  new Command()
    .name('deno-build')
    .arguments('<target-file:string> [destination:string]')
    .option('--watch', 'watch file modify')
    .option('--no-inline-sourcemap', 'generate inline sourcemap')
    .option('--no-minify', 'minify')
    .action(
      async function main(
        { watch = false, inlineSourcemap = true, minify = true },
        filePath: string,
        destPath?: string,
      ) {
        destPath ??= filePath + '.bundled.js'

        const [write, stop] = await getWriter(filePath, destPath, {
          inlineSourcemap,
          minify,
        })

        const inputs = await write()

        waitCtrlC().then(async () => {
          await stop()
          Deno.exit(0)
        })

        const [watcher, updater] = createWatcherAndUpdater()

        if (!inputs || !watch) {
          Deno.exit(inputs ? 0 : 1)
        }

        let relativeFilePaths = resolveRelativeFiles(inputs, [])
        await updater(relativeFilePaths)
        for await (const event of watcher()) {
          if (!['create', 'modify', 'remove'].includes(event.kind)) {
            continue
          }

          const inputs = await write()
          relativeFilePaths = resolveRelativeFiles(
            inputs,
            relativeFilePaths,
          )
          await updater(relativeFilePaths)
        }
        await stop()
      },
    )
    .parse(Deno.args)
}
