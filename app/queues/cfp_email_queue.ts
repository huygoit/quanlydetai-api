import { Queue } from 'bullmq'
import { getRedisConnectionOptions } from '#queues/redis_connection'

export const CFP_EMAIL_QUEUE_NAME = 'cfp-email-broadcast'

export type CfpEmailJobPayload = {
  cfpId: number
  /** Tiếp tục job DB cfp_email_jobs (bỏ qua mail đã SENT) */
  resumeJobId?: number | null
}

let queue: Queue<CfpEmailJobPayload> | null = null

export function getCfpEmailQueue(): Queue<CfpEmailJobPayload> {
  if (!queue) {
    queue = new Queue<CfpEmailJobPayload>(CFP_EMAIL_QUEUE_NAME, {
      connection: getRedisConnectionOptions(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
      },
    })
  }
  return queue
}

/**
 * Đẩy job broadcast mail CFP vào BullMQ (API không gửi SMTP trực tiếp).
 */
export async function enqueueCfpEmailBroadcast(payload: CfpEmailJobPayload) {
  const q = getCfpEmailQueue()
  const job = await q.add(
    'broadcast',
    {
      cfpId: Number(payload.cfpId),
      resumeJobId: payload.resumeJobId != null ? Number(payload.resumeJobId) : null,
    },
    {
      jobId: `cfp-broadcast-${payload.cfpId}-${payload.resumeJobId || 'new'}-${Date.now()}`,
    }
  )
  return job
}

export async function closeCfpEmailQueue() {
  if (queue) {
    await queue.close()
    queue = null
  }
}
