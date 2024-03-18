#!/usr/bin/env -S deno run --no-config --allow-run=tmux,nvim,nvim-qt,powershell.exe --allow-env=TMUX_PANE,HOME,LOCALAPPDATA,FROM_WIN --allow-read --allow-write --ext ts

if (Deno.env.get('FROM_WIN') === 'true' && Deno.build.os !== 'windows') {
  await new Deno.Command('powershell.exe', { args: ['rnvim', ...Deno.args] })
    .spawn().status
  Deno.exit(0)
}

import { join, resolve } from 'https://deno.land/std@0.200.0/path/mod.ts'

function nvim(exe: string, args: string[], piped: boolean) {
  const std = piped ? 'piped' : 'inherit'
  return new Deno.Command(
    exe,
    {
      args,
      stdin: std,
      stdout: std,
      stderr: std,
    },
  )
    .spawn()
    .status
}

const args = [...Deno.args]

if (['--server', '--listen'].some((a) => args.includes(a))) {
  nvim('nvim', args, true)
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

const nvimDirPath = (() => {
  if (Deno.build.os === 'windows') {
    return join(Deno.env.get('LOCALAPPDATA') ?? '', 'nvim-data')
  } else {
    return join(Deno.env.get('HOME') ?? '', '.local', 'state', 'nvim')
  }
})()

async function waitSwpFileRemove(paths: string[]) {
  const swapDirPath = join(nvimDirPath, 'swap')
  const watcher = Deno.watchFs(swapDirPath)
  const swpPathSet = new Set(
    paths
      .map((path) => resolve(path))
      .map((path) => path.replaceAll(/[\/\\:]/g, '%'))
      .map((path) => join(swapDirPath, path + '.swp')),
  )

  for await (const event of watcher) {
    if (event.kind !== 'remove') {
      continue
    }
    event.paths.forEach((path) => swpPathSet.delete(path))
    if (swpPathSet.size <= 0) {
      watcher.close()
    }
  }
  return
}

const id = await (async () => {
  const currentPaneId = Deno.env.get('TMUX_PANE')?.replace('%', '')
  if (currentPaneId) {
    const allIds = await run('tmux', [
      'list-panes',
      '-s',
      '-F',
      '#{pane_id},#S-#{start_time}-#{window_id}',
    ])
      .then((r) =>
        r.replaceAll('%', '').split('\n').map((line) => line.split(','))
      )
    return allIds.find(([paneId]) => paneId === `${currentPaneId}`)?.[1]
  }
})() ?? 'main'

await Deno.mkdir(join(nvimDirPath, 'rnvim'), { recursive: true })
const pipePath = join(nvimDirPath, 'rnvim', id + '.pipe')
const address = Deno.build.os === 'windows' ? 'localhost:14590' : pipePath

const extraArg = {
  forceListen: '--force-listen',
}

if (args.includes(extraArg.forceListen)) {
  await Deno.remove(pipePath).catch(() => {})
}

const serverExists = await isExists(pipePath)

if (Deno.build.os === 'windows') {
  await Deno.writeTextFile(pipePath, 'a')
}

function isFileArg(arg: string) {
  return arg[0] !== '-' && arg !== address
}

const [newArgs, piped, swpPromise] =
  await (async (): Promise<[string[], boolean, Promise<void> | null]> => {
    if (serverExists) {
      const newArgs = ['--server', address, '--remote-tab', ...args]
      const waitIndex = newArgs.indexOf('--wait')
      if (waitIndex !== -1) {
        return [
          newArgs,
          true,
          waitSwpFileRemove(args.filter(isFileArg)),
        ]
      } else {
        return [newArgs, true, null]
      }
    } else {
      return [['--listen', address, ...args], false, null]
    }
  })().then((
    [newArgs, ...rest],
  ) => {
    const extraArgSet = new Set(Object.values(extraArg))
    return [
      newArgs
        .filter((arg) => arg !== '--wait')
        .filter((arg) => !extraArgSet.has(arg))
        .map((arg) => isFileArg(arg) ? resolve(arg) : arg),
      ...rest,
    ] as const
  })

let exe = 'nvim'
if (!serverExists && Deno.build.os === 'windows') {
  exe = 'nvim-qt'
  newArgs.splice(0, 0, '--')
}
const nvimPromise = nvim(exe, newArgs, piped)
await swpPromise
await nvimPromise

if (!serverExists) {
  await Deno.remove(pipePath).catch(() => {})
}
