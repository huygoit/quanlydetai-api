import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { Worker } from 'bullmq'
import CallForProposal from '#models/call_for_proposal'
import CallForProposalService from '#services/call_for_proposal_service'
import {
  CFP_EMAIL_QUEUE_NAME,
  type CfpEmailJobPayload,
  closeCfpEmailQueue,
} from '#queues/cfp_email_queue'
import { closeRedisConnection, getRedisConnectionOptions } from '#queues/redis_connection'

/**
 * Worker BullMQ: gửi email broadcast CFP tách khỏi HTTP API.
 * Chạy: npm run worker:cfp-email
 *       node ace cfp:email-worker
 */
export default class CfpEmailWorker extends BaseCommand {
  static commandName = 'cfp:email-worker'
  static description = 'Chạy worker BullMQ gửi email thông báo tuyển chọn (CFP)'

  static options: CommandOptions = {
    startApp: true,
    staysAlive: true,
  }

  async run() {
    const connection = getRedisConnectionOptions()
    this.logger.info(
      `CFP email worker lắng nghe queue "${CFP_EMAIL_QUEUE_NAME}" @ ${connection.host}:${connection.port}`
    )

    const worker = new Worker<CfpEmailJobPayload>(
      CFP_EMAIL_QUEUE_NAME,
      async (job) => {
        const cfpId = Number(job.data.cfpId)
        const resumeJobId =
          job.data.resumeJobId != null ? Number(job.data.resumeJobId) : undefined
        this.logger.info(
          `Job ${job.id}: broadcast CFP #${cfpId}${resumeJobId ? ` (resume #${resumeJobId})` : ''}`
        )

        const cfp = await CallForProposal.find(cfpId)
        if (!cfp) {
          throw new Error(`CFP_NOT_FOUND:${cfpId}`)
        }
        if (cfp.status !== 'PUBLISHED') {
          throw new Error(`CFP_NOT_PUBLISHED:${cfpId}`)
        }

        await CallForProposalService.enqueueBroadcast(cfp, {
          resumeJobId: resumeJobId && resumeJobId > 0 ? resumeJobId : undefined,
        })
        this.logger.success(`Job ${job.id}: xong CFP #${cfpId}`)
      },
      {
        connection,
        // 1 broadcast nặng / lần — tránh nhiều vòng SMTP song song trong 1 worker
        concurrency: 1,
      }
    )

    worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.id} thất bại: ${err.message}`)
    })

    worker.on('error', (err) => {
      this.logger.error(`Worker error: ${err.message}`)
    })

    const shutdown = async () => {
      this.logger.info('Đang dừng CFP email worker…')
      await worker.close()
      await closeCfpEmailQueue()
      await closeRedisConnection()
      this.terminate()
    }

    process.on('SIGINT', () => void shutdown())
    process.on('SIGTERM', () => void shutdown())
  }
}
