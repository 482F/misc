#!/usr/bin/env -S deno run

const num = 18
const start = new Date('2026/10/01')

const phs = [
  '2026/10/12',
  '2026/11/03',
  '2026/11/23',
  '2026/12/28',
  '2026/12/29',
  '2026/12/30',
  '2026/12/31',
  '2027/01/01',
  '2027/01/11',
  '2027/02/11',
  '2027/02/23',
  '2027/03/22',
  '2027/04/29',
  '2027/05/03',
  '2027/05/04',
  '2027/05/05',
  '2027/07/19',
  '2027/08/11',
  '2027/09/20',
  '2027/09/23',
]
  .map((rd) => new Date(rd))

function main() {
  start.setDate(start.getDate() - start.getDay())
  function fd(date: Date) {
    const p = (num: number) => String(num).padStart(2, '0')
    const y = date.getFullYear()
    const m = p(date.getMonth() + 1)
    const d = p(date.getDate())
    const wd = '日月火水木金土'[date.getDay()]
    return `${y}/${m}/${d} (${wd})`
  }

  const mhs: Date[] = []
  while (mhs.length < num) {
    const hs = [...mhs, ...phs].toSorted((a, b) => a.getTime() - b.getTime())
    const weekNums = hs.map((h) => {
      return Math.floor(
        (h.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7),
      )
    })
    const diffs = weekNums.map((weekNum, i) =>
      (weekNums[i + 1] ?? weekNum) - weekNum
    )
    const [, maxDiffI] = diffs.reduce(
      ([max, maxI], current, currentI) =>
        max < current ? [current, currentI] : [max, maxI],
      [-Infinity, -1],
    )
    const diff = diffs[maxDiffI] ?? 0
    const filler = new Date(hs[maxDiffI + 1] ?? '')

    filler.setDate(filler.getDate() - Math.min(2, diff - 1) * 7)
    filler.setDate(filler.getDate() - filler.getDay() + 3) // wednesday

    // console.log({ hs: hs.map(fd), diffs, diff, maxDiffI, filler: fd(filler) })
    mhs.push(filler)
  }
  console.log(
    mhs.toSorted((a, b) => a.getTime() - b.getTime()).map(fd).join('\n'),
  )
}
main()
