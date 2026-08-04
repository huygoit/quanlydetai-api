import { DateTime } from 'luxon'

/** Đếm số ngày làm việc (T2–T6) từ start (exclusive ngày bắt đầu) đến end (inclusive). */
export function countBusinessDays(from: DateTime, to: DateTime): number {
  let start = from.startOf('day')
  const end = to.startOf('day')
  if (end <= start) return 0
  let count = 0
  let cursor = start.plus({ days: 1 })
  while (cursor <= end) {
    const wd = cursor.weekday // 1=Mon … 7=Sun
    if (wd >= 1 && wd <= 5) count++
    cursor = cursor.plus({ days: 1 })
  }
  return count
}

/** true nếu từ hôm nay đến meetingAt có ít nhất minDays ngày làm việc. */
export function hasAtLeastBusinessDays(meetingAt: DateTime, minDays = 5): boolean {
  return countBusinessDays(DateTime.now(), meetingAt) >= minDays
}

/**
 * Cộng thêm N ngày làm việc (T2–T6) kể từ `from`.
 * Kết quả = cuối ngày của ngày làm việc thứ N.
 */
export function addBusinessDays(from: DateTime, days: number): DateTime {
  let cursor = from.startOf('day')
  let added = 0
  const target = Math.max(0, Math.floor(days))
  while (added < target) {
    cursor = cursor.plus({ days: 1 })
    if (cursor.weekday >= 1 && cursor.weekday <= 5) added++
  }
  return cursor.endOf('day')
}
