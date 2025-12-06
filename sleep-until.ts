#!/usr/bin/env -S deno run --ext ts
import { delay } from 'jsr:@std/async'
import { Command } from 'https://deno.land/x/cliffy@v0.25.7/command/mod.ts'

const dayMs = 1000 * 60 * 60 * 24

function parseTime(ms: number) {
  const p = (num: number) => num.toString().padStart(2, '0')
  const h = p(Math.floor(ms / (60 * 60 * 1000)))
  const mi = p(Math.floor(ms / (60 * 1000)) % 60)
  const s = p(Math.floor(ms / 1000) % 60)
  return `${h}:${mi}.${s}`
}

async function main(_: unknown, time: string) {
  const times = (() => {
    const rawTimes = time.match(
      /((?<y>\d{4})\/(?<mo>\d{2})\/(?<d>\d{2}) )?(?<h>\d{2}):(?<mi>\d{2})/,
    )?.groups
    if (!rawTimes) {
      return
    }
    return Object.fromEntries(
      Object.entries(rawTimes).map(([key, rawValue]) => {
        const value = Number(rawValue)
        return [key, isNaN(value) ? null : value]
      }),
    )
  })()

  const deltaMs = (() => {
    const groups = [...time.matchAll(/(?<num>\d+)(?<unit>[a-z]+)/g)]
      .map(({ groups }) => groups)
      .filter((v) => v != null)
    const multipliers: { [unit in string]: number } = {
      ms: 1,
      s: 1000,
      m: 1000 * 60,
      h: 1000 * 60 * 60,
      d: 1000 * 60 * 60 * 24,
    }
    return groups.reduce(
      (sum, { num, unit }) => sum + Number(num) * (multipliers[unit] ?? 0),
      0,
    )
  })()

  const now = new Date()
  const target = new Date()
  if (times) {
    target.setFullYear(times.y ?? target.getFullYear())
    target.setMonth(times.mo ? times.mo - 1 : target.getMonth())
    target.setDate(times.d ?? target.getDate())
    target.setHours(times.h ?? 0)
    target.setMinutes(times.mi ?? 0)
    target.setSeconds(0)
    target.setMilliseconds(0)
  } else if (deltaMs) {
    target.setMilliseconds(target.getMilliseconds() + deltaMs)
  } else {
    throw new Error('引数の形式が不正です')
  }

  const targetTime = (() => {
    const time = target.getTime()
    if (time < now.getTime() && times?.d === null) {
      return time + dayMs
    } else {
      return time
    }
  })()
  const diff = targetTime - now.getTime()

  if (diff < 0) {
    throw new Error('過去の時間が指定されています')
  }

  const print = () => {
    const rest = parseTime(targetTime - Date.now())
    console.log('\x1b[1A\x1b[K' + rest)
  }
  print()
  await delay(diff % 1000)
  print()
  const intervalId = setInterval(print, 1000)
  while (true) {
    const cdiff = targetTime - Date.now()
    if (cdiff < 1000) {
      break
    }
    await delay(cdiff % 60000)
  }
  clearInterval(intervalId)
}

new Command()
  .name('sleep-until')
  .arguments('<time:string>')
  .action(main)
  .parse(Deno.args)
