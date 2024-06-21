#!/usr/bin/env -S deno run -A

/*
```.bashrc
# export ACD_PORT=55812 # optional

PATH_TO_ACD="/path/to/acd.ts"
alias acdts="${PATH_TO_ACD}"
function acd() {
  if [[ "${1:-}" == "completions" ]]; then
    acdts "${@:1}"
    return
  fi
  local result=$(acdts "${@}")
  if [[ "${result}" == "cd"* ]]; then
    source <(echo "${result}")
  elif [[ "${result}" != "" ]]; then
    echo "${result}"
  fi
}
(nohup "${PATH_TO_ACD}" --listen >/dev/null 2>&1 &)
source <(acdts completions bash | perl -pe 's/_acd_complete alias/COMP_WORDS=\"\${COMP_WORDS[@]}\" COMP_CWORD=\"\${COMP_CWORD}\" _acd_complete alias/')
```
*/

import { join, resolve, SEP } from 'https://deno.land/std@0.201.0/path/mod.ts'
import {
  ArgumentValue,
  Command,
  CompletionsCommand,
  Type,
} from 'https://deno.land/x/cliffy@v0.25.7/command/mod.ts'
import { messengerCreator } from '482f-utils/common.ts'

const messenger = messengerCreator<
  | {
    type: 'get'
    request: { alias: string }
    response: { dest: string | null }
  }
  | { type: 'all'; response: { json: Record<string, string> } }
  | { type: 'set'; request: { partJson: Record<string, string | null> } }
>()

const defaultPort = 55812

const hostname = 'localhost'
const envPort = Number(Deno.env.get('ACD_PORT'))
const port = Number.isNaN(envPort) ? defaultPort : envPort

const sender = messenger.createSender(async (_type, rawMessage) => {
  return await fetch(`http://${hostname}:${port}`, {
    method: 'POST',
    body: rawMessage,
  }).then((r) => r.text())
})

const serverJson = await sender('all', {})
  .then(({ json }) => json)
  .catch(() => {})

async function useJson(): Promise<
  [
    Record<string, string>,
    (partJson: Record<string, string | null>) => Promise<void>,
  ]
> {
  if (serverJson) {
    return [serverJson, async (partJson) => {
      await sender('set', { partJson })
    }]
  }

  const configHome = Deno.env.get('XDG_CONFIG_HOME') ?? Deno.env.get('HOME')

  if (!configHome) {
    console.error('$XDG_CONFIG_HOME and $HOME are empty')
    Deno.exit(1)
  }

  const jsonPath = join(configHome, 'acd.json')

  await Deno.stat(jsonPath)
    .catch(() => Deno.writeTextFile(jsonPath, '{}'))

  const json: Record<string, string> = JSON.parse(
    await Deno.readTextFile(jsonPath),
  )

  return [json, async (partJson) => {
    Object.assign(json, partJson)
    Object.entries(json).forEach(([key, value]) => {
      if (typeof value !== 'string') {
        delete json[key]
      }
    })
    await Deno.writeTextFile(jsonPath, JSON.stringify(json))
  }]
}

async function completeAliasDir(
  json: Record<string, string>,
  alias: string,
  fixedPath: string,
  inputting: string,
) {
  const dest = json[alias]
  if (!dest) {
    return []
  }

  const dirs: string[] = []
  for await (const entry of Deno.readDir(join(dest, fixedPath))) {
    if (!entry.isDirectory || !entry.name.startsWith(inputting)) {
      continue
    }
    dirs.push(entry.name)
  }
  return dirs.map((dir) => join(alias, fixedPath, dir) + SEP)
}

const [json, setJson] = await useJson()
class AliasType extends Type<string> {
  async complete(): Promise<Array<string>> {
    const words = (Deno.env.get('COMP_WORDS') ?? '').split(' ')
    const word = words[Number(Deno.env.get('COMP_CWORD') ?? 0)] ?? ''
    const completions = await (() => {
      if (word.includes(SEP)) {
        const splittedWords = word.split(SEP)
        const alias = splittedWords[0]
        const fixeds = splittedWords.slice(1, -1)
        const inputting = splittedWords.at(-1)
        return completeAliasDir(
          json,
          alias ?? '',
          fixeds.join(SEP),
          inputting ?? '',
        )
      } else {
        return Object.keys(json)
          .filter((alias) => alias.startsWith(word))
          .map((alias) => alias + SEP)
      }
    })()

    if (completions.length === 1) {
      const [completion = ''] = completions
      return [completion + '0', completion + '1'] // 補完を確定させないためにダミーの候補を用意する
    } else {
      return completions
    }
  }

  parse(type: ArgumentValue): string {
    return type.value
  }
}

new Command()
  .name('acd')
  .type('alias', new AliasType())
  .arguments('[alias:alias] [path:string]')
  .option('-a --add', 'add alias')
  .option('-d --delete', 'delete alias', { conflicts: ['add'] })
  .option('--listen', 'launch acd server', { conflicts: ['add', 'delete'] })
  .action(async function (
    { add: isAdd, 'delete': isDelete, listen },
    aliasAndRest,
    path,
  ) {
    if (listen) {
      if (serverJson) {
        return
      }

      const listener = messenger.createListener(async (listener) => {
        const { serve } = await import(
          'https://deno.land/std@0.178.0/http/server.ts'
        )

        serve(async function handler(request) {
          const rtext = await request.text()
          const { type } = JSON.parse(rtext)
          return new Response(
            JSON.stringify(await listener(type, rtext) ?? ''),
          )
        }, { port, hostname })
      })
      listener(
        {
          get({ alias }) {
            return { dest: json[alias] ?? null }
          },
          all() {
            return { json }
          },
          set({ partJson }) {
            setJson(partJson)
          },
        },
      )
      return
    }

    if (!aliasAndRest) {
      const entries = Object.entries(json)
      const maxKeyLen = Math.max(...entries.map(([alias]) => alias.length))
      console.log(
        entries.map(([alias, dest]) =>
          `${alias.padEnd(maxKeyLen, ' ')}: ${dest}`
        ).join('\n'),
      )
      Deno.exit(0)
    }

    if (isAdd) {
      path ??= Deno.cwd()
      await setJson({
        [aliasAndRest]: resolve(path),
      })
    } else if (isDelete) {
      const newJson = { ...json }
      delete newJson[aliasAndRest]
      await setJson({
        [aliasAndRest]: null,
      })
    } else {
      const [alias = '', ...rest] = aliasAndRest.split(SEP)
      const dest = json[alias] ?? Deno.cwd()
      console.log(`cd "${join(dest, ...rest)}"`)
    }
  })
  .command('completions', new CompletionsCommand())
  .hidden()
  .parse(Deno.args)
