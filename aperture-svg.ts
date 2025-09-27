#!/usr/bin/env -S deno run

const svg = {
  _orders: [] satisfies string[] as string[],
  _size: { width: 0, height: 0 },
  _color: 'transparent',
  _pos: { x: 0, y: 0 },
  _angle: 0,
  _strokeWeight: 1,

  _normalizePos(x: number, y: number) {
    const r = Math.sqrt(x ** 2 + y ** 2)
    const theta = Math.atan2(y, x)
    return {
      x: r * Math.cos(theta - this._angle) + this._pos.x,
      y: r * Math.sin(theta - this._angle) + this._pos.y,
    }
  },
  createCanvas(width: number, height: number) {
    this._size = { width, height }
  },
  color(color: string) {
    this._color = color
  },
  translate(x: number, y: number) {
    this._pos = { x, y }
  },
  rotate(angle: number) {
    this._angle = angle
  },
  strokeWeight(weight: number) {
    this._strokeWeight = weight
  },
  path() {
    this._orders.push('<path d="')
  },
  endPath(attrs: { [name in string]: string | number }) {
    this._orders.push(
      `" ${
        Object.entries(attrs).map(([name, value]) => `${name}="${value}"`)
      } />`,
    )
  },
  arc(
    x: number,
    y: number,
    width: number,
    height: number,
    start: number,
    stop: number,
    mode: 'OPEN',
  ) {
    this.translate(this._pos.x + x, this._pos.y + y)
    const { x: sx, y: sy } = this._normalizePos(
      width / 2 * Math.cos(start),
      height / 2 * Math.sin(start),
    )
    const { x: ex, y: ey } = this._normalizePos(
      width / 2 * Math.cos(stop),
      height / 2 * Math.sin(stop),
    )
    this._orders.push(
      // `<path d="M ${sx} ${sy} A ${width / 2} ${height / 2} 0 0 1 ${ex} ${ey}" stroke-width="${this._strokeWeight}" stroke="black" fill-opacity="0"/>`,
      `M ${sx} ${sy} A ${width / 2} ${height / 2} 0 0 1 ${ex} ${ey}`,
    )
    this.translate(this._pos.x - x, this._pos.y - y)
  },
  line(x1: number, y1: number, x2: number, y2: number) {
    const { x: nx1, y: ny1 } = this._normalizePos(x1, y1)
    const { x: nx2, y: ny2 } = this._normalizePos(x2, y2)
    this._orders.push(
      // `<line x1="${nx1}" y1="${ny1}" x2="${nx2}" y2="${ny2}" stroke-width="${this._strokeWeight}" stroke="black" />`,
      // `M ${nx1} ${ny1} L ${nx2} ${ny2}`
      `L ${nx2} ${ny2}`,
    )
  },
  circle(x: number, y: number, radius: number) {
    const { x: nx, y: ny } = this._normalizePos(x, y)
    this._orders.push(
      `<circle cx="${nx}" cy="${ny}" r="${radius}" fill="${this._color}" />`,
    )
  },

  output() {
    return `
      <svg viewBox="0 0 ${this._size.width} ${this._size.height}" xmlns="http://www.w3.org/2000/svg">
        ${this._orders.join('\n')}
      </svg>
    `
  },
}
function setup() {}
function draw(bladeNumber: number, gapRate: number) {
  const bgColor = 220
  const size = 400
  const radiusRate = 0.85

  const maxGap = Math.PI / bladeNumber
  const blade = {
    number: bladeNumber,
    gapRadius: Math.min(maxGap * gapRate, maxGap),
  }

  const direction = [-1, 1][1]

  const center = size / 2
  svg.createCanvas(size, size)
  svg.color('transparent')

  const radius = (size * radiusRate) / 2
  const anglePerBlade = (2 * Math.PI) / blade.number

  svg.color('black')
  svg.circle(center, center, radius * 1.12)
  svg.color('white')
  svg.circle(center, center, radius * 1.1)

  svg.color('black')
  for (let i = 0; i < blade.number; i++) {
    // push()
    svg.translate(center, center)
    const angle = anglePerBlade * i
    svg.rotate(angle)

    const arcAngle = anglePerBlade / 2 - blade.gapRadius
    svg.strokeWeight(2)
    svg.path()
    svg.arc(0, 0, radius * 2, radius * 2, -arcAngle, arcAngle, 'OPEN')
    const [x1, y1, x2, y2, x3, y3] = [
      radius *
      (Math.cos(arcAngle) -
        (2 * Math.sin(arcAngle)) / Math.tan(anglePerBlade)),
      radius * Math.sin(arcAngle),
      radius * Math.cos(arcAngle),
      radius * Math.sin(arcAngle),
      radius * Math.cos(arcAngle),
      -radius * Math.sin(arcAngle),
    ]
    svg.line(x2, y2, x1, y1)
    svg.line(x1, y1, x3, y3)
    svg.endPath({ fill: 'black' })
    // pop()
  }

  console.log(svg.output())
}

draw(8, 0.1)
