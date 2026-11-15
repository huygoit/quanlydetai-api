import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { DateTime } from 'luxon'
import { BUDGET_LINE_CODES } from '#constants/module56'
import ProjectOutline from '#models/project_outline'
import User from '#models/user'
import ProjectFinalService from '#services/project_final_service'
import PermissionService from '#services/permission_service'

/**
 * Chạy thử US-06-01 → 06-06 (nhánh Đạt) trên một outline đang DANG_THUC_HIEN.
 * Ví dụ: node ace test:module6-flow --outline=1
 */
export default class TestModule6Flow extends BaseCommand {
  static commandName = 'test:module6-flow'
  static description = 'Test end-to-end Module 6 (US-06-01…06) nhánh Đạt yêu cầu'

  static options: CommandOptions = { startApp: true }

  @flags.number({ description: 'ID thuyết minh / outline', default: 1 })
  declare outline: number

  private logStep(label: string, st: string | null | undefined) {
    this.logger.success(`${label} → executionStatus=${st || 'null'}`)
  }

  private file(name: string, size = 1000) {
    return { fileName: name, fileUrl: `/storage/test/${name}`, fileSize: size }
  }

  async run() {
    const outlineId = Number(this.outline || 1)
    const outline = await ProjectOutline.find(outlineId)
    if (!outline) {
      this.logger.error(`Không tìm thấy outline #${outlineId}`)
      this.exitCode = 1
      return
    }
    if (!outline.ownerId) {
      this.logger.error('Outline chưa có ownerId (CNNV)')
      this.exitCode = 1
      return
    }
    const ownerId = outline.ownerId
    const admin =
      (await User.findBy('email', 'admin@university.edu.vn')) || (await User.query().first())
    if (!admin) {
      this.logger.error('Không có user admin')
      this.exitCode = 1
      return
    }
    const pkhId = admin.id

    // Lấy thêm user làm hội đồng (ưu tiên id khác owner/pkh)
    const extras = await User.query()
      .whereNotIn('id', [ownerId, pkhId])
      .orderBy('id', 'desc')
      .limit(4)
    if (extras.length < 3) {
      this.logger.error('Cần ≥ 3 user khác để lập hội đồng (1 thư ký + ≥2 phản biện)')
      this.exitCode = 1
      return
    }
    const thuKy = extras[0]!
    const pb1 = extras[1]!
    const pb2 = extras[2]!

    this.logger.info(
      `Outline #${outlineId} ${outline.code} | CNNV=${ownerId} PKH=${pkhId} | HĐ: CT=${pkhId} TK=${thuKy.id} PB=${pb1.id},${pb2.id}`
    )
    this.logger.info(`Trạng thái đầu: ${outline.executionStatus}`)

    try {
      // US-06-01
      await ProjectFinalService.notify(outlineId, pkhId)
      this.logStep('US-06-01 notify', (await load(outlineId)).executionStatus)

      const productName = (outline.expectedProducts || [])[0]?.name || 'Sản phẩm test'
      await ProjectFinalService.saveDossier(
        outlineId,
        ownerId,
        {
          summaryFile: this.file('bm10-tong-hop.pdf', 2_000_000),
          briefFile: this.file('bm10-tom-tat.pdf', 500_000),
          resultVi: 'Kết quả tiếng Việt — test flow Module 6',
          resultEn: 'English result — Module 6 flow test',
          publicationsNote: 'Không phát sinh ấn phẩm',
          products: [{ name: productName, link: 'https://example.com/sp' }],
        },
        true
      )
      this.logStep('US-06-01 nộp hồ sơ', (await load(outlineId)).executionStatus)

      await ProjectFinalService.pkhDossier(outlineId, pkhId, true, true, '')
      this.logStep('US-06-01 PKH duyệt → họp HĐ', (await load(outlineId)).executionStatus)

      // US-06-02
      await ProjectFinalService.saveCouncil(outlineId, pkhId, {
        meetingAt: DateTime.now().toISO(),
        location: 'Phòng họp A — test',
        members: [
          { userId: pkhId, role: 'CHU_TICH' },
          { userId: thuKy.id, role: 'THU_KY' },
          { userId: pb1.id, role: 'PHAN_BIEN' },
          { userId: pb2.id, role: 'PHAN_BIEN' },
        ],
      })
      this.logStep('US-06-02 lưu hội đồng', (await load(outlineId)).executionStatus)

      const general =
        'Nhận xét chung đủ dài cho BM.12a — kiểm thử tự động Module 6. '.repeat(3)
      for (const uid of [pb1.id, pb2.id]) {
        await ProjectFinalService.saveSheet(outlineId, uid, {
          volumeComment: 'Khối lượng đạt yêu cầu',
          qualityComment: 'Chất lượng đạt',
          reportComment: 'Báo cáo đầy đủ',
          generalComment: general,
          productRows: [{ name: productName, actual: 'Đã hoàn thành', comment: 'OK' }],
        })
      }
      this.logStep('US-06-02 phiếu phản biện', (await load(outlineId)).executionStatus)

      // US-06-03
      await ProjectFinalService.saveMinutes(outlineId, pkhId, {
        presentUserIds: [pkhId, thuKy.id, pb1.id, pb2.id],
        classification: 'DAT_YEU_CAU',
        discussion: 'Hội đồng thống nhất đánh giá đạt',
        volume: 'Khối lượng đủ',
        quality: 'Chất lượng đạt',
        recommendation: 'Không có kiến nghị bổ sung',
        productMarks: [{ name: productName, met: true }],
      })
      this.logStep('US-06-03 biên bản Đạt', (await load(outlineId)).executionStatus)

      // US-06-05 (bỏ 06-04 vì nhánh Đạt)
      const lines = BUDGET_LINE_CODES.map((code) => ({ code, declaredAmount: 0 }))
      await ProjectFinalService.saveSettlement(
        outlineId,
        ownerId,
        {
          lines,
          files: [this.file('quyet-toan.pdf', 100_000)],
        },
        true
      )
      this.logStep('US-06-05 nộp quyết toán', (await load(outlineId)).executionStatus)

      await ProjectFinalService.pkhSettlement(outlineId, pkhId, true, '')
      this.logStep('US-06-05 PKH → TC', (await load(outlineId)).executionStatus)

      // variance nếu cần — thử TC
      try {
        await ProjectFinalService.tcSettlement(
          outlineId,
          pkhId,
          true,
          DateTime.now().toISODate()!,
          ''
        )
      } catch (e: any) {
        if (String(e?.message) === 'FORBIDDEN') {
          // tìm user có budget_confirm
          const all = await User.query().limit(80)
          let tcId: number | null = null
          for (const u of all) {
            if (await PermissionService.userHasPermission(u.id, 'project.budget_confirm')) {
              tcId = u.id
              break
            }
          }
          if (!tcId) throw e
          await ProjectFinalService.tcSettlement(
            outlineId,
            tcId,
            true,
            DateTime.now().toISODate()!,
            ''
          )
        } else if (String(e?.message) === 'VARIANCE_UNACK') {
          await ProjectFinalService.ackVariance(outlineId, pkhId, 'Chênh sổ — test auto')
          await ProjectFinalService.tcSettlement(
            outlineId,
            pkhId,
            true,
            DateTime.now().toISODate()!,
            ''
          )
        } else {
          throw e
        }
      }
      this.logStep('US-06-05 TC xác nhận', (await load(outlineId)).executionStatus)

      // US-06-06
      await ProjectFinalService.saveLiquidation(outlineId, pkhId, {
        surplusHandling: 'KHONG_PHAT_SINH',
        assets: [{ name: 'Tài sản test', quantity: '1', amount: 0, note: '' }],
      })
      await ProjectFinalService.submitLiquidation(outlineId, pkhId)
      this.logStep('US-06-06 trình BGH', (await load(outlineId)).executionStatus)

      // BGH
      try {
        await ProjectFinalService.bghLiquidation(outlineId, pkhId, true, '')
      } catch (e: any) {
        if (String(e?.message) === 'FORBIDDEN') {
          const all = await User.query().limit(80)
          let bghId: number | null = null
          for (const u of all) {
            if (await PermissionService.userHasPermission(u.id, 'project.outline_approve')) {
              bghId = u.id
              break
            }
          }
          if (!bghId) throw e
          await ProjectFinalService.bghLiquidation(outlineId, bghId, true, '')
        } else throw e
      }
      this.logStep('US-06-06 BGH ký', (await load(outlineId)).executionStatus)

      try {
        await ProjectFinalService.publishLiquidation(outlineId, pkhId, 'TL-TEST-001')
      } catch (e: any) {
        if (String(e?.message) === 'FORBIDDEN') {
          const all = await User.query().limit(80)
          let pubId: number | null = null
          for (const u of all) {
            if (await PermissionService.userHasPermission(u.id, 'project.contract_publish')) {
              pubId = u.id
              break
            }
          }
          if (!pubId) throw e
          await ProjectFinalService.publishLiquidation(outlineId, pubId, 'TL-TEST-001')
        } else throw e
      }
      this.logStep('US-06-06 phát hành', (await load(outlineId)).executionStatus)

      await ProjectFinalService.cnnvLiquidation(outlineId, ownerId)
      const done = await load(outlineId)
      this.logStep('US-06-06 CNNV xác nhận', done.executionStatus)

      if (done.executionStatus !== 'HOAN_THANH') {
        this.logger.error('Kỳ vọng HOAN_THANH nhưng nhận ' + done.executionStatus)
        this.exitCode = 1
        return
      }
      this.logger.success('PASS: US-06-01 → 06-06 (nhánh Đạt) hoàn tất trên outline #' + outlineId)
    } catch (e: any) {
      this.logger.error(`FAIL tại bước: ${e?.message || e}`)
      try {
        this.logger.info(`executionStatus hiện tại: ${(await load(outlineId)).executionStatus}`)
      } catch {
        /* ignore */
      }
      this.exitCode = 1
    }
  }
}

async function load(id: number) {
  const row = await ProjectOutline.findOrFail(id)
  return row
}
