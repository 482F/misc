#!/usr/bin/env -S deno run -A

import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

type Alias = { alias: string; command: string }

function prepareStore(path: string) {
  const db = new DatabaseSync(path)

  db.exec(`
    CREATE TABLE IF NOT EXISTS aliases (
      uuid TEXT PRIMARY KEY,
      alias TEXT NOT NULL UNIQUE,
      command TEXT NOT NULL
    );`)

  return {
    add(alias: string[], command: string) {
      db.prepare('INSERT INTO aliases (uuid, alias, command) VALUES (?, ?, ?)')
        .run(crypto.randomUUID(), alias.join(' '), command)
    },
    remove(alias: string[]) {
      db.prepare('DELETE FROM aliases WHERE alias = ?').run(alias.join(' '))
    },
    get(alias: string[]) {
      return db.prepare('SELECT * FROM aliases WHERE alias = ?').get(
        alias.join(' '),
      ) as Alias
    },
    search(query: string) {
      const sqlQuery = `%${query}%`
      return db.prepare(
        'SELECT * FROM aliases WHERE alias LIKE ? OR command LIKE ? ORDER BY alias',
      )
        .all(sqlQuery, sqlQuery) as Alias[]
    },
  }
}

function prepareService(store: ReturnType<typeof prepareStore>) {
  return {
    add(alias: string[]) {
      const command = prompt('input command:')
      if (!command) {
        throw new Error('no input')
      }
      store.add(alias, command)
    },
    remove(alias: string[]) {
      store.remove(alias)
    },
    list(query: string[]) {
      const aQuery = query.join(' ')
      function highlight(str: string) {
        return '\x1b[1m\x1b[31m' + str + '\x1b[0m'
      }
      const aliases = store.search(aQuery)
      const maxLen = Math.max(...aliases.map(({ alias }) => alias.length))

      const output = aliases
        .map(({ alias, command }) => `${alias.padEnd(maxLen, ' ')}: ${command}`)
        .join('\n')

      const matchedIndices = []
      for (let i = 0; i < output.length; i++) {
        if (output.slice(i).startsWith(aQuery)) {
          matchedIndices.push(i)
          i += aQuery.length
        }
      }

      console.log(
        matchedIndices.flatMap((start, i, all) => {
          const end = start + aQuery.length
          const next = all[i + 1] ?? undefined
          return [highlight(output.slice(start, end)), output.slice(end, next)]
        }).join(''),
      )
    },
    async exec(args: string[]) {
      const [alias, cArgs] = (() => {
        for (let i = 1; i <= args.length; i++) {
          const alias = store.get(args.slice(0, i))
          if (alias) {
            return [alias, args.slice(i)] as const
          }
        }
      })() ?? []
      if (!alias || !cArgs) {
        throw new Error('alias not found')
      }

      const status = await new Deno.Command(Deno.env.get('SHELL') ?? '', {
        args: ['-c', `${alias.command} ${cArgs.join(' ')}`],
        stdin: 'inherit',
        stdout: 'inherit',
        stderr: 'inherit',
      }).spawn().status
      Deno.exit(status.code)
    },
  }
}

async function main() {
  const configDir = [
    'TOTP_JSON_DIR',
    'XDG_DATA_HOME',
    'USERPROFILE',
    'HOME',
  ].reduce<string | undefined>((dir, env) => dir || Deno.env.get(env), '')
  if (!configDir) {
    throw new Error('configDir is not found.')
  }
  const store = prepareStore(join(configDir, 'alias.sqlite3'))
  const service = prepareService(store)

  switch (Deno.args[0]) {
    case '-a':
    case '--add': {
      service.add(Deno.args.slice(1))
      return
    }
    case '-d':
    case '--delete': {
      service.remove(Deno.args.slice(1))
      return
    }
    case '-l':
    case '--list': {
      service.list(Deno.args.slice(1))
      return
    }
    case '-h':
    case '--help': {
      console.log(
        ['-a|--add alias', '-d|--delete alias', '-l|--list search query'].join(
          '\n',
        ),
      )
      return
    }
    default: {
      await service.exec(Deno.args)
      return
    }
  }
}

main()
