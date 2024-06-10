#!/usr/bin/env -S deno run

async function readStdin() {
  const decoder = new TextDecoder()
  let text = ''
  for await (const chunk of Deno.stdin.readable) {
    text += decoder.decode(chunk)
  }
  return text
}

const pyobj = await readStdin()
console.log(
  pyobj
    .replaceAll('"', '\\"')
    .replaceAll('\'', '"')
    .replaceAll('False', 'false')
    .replaceAll('True', 'true')
    .replaceAll('None', 'null'),
)
