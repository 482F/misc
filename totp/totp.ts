#!/usr/bin/env -S deno run --unstable-kv --allow-env=XDG_DATA_HOME --allow-read=${XDG_DATA_HOME}/totp.sqlite3 --allow-write=${XDG_DATA_HOME}/totp.sqlite3

import { join } from 'https://deno.land/std@0.201.0/path/mod.ts'
import { ArgumentValue, Command, Type } from 'jsr:@cliffy/command@1.0.0-rc.7'
import { CompletionsCommand } from 'jsr:@cliffy/command@1.0.0-rc.7/completions'
import { Secret } from 'jsr:@cliffy/prompt@1.0.0-rc.7'
import { TOTP } from 'jsr:@hectorm/otpauth@9.3.5'

async function prepareDb() {
  const dbPath = join(Deno.env.get('XDG_DATA_HOME'), 'totp.sqlite3')
  const kv = await Deno.openKv(dbPath)
  return {
    async allNames() {
      return await Array.fromAsync(kv.list({ prefix: [] })).then((
        arr,
      ) => arr.map((v) => v.key[0]).filter((key) => typeof key === 'string'))
    },
    async getSecret(name: string) {
      const encrypted = await kv.get<string>([name]).then((r) => r.value)
      if (!encrypted) {
        throw new Error(`no entry named "${name}"`)
      }
      return {
        async decrypt(pass: string) {
          return await decrypt(encrypted, pass)
        },
      }
    },
    async setSecret(name: string, plainSecret: string, pass: string) {
      const encrypted = await encrypt(plainSecret, pass)
      await kv.set([name], encrypted)
    },
    async remove(name: string) {
      await kv.delete([name])
    },
  }
}

class NameType extends Type<string> {
  override async complete(): Promise<Array<string>> {
    return await prepareDb().then((db) => db.allNames())
  }

  parse(type: ArgumentValue): string {
    return type.value
  }
}

async function prepare(pass: string) {
  const passArr = new TextEncoder().encode(pass)
  const digest = await crypto.subtle.digest(
    'SHA-256',
    passArr,
  )
    .then((buffer) => new Uint8Array(buffer))
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    digest,
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  )
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: digest.slice(0, 16),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
  return { key, iv: digest.slice(0, 12) }
}
async function encrypt(plain: string, pass: string) {
  const { key, iv } = await prepare(pass)

  return await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plain),
  )
    .then((
      buffer,
    ) => new Uint8Array(buffer))
    .then((arr) => btoa(String.fromCharCode(...arr)))
}

async function decrypt(encrypted: string, pass: string) {
  const { key, iv } = await prepare(pass)

  return await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    Uint8Array.from(atob(encrypted), (char) => char.charCodeAt(0)).buffer,
  )
    .then((buffer) => new TextDecoder().decode(buffer))
}

new Command()
  .name('totp')
  .type('name', new NameType())
  .arguments('<name:name>')
  .option('-a --add', 'add entry')
  .option('-d --delete', 'delete entry', { conflicts: ['add'] })
  .action(async function (
    { add: isAdd, 'delete': isDelete },
    name,
  ) {
    const db = await prepareDb()
    if (isAdd) {
      const plainSecret = await Secret.prompt({
        message: 'Enter totp secret',
        writer: Deno.stderr,
      })
      const pass = await Secret.prompt({
        message: 'Enter passphrase',
        writer: Deno.stderr,
      })
      db.setSecret(name, plainSecret, pass)
      return
    }

    if (isDelete) {
      await db.remove(name)
      return
    }

    const secret = await db.getSecret(name)
    const pass = await Secret.prompt({
      message: 'Enter passphrase',
      writer: Deno.stderr,
    })
    const plainSecret = await secret.decrypt(pass)
    const totp = new TOTP({
      issuer: 'ACME',
      label: name,
      algorithm: 'SHA-1',
      digits: 6,
      period: 30,
      secret: plainSecret,
    }).generate()
    console.log(totp)
  })
  .command('completions', new CompletionsCommand())
  .hidden()
  .parse(Deno.args)
