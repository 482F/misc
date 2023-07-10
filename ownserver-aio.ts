#!/usr/bin/env -S deno run --allow-run --ext ts
/**
 * ownserver-aio <host-ip> <port>
 *
 * ローカルマシン側の WSL で実行する
 *
 * ローカルマシン側の WSL に deno コマンド、
 * ローカルマシン側の Windows に ownserver.exe コマンド、
 * VPN 側に ownserver-auth, ownserver-server コマンドのパスを通しておく必要がある
 *
 * VPN 側で port(protocol), [auth-port](tcp), [control-port](tcp) を開けておく必要がある
 * port は接続してくるクライアントに対して、[auth-port] はサーバが立っているローカルマシンに対して開ける
 */
import { toHashString } from 'https://deno.land/std@0.188.0/crypto/to_hash_string.ts'
import { TextLineStream } from 'https://deno.land/std@0.136.0/streams/mod.ts'
import { mergeReadableStreams } from 'https://deno.land/std@0.193.0/streams/merge_readable_streams.ts'
import {
  Command,
  CompletionsCommand,
} from 'https://deno.land/x/cliffy@v0.25.7/command/mod.ts'
import {
  keypress,
  KeyPressEvent,
} from 'https://deno.land/x/cliffy@v1.0.0-rc.2/keypress/mod.ts'

async function sshRun(sshProfileName: string, commands: string) {
  const process = await new Deno.Command('ssh', {
    args: [sshProfileName],
    stdin: 'piped',
    stdout: 'piped',
    stderr: 'piped',
  }).spawn()
  const writer = process.stdin.getWriter()
  const encoded = new TextEncoder().encode(commands)
  await writer.ready
  writer.write(encoded)
  await writer.close()
  return process.output()
}

async function sshRunDaemons(sshProfileName: string, commands: string[]) {
  const formattedCommands = commands
    .map((command) => `nohup ${command} > /dev/null 2>&1 &\necho "pid:$!"`)
    .join('\n')
  const { code, stdout, stderr } = await sshRun(
    sshProfileName,
    formattedCommands
  )

  if (code !== 0) {
    console.error(new TextDecoder().decode(stderr))
    Deno.exit(1)
  }

  const pids = [
    ...new TextDecoder().decode(stdout).matchAll(/^pid:(\d+)$/gm),
  ].map((m) => m[1])

  if (!pids || pids.length <= 0) {
    console.log('実行に失敗しました')
    console.log(new TextDecoder().decode(stdout))
    Deno.exit(1)
  }
  return async () => {
    return await sshRun(
      sshProfileName,
      pids.map((pid) => `kill ${pid}`).join('\n')
    )
  }
}

function runningCommand(spawner: () => Deno.ChildProcess) {
  let process: Deno.ChildProcess | undefined
  let killed = false
  ;(async () => {
    while (!killed) {
      process = spawner()
      const joined = mergeReadableStreams(process.stdout, process.stderr)

      ;(async () => {
        const lineStream = joined
          .pipeThrough(new TextDecoderStream())
          .pipeThrough(new TextLineStream())
        for await (const line of lineStream) {
          console.log(line)
        }
      })()
      await process.status
      await new Promise((resolve) => setTimeout(resolve, 1000))
      console.log('respawn')
    }
  })()
  return () => {
    killed = true
    process?.kill()
  }
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

async function main(
  {
    sshProfileName,
    protocol,
    authPort,
    controlPort,
  }: {
    sshProfileName?: string
    protocol: string
    authPort: number
    controlPort: number
  },
  hostIp: string,
  port: number
) {
  sshProfileName ??= hostIp
  const secret = await crypto.subtle
    .digest(
      'SHA-256',
      new TextEncoder().encode(
        await new Deno.Command('head', {
          args: ['-c', '8', '/dev/random'],
        })
          .output()
          .then(({ stdout }) => new TextDecoder().decode(stdout))
      )
    )
    .then((b) => toHashString(b))

  const killLocalDaemon = runningCommand(() =>
    new Deno.Command('ownserver.exe', {
      args: [
        '--payload',
        protocol,
        '--local-port',
        port.toString(),
        '--control-port',
        controlPort.toString(),
        '--token-server',
        `http://${hostIp}:${authPort}/v0/request_token`,
      ],
      stdout: 'piped',
      stderr: 'piped',
    }).spawn()
  )

  const killRemoteDaemons = await sshRunDaemons(sshProfileName, [
    `ownserver-auth --token-secret ${secret} --hosts ${hostIp} --port ${authPort}`,
    `ownserver-server --host ${hostIp} --remote-port-start ${port} --remote-port-end ${
      port + 1
    } --token-secret ${secret} --control-port ${controlPort}`,
  ])

  waitCtrlC().then(async () => {
    console.log('終了します')
    await killLocalDaemon()
    await killRemoteDaemons()
    Deno.exit(0)
  })
  console.log('ownserver 実行中・・・\nCtrl+C で終了します\n')
}

new Command()
  .name('ownserver-aio')
  .arguments('<host-ip:string> <port:number>')
  .option('--ssh-profile-name <name:string>', 'SSH 接続時のプロファイル名')
  .option('--protocol <name:string>', 'tcp/udp', { default: 'udp' })
  .option('--auth-port <port:number>', '認証用ポート番号', { default: 8123 })
  .option('--control-port <port:number>', '接続用ポート番号', { default: 5000 })
  .action(main)
  .command('completions', new CompletionsCommand())
  .hidden()
  .parse(Deno.args)
