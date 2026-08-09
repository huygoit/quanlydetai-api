import { Redis } from 'ioredis'
import env from '#start/env'

let shared: Redis | null = null

/**
 * Kết nối Redis dùng chung cho BullMQ.
 * BullMQ yêu cầu maxRetriesPerRequest = null trên connection của Worker.
 */
export function getRedisConnection(): Redis {
  if (shared) return shared

  const host = (env.get('REDIS_HOST') || '127.0.0.1').trim()
  const port = Number(env.get('REDIS_PORT') || 6379)
  const password = (env.get('REDIS_PASSWORD') || '').trim() || undefined

  shared = new Redis({
    host,
    port,
    password,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  })

  return shared
}

export function getRedisConnectionOptions() {
  const host = (env.get('REDIS_HOST') || '127.0.0.1').trim()
  const port = Number(env.get('REDIS_PORT') || 6379)
  const password = (env.get('REDIS_PASSWORD') || '').trim() || undefined
  return {
    host,
    port,
    password,
    maxRetriesPerRequest: null as null,
  }
}

export async function closeRedisConnection() {
  if (shared) {
    await shared.quit().catch(() => undefined)
    shared = null
  }
}
