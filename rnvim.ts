#!/usr/bin/env -S deno run --allow-run=tmux,nvim --allow-env=TMUX,HOME --allow-read --ext ts

import { resolve } from 'https://deno.land/std@0.200.0/path/mod.ts'

function nvim(args: string[], piped: boolean) {
  const std = piped ? 'piped' : 'inherit'
  new Deno.Command(
    'nvim',
    {
      args,
      stdin: std,
      stdout: std,
      stderr: std,
    },
  ).spawn()
}

const args = [...Deno.args]

if (['--server', '--listen'].some((a) => args.includes(a))) {
  nvim(args, true)
  Deno.exit(0)
}

async function run(command: string, args: string[]) {
  const process = new Deno.Command(command, {
    args: args,
    stdin: 'piped',
    stdout: 'piped',
    stderr: 'piped',
  }).spawn()
  return new TextDecoder().decode(await process.output().then((o) => o.stdout))
    .replace(/\n$/, '')
}

async function isExists(path: string) {
  try {
    return Boolean(await Deno.stat(path))
  } catch {
    return false
  }
}

async function waitSwpFileRemove(paths: string[]) {
  const swapDirPath = Deno.env.get('HOME') + '/.local/state/nvim/swap/'
  const watcher = Deno.watchFs(swapDirPath)
  const swpPathSet = new Set(
    paths
      .map((path) => resolve(path))
      .map((path) => path.replaceAll(/\//g, '%')) // TODO: windows
      .map((path) => swapDirPath + path + '.swp'),
  )

  for await (const event of watcher) {
    if (event.kind !== 'remove') {
      continue
    }
    event.paths.forEach((path) => swpPathSet.delete(path))
    if (swpPathSet.size <= 0) {
      return
    }
  }
}

const id = await (() => {
  if (Deno.env.get('TMUX')) {
    return run('tmux', ['display-message', '-p', '#S-#{window_id}']).then((r) =>
      r.replaceAll('%', '')
    )
  } else {
    return 'main'
  }
})()

const pipePath = Deno.env.get('HOME') + '/.cache/nvim/' + id + '.pipe'

const [newArgs, piped, swpPromise] =
  await (async (): Promise<[string[], boolean, Promise<void> | null]> => {
    if (await isExists(pipePath)) {
      const newArgs = ['--server', pipePath, '--remote-tab', ...args]
      const waitIndex = newArgs.indexOf('--wait')
      if (waitIndex !== -1) {
        return [
          newArgs,
          true,
          waitSwpFileRemove(args.filter((arg) => arg[0] !== '-')),
        ]
      } else {
        return [newArgs, true, null]
      }
    } else {
      return [['--listen', pipePath, ...args], false, null]
    }
  })().then((
    [newArgs, ...rest],
  ) =>
    [
      newArgs
        .filter((arg) => arg !== '--wait')
        .map((arg) => arg[0] === '-' ? arg : resolve(arg)),
      ...rest,
    ] as const
  )

nvim(newArgs, piped)
await swpPromise
