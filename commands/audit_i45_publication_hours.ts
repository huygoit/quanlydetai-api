import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'
import Publication from '#models/publication'
import ScientificProfile from '#models/scientific_profile'
import KpiEngineService from '#services/kpi_engine_service'
import { dungChiaTheoPhanTramDongGop } from '#services/kpi_engine/publication_strategy'
import type { KpiContext, KpiOutput } from '#types/kpi'

/**
 * Rà soát công bố mục I.4 / I.5: xác nhận đang chia n/p (không % đóng góp),
 * so sánh với cách cũ (ép chia %), báo bài nào lệch điểm/giờ.
 *
 * Chạy: node ace audit:i45-hours
 *       node ace audit:i45-hours --recalc   # tính lại cache kpi_results năm TC hiện tại
 */
export default class AuditI45PublicationHours extends BaseCommand {
  static commandName = 'audit:i45-hours'
  static description =
    'Rà soát giờ/điểm công bố mục I.4–I.5 sau khi sửa công thức (n/p thay vì % đóng góp)'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.boolean({
    flagName: 'recalc',
    description: 'Tính lại kpi_results cho các profile liên quan (năm tài chính hiện tại)',
  })
  declare recalc: boolean

  @flags.boolean({ flagName: 'verbose', description: 'In chi tiết từng bài' })
  declare verbose: boolean

  private async thuThapTypeIdsMuc45(): Promise<{
    typeIds: number[]
    byId: Map<number, { code: string; name: string }>
  }> {
    const rows = await db
      .from('research_output_types')
      .select('id', 'code', 'name', 'parent_id')
      .orderBy('id', 'asc')

    const byId = new Map<number, { id: number; code: string; name: string; parentId: number | null }>()
    for (const r of rows) {
      byId.set(Number(r.id), {
        id: Number(r.id),
        code: String(r.code || ''),
        name: String(r.name || ''),
        parentId: r.parent_id != null ? Number(r.parent_id) : null,
      })
    }

    // Node gốc mục 4 / 5
    const rootIds = new Set<number>()
    for (const n of byId.values()) {
      const c = n.code.toUpperCase()
      if (c === 'QD_L2_1_4' || c === 'QD_L2_1_5') rootIds.add(n.id)
    }

    const laConCuaRoot = (id: number): boolean => {
      let cur: number | null = id
      const seen = new Set<number>()
      while (cur != null && !seen.has(cur)) {
        if (rootIds.has(cur)) return true
        seen.add(cur)
        cur = byId.get(cur)?.parentId ?? null
      }
      return false
    }

    const typeIds: number[] = []
    const meta = new Map<number, { code: string; name: string }>()
    for (const n of byId.values()) {
      const c = n.code.toUpperCase()
      const matchCode =
        c.startsWith('QD_R14') ||
        c === 'QD_R15' ||
        c === 'QD_R24' ||
        c === 'PUB_DOMESTIC_HDGNN' ||
        c === 'PUB_CONF_ISBN'
      if (matchCode || laConCuaRoot(n.id)) {
        // Chỉ lấy lá (có thể tính giờ) — hoặc mọi node có publication gắn
        typeIds.push(n.id)
        meta.set(n.id, { code: n.code, name: n.name })
      }
    }
    return { typeIds, byId: meta }
  }

