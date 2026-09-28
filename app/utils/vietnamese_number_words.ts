/**
 * Đổi số sang chữ tiếng Việt (đủ dùng cho kinh phí hợp đồng).
 */
const CHU_SO = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']
const HANG = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ']

function docBaSo(n: number, full: boolean): string {
  const tram = Math.floor(n / 100)
  const chuc = Math.floor((n % 100) / 10)
  const donvi = n % 10
  const parts: string[] = []

  if (tram > 0 || full) {
    if (tram > 0) parts.push(`${CHU_SO[tram]} trăm`)
    else if (full && (chuc > 0 || donvi > 0)) parts.push('không trăm')
  }

  if (chuc > 1) {
    parts.push(`${CHU_SO[chuc]} mươi`)
    if (donvi === 1) parts.push('mốt')
    else if (donvi === 5) parts.push('lăm')
    else if (donvi > 0) parts.push(CHU_SO[donvi]!)
  } else if (chuc === 1) {
    parts.push('mười')
    if (donvi === 5) parts.push('lăm')
    else if (donvi > 0) parts.push(CHU_SO[donvi]!)
  } else if (donvi > 0) {
    if (full || tram > 0) parts.push('lẻ')
    parts.push(CHU_SO[donvi]!)
  }

  return parts.join(' ')
}

export function numberToVietnameseWords(amount: number): string {
  const n = Math.round(Math.abs(Number(amount) || 0))
  if (n === 0) return 'Không đồng'

  const groups: number[] = []
  let rest = n
  while (rest > 0) {
    groups.push(rest % 1000)
    rest = Math.floor(rest / 1000)
  }

  const parts: string[] = []
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i]!
    if (g === 0) continue
    const full = i < groups.length - 1
    const chunk = docBaSo(g, full)
    const hang = HANG[i] || ''
    parts.push(hang ? `${chunk} ${hang}` : chunk)
  }

  const text = parts.join(' ').replace(/\s+/g, ' ').trim()
  const capitalized = text.charAt(0).toUpperCase() + text.slice(1)
  return `${capitalized} đồng`
}

export function formatVndPlain(amount: number): string {
  return Math.round(Number(amount) || 0).toLocaleString('vi-VN')
}
