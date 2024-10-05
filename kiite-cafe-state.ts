#!/usr/bin/env -S deno run -A

async function process() {
  const nop = await fetch(
    'https://cafeapi.kiite.jp/api/cafe/users?limit=50',
    {},
  )
    .then((r) => r.json())
    .then((j) => j.length) - 1

  const border = 13

  const { icon, backgroundColor } = (() => {
    if (nop < border) {
      return { icon: 'mdi-music-note-off-outline', backgroundColor: '#dddddd' }
    } else {
      return { icon: 'mdi-music-note-plus', backgroundColor: '#ffffbb' }
    }
  })()

  const params = {
    name: 'Kiite Cafe',
    body: `${String(nop).padStart(2, ' ')}人`,
    icon,
    backgroundColor,
  }

  new Deno.Command(
    '/mnt/e/data/git/state-viewer/dist/win-unpacked/state-viewer.exe',
    {
      args: Object.entries(params).map(([key, value]) => `${key}=${value}`),
    },
  ).spawn()
}

;[
  { func: process, interval: 1000 * 60 * 10 },
].forEach(({ func, interval }) => {
  setInterval(func, interval)
  func()
})
