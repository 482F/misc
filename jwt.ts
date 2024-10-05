#!/usr/bin/env -S deno run

import { createJWT, unsafeParseJWT } from 'jsr:@cross/jwt'

async function readStdin() {
  const decoder = new TextDecoder()
  let text = ''
  for await (const chunk of Deno.stdin.readable) {
    text += decoder.decode(chunk)
  }
  return text
}

function decodeJwt(body: string) {
  return unsafeParseJWT(body)
}

function encodeJwt(json: Record<string, unknown>) {
  return createJWT(json, false)
}

const body = await readStdin().then((b) => b.replaceAll(/^\n+|\n+$/g, ''))
const json = (() => {
  try {
    return JSON.parse(body)
  } catch (_e) {
    return null
  }
})()

if (json) {
  console.log(await encodeJwt(json))
} else {
  console.log(JSON.stringify(decodeJwt(body), null, '  '))
}