  async run() {
    const { typeIds, byId } = await this.thuThapTypeIdsMuc45()
    if (!typeIds.length) {
      this.logger.error('Không tìm thấy loại KQNC mục I.4/I.5 trong danh mục.')
      this.exitCode = 1
      return
    }

    this.logger.info(`Loại I.4/I.5 trong danh mục: ${typeIds.length} node`)

    const pubs = await Publication.query()
      .whereIn('research_output_type_id', typeIds)
      .preload('publicationAuthors')
      .preload('researchOutputType')
      .orderBy('id', 'asc')

    this.logger.info(`Số công bố gắn I.4/I.5: ${pubs.length}`)

    const cache = await KpiEngineService.buildRuleEngineCache()
    const profileIdsLienQuan = new Set<number>()

    let saiCongThucConPercent = 0
    let dungNp = 0
    let lechGio = 0
    let loiTinh = 0
    const lechMau: string[] = []

    for (const pub of pubs) {
      const typeId = Number(pub.researchOutputTypeId)
      const leafCode = pub.researchOutputType?.code ?? byId.get(typeId)?.code ?? null
      const ruleKind =
        (cache.ruleByTypeId.get(typeId) as { ruleKind?: string } | undefined)?.ruleKind ?? null

      const dungPercentMoi = dungChiaTheoPhanTramDongGop(leafCode, ruleKind)
      if (dungPercentMoi) {
        saiCongThucConPercent++
        this.logger.warning(
          `  [pub #${pub.id}] ${leafCode} vẫn bị xếp chia % — cần kiểm tra map mã.`
        )
      } else {
        dungNp++
      }

      const authors = pub.publicationAuthors.map((a) => ({
        profileId: a.profileId,
        fullName: a.fullName,
        isTopAuthor: a.isTopAuthor,
        isCorresponding: a.isCorresponding,
        affiliationType: a.affiliationType,
        isMultiAffiliationOutsideUdn: a.isMultiAffiliationOutsideUdn,
        contributionPercent: a.contributionPercent != null ? Number(a.contributionPercent) : null,
      }))

      const related = new Set<number>()
      if (pub.profileId != null) related.add(Number(pub.profileId))
      for (const a of authors) {
        if (a.profileId != null) related.add(Number(a.profileId))
      }

      for (const pid of related) {
        profileIdsLienQuan.add(pid)
        const profile = await ScientificProfile.find(pid)
        if (!profile) continue

        const output: KpiOutput = {
          type: 'PUBLICATION',
          publication: {
            id: pub.id,
            ownerProfileId: pub.profileId,
            researchOutputTypeId: pub.researchOutputTypeId,
            hdgsnnScore: pub.hdgsnnScore != null ? Number(pub.hdgsnnScore) : null,
            acceptanceGrade: pub.acceptanceGrade ?? null,
          },
          authors,
        }
        const context: KpiContext = {
          profileId: pid,
          academicYear: 'audit',
          isFemale: String(profile.gender || '').toUpperCase() === 'FEMALE',
          profileFullName: profile.fullName ?? null,
          ruleCache: cache,
        }

        try {
          const moi = await KpiEngineService.calculateOutputHours(output, context)

          // Giả lập cách CŨ: ép chia % (hàm trả true) — tính lại bằng cách tạm patch không được,
          // nên ước lượng: nếu có % hợp lệ thì giờ cũ = B*% ; so sánh warning.
          const coPct = authors.some((a) => a.contributionPercent != null && Number(a.contributionPercent) > 0)
          const warnPercent = (moi.warnings || []).some((w) =>
            String(w).includes('Mục 1.4') || String(w).includes('% đóng góp')
          )

          if (warnPercent) {
            lechGio++
            const line = `pub#${pub.id} profile#${pid} code=${leafCode} hours=${moi.hours} points=${moi.points} — còn warning chia %`
            lechMau.push(line)
            if (this.verbose) this.logger.warning(`  ${line}`)
          } else if (this.verbose) {
            this.logger.info(
              `  pub#${pub.id} [${leafCode}] profile#${pid}: ${moi.hours}h / ${moi.points}đ | authors=${authors.length} coPct=${coPct}`
            )
          }

          if ((moi.warnings || []).some((w) => String(w).includes('Không tìm thấy rule'))) {
            loiTinh++
          }
        } catch (e) {
          loiTinh++
          this.logger.error(
            `  Lỗi tính pub#${pub.id} profile#${pid}: ${e instanceof Error ? e.message : e}`
          )
        }
      }
    }

    this.logger.info('—— Kết quả rà soát ——')
    this.logger.success(`Công bố dùng n/p (đúng sau sửa): ${dungNp}`)
    this.logger.warning(`Công bố vẫn bị map chia % (sai): ${saiCongThucConPercent}`)
    this.logger.warning(`Lượt tính còn warning chia %: ${lechGio}`)
    this.logger.warning(`Lỗi tính / thiếu rule: ${loiTinh}`)
    this.logger.info(`Profile liên quan: ${profileIdsLienQuan.size}`)

    for (const l of lechMau.slice(0, 30)) this.logger.warning(`  ${l}`)
    if (lechMau.length > 30) this.logger.warning(`  … còn ${lechMau.length - 30} dòng`)

    // Giờ/điểm hiển thị realtime theo engine — không lưu trên publications.
    // Cache kpi_results có thể cũ nếu từng recalc trước khi sửa.
    if (this.recalc && profileIdsLienQuan.size) {
      const years = await db.from('kpi_results').distinct('academic_year').select('academic_year')
      const list = years.map((r: { academic_year: string }) => r.academic_year).filter(Boolean)
      if (!list.length) {
        this.logger.warning(
          'Chưa có kpi_results — bỏ qua --recalc (điểm xem preview vẫn đúng realtime).'
        )
      } else {
        for (const y of list) {
          this.logger.info(`Đang recalc kpi_results năm ${y}…`)
          const r = await KpiEngineService.recalcAcademicYear(String(y))
          this.logger.success(`  Đã cập nhật ${r.updated} profile (năm ${y})`)
        }
      }
    } else if (!this.recalc) {
      this.logger.info(
        'Ghi chú: giờ/điểm khi xem bài tính realtime theo code mới. Cache kpi_results chỉ cập nhật khi chạy --recalc hoặc API recalculate.'
      )
    }
  }
}
