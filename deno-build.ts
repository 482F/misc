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

import * as esbuild from 'https://deno.land/x/esbuild@v0.19.4/wasm.js'

import { denoPlugins } from 'https://deno.land/x/esbuild_deno_loader@0.8.2/mod.ts'

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

async function outputBundled(filePath: string, destPath: string) {
  const spinner = Spinner.getInstance()

  const spinnerStartPromise = spinner.start('bundling')

  const configPath = await closestFilePath(
    dirname(filePath),
    (entry) => Boolean(entry.name.match(/deno\.jsonc?/)),
  ).then((path) => path ? resolve(path) : path)

  const result = await esbuild.build({
    plugins: [...denoPlugins({
      nodeModulesDir: true,
      configPath: configPath,
    })],
    entryPoints: [toFileUrl(resolve(filePath)).toString()],
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxImportSource: 'react',
    bundle: true,
    metafile: true,
    format: 'esm',
    sourcemap: 'inline',
  })
    .then((r) => ({
      inputs: Object.keys(r.metafile.inputs),
      contents: r.outputFiles?.[0]?.contents,
      error: null,
    }))
    .catch((e) => ({ contents: null, inputs: null, error: e }))

  esbuild.stop()

  await spinnerStartPromise

  if (result?.contents) {
    await spinner.succeed(
      `[${format(new Date(), 'HH:mm:ss.SSS')}] bundled '${destPath}'`,
    )
    console.log('')
    await Deno.writeFile(destPath, result.contents)
  } else {
    await spinner.fail(
      `[${format(new Date(), 'HH:mm:ss.SSS')}] bundle failed`,
    )
    console.log('')
    console.error(result?.error)
  }

  return result.inputs
}

function createWatcherAndUpdater() {
  const dummyWatcher = {
    close() {},
    async *[Symbol.asyncIterator]() {
      // async iterator を deno が認識できてない？
      // deno-lint-ignore no-await-in-sync-fn
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
    (filePaths: string[]) => {
      // const diffLength = filePathSet.size !== filePaths.length
      // const hasNew =
      //   0 < filePaths.filter((path) => !filePathSet.has(path)).length

      // 何故か neovim で編集すると remove イベントが発生してそれ以降の modify を監視できなくなる
      // そのため、modify ごとに watcher を作りなおす
      // if (diffLength || hasNew) {
      // filePathSet = new Set(filePaths)
      watcher.close()
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

async function main(
  { watch = false }: { watch?: boolean | undefined },
  filePath: string,
  destPath?: string,
) {
  destPath ??= filePath + '.bundled.js'

  const inputs = await outputBundled(filePath, destPath)

  const [watcher, updater] = createWatcherAndUpdater()

  if (!inputs || !watch) {
    Deno.exit(inputs ? 0 : 1)
  }

  let relativeFilePaths = resolveRelativeFiles(inputs, [])
  updater(relativeFilePaths)
  for await (const event of watcher()) {
    if (!['create', 'modify', 'remove'].includes(event.kind)) {
      continue
    }

    const inputs = await outputBundled(filePath, destPath)
    relativeFilePaths = resolveRelativeFiles(
      inputs,
      relativeFilePaths,
    )
    updater(relativeFilePaths)
  }
}

new Command()
  .name('deno-build')
  .arguments('<target-file:string> [destination:string]')
  .option('--watch', 'watch file modify')
  .action(main)
  .parse(Deno.args)
