import path from 'node:path'
import XLSX from 'xlsx'
import db from '@adonisjs/lucid/services/db'
import ScientificProfile from '#models/scientific_profile'
import Staff from '#models/staff'
import Publication from '#models/publication'
import PublicationAuthor from '#models/publication_author'
import ResearchOutputType from '#models/research_output_type'

type ImportOptions = {
  file: string
  publicationSheet: string
  detailSheet: string
  dryRun?: boolean
}

type ImportSummary = {
  totalPublications: number
  createdPublications: number
  updatedPublications: number
  skippedPublications: number
  createdAuthors: number
  errors: string[]
  warnings: string[]
}

type PublicationRow = {
  stt: number | null
  maBaiBao: string
  tenBaiBao: string
  tongThanhVien: number | null
  maLoaiCongViec: string
  tenLoaiPhanCap: string
  tenTapChi: string
  ngayDang: string
  namXuatBan: number | null
  nhaXuatBan: string
  trangThai: string
  yeuCauHieuChinh: string
  canBoKeKhai: string
  thoiDiemKeKhai: string
}

type PublicationDetailRow = {
  maBaiBao: string
  maDonVi: string
  tenDonVi: string
  tenDonViMoi: string
  maCanBo: string
  hoTenCanBo: string
  tenVaiTro: string
  gioNckh: number | null
  doiTuong: string
}

const UDN_UNIT = 'The University of Danang (Đại học Đà Nẵng)'
const OTHER_UNIT = 'Other Organization (Đơn vị khác)'

function normalizeText(raw: unknown): string {
  return String(raw ?? '').trim()
}

function normalizeTextLoose(raw: unknown): string {
  return normalizeText(raw)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function toNumber(raw: unknown): number | null {
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function parseExcelDate(raw: unknown): string {
  if (raw == null) return ''
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const d = XLSX.SSF.parse_date_code(raw)
    if (!d) return ''
    const y = String(d.y).padStart(4, '0')
    const m = String(d.m).padStart(2, '0')
    const day = String(d.d).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  const s = normalizeText(raw)
  if (!s) return ''
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (m) {
    const day = m[1]!.padStart(2, '0')
    const month = m[2]!.padStart(2, '0')
    const year = m[3]!
    return `${year}-${month}-${day}`
  }
  return s
}

function mapLeafCode(maLoaiCongViec: string, tenLoaiPhanCap: string): string | null {
  const loai = normalizeTextLoose(maLoaiCongViec)
  const cap = normalizeTextLoose(tenLoaiPhanCap)

  if (loai.includes('bbmuc1')) {
    if (cap.includes('q1')) return 'QD_R2'
    if (cap.includes('q2')) return 'QD_R3'
    if (cap.includes('q3')) return 'QD_R4'
    if (cap.includes('q4')) return 'QD_R5'
    return 'QD_R6'
  }
  if (loai.includes('bbmuc2')) {
    if (cap.includes('q1')) return 'QD_R7'
    if (cap.includes('q2')) return 'QD_R8'
    if (cap.includes('q3')) return 'QD_R9'
    if (cap.includes('q4')) return 'QD_R10'
    return 'QD_R11'
  }
  return null
}

function inferAffiliation(detail: PublicationDetailRow): {
  affiliationUnits: string[]
  affiliationType: 'UDN_ONLY' | 'MIXED' | 'OUTSIDE'
  isMultiAffiliationOutsideUdn: boolean
} {
  const donVi = normalizeTextLoose(detail.tenDonViMoi || detail.tenDonVi)
  const doiTuong = normalizeTextLoose(detail.doiTuong)
  const isUdn =
    doiTuong.includes('giang vien') ||
    donVi.includes('đại học đà nẵng') ||
    donVi.includes('dai hoc da nang') ||
    donVi.includes('truong dai hoc') ||
    donVi.includes('the university of danang')

  if (isUdn) {
    return {
      affiliationUnits: [UDN_UNIT],
      affiliationType: 'UDN_ONLY',
      isMultiAffiliationOutsideUdn: false,
    }
  }
  return {
    affiliationUnits: [OTHER_UNIT],
    affiliationType: 'OUTSIDE',
    isMultiAffiliationOutsideUdn: false,
  }
}

async function buildResearchOutputTypeMap() {
  const rows = await ResearchOutputType.query()
    .whereIn('code', ['QD_R2', 'QD_R3', 'QD_R4', 'QD_R5', 'QD_R6', 'QD_R7', 'QD_R8', 'QD_R9', 'QD_R10', 'QD_R11'])
    .select('id', 'code')
  const map = new Map<string, number>()
  for (const row of rows) {
    map.set(String(row.code).toUpperCase(), row.id)
  }
  return map
}

async function buildProfileNameMap() {
  const profiles = await ScientificProfile.query().select('id', 'full_name')
  const map = new Map<string, number>()
  for (const p of profiles) {
    const k = normalizeTextLoose(p.fullName)
    if (k && !map.has(k)) map.set(k, p.id)
  }
  return map
}

async function buildProfileByStaffCodeMap() {
  const staffs = await Staff.query().select('staff_code', 'user_id')
  const userIds = staffs
    .map((s) => Number(s.userId))
    .filter((id) => Number.isFinite(id) && id > 0)
  const profiles = userIds.length
    ? await ScientificProfile.query().whereIn('user_id', Array.from(new Set(userIds))).select('id', 'user_id')
    : []
  const profileByUserId = new Map<number, number>()
  for (const p of profiles) {
    if (p.userId) profileByUserId.set(Number(p.userId), p.id)
  }
  const map = new Map<string, number>()
  for (const s of staffs) {
    const key = normalizeTextLoose(s.staffCode)
    const uid = Number(s.userId)
    const pid = profileByUserId.get(uid)
    if (key && pid && !map.has(key)) map.set(key, pid)
  }
  return map
}

function parsePublicationRows(rows: Record<string, unknown>[]): PublicationRow[] {
  return rows.map((r) => ({
    stt: toNumber(r['Stt']),
    maBaiBao: normalizeText(r['Mã bài báo']),
    tenBaiBao: normalizeText(r['Tên bài báo']),
    tongThanhVien: toNumber(r['Tổng số thành viên']),
    maLoaiCongViec: normalizeText(r['Mã loại công việc']),
    tenLoaiPhanCap: normalizeText(r['Tên loại phân cấp']),
    tenTapChi: normalizeText(r['Tên tạp chí']),
    ngayDang: parseExcelDate(r['Ngày đăng']),
    namXuatBan: toNumber(r['Năm XB']),
    nhaXuatBan: normalizeText(r['Nhà xuất bản']),
    trangThai: normalizeText(r['Trạng thái']),
    yeuCauHieuChinh: normalizeText(r['Yêu cầu hiệu chỉnh']),
    canBoKeKhai: normalizeText(r['Cán bộ kê khai']),
    thoiDiemKeKhai: parseExcelDate(r['Thời điểm kê khai']),
  }))
}

function parseDetailRows(rows: Record<string, unknown>[]): PublicationDetailRow[] {
  let currentCode = ''
  return rows.map((r) => {
    const rawCode = normalizeText(r['Mã bài báo'])
    if (rawCode) currentCode = rawCode
    return {
      // Sheet chi tiết thường merge ô "Mã bài báo"; các dòng bên dưới để trống.
      // Dùng mã gần nhất phía trên để không làm rơi tác giả.
      maBaiBao: rawCode || currentCode,
      maDonVi: normalizeText(r['Mã đơn vị']),
      tenDonVi: normalizeText(r['Tên đơn vị']),
      tenDonViMoi: normalizeText(r['Tên đơn vị mới']),
      maCanBo: normalizeText(r['Mã cán bộ']),
      hoTenCanBo: normalizeText(r['Họ tên cán bộ']),
      tenVaiTro: normalizeText(r['Tên vai trò']),
      gioNckh: toNumber(r['Giờ NCKH']),
      doiTuong: normalizeText(r['Đối tượng']),
    }
  })
}

export default class PublicationExcelImportService {
  static async run(options: ImportOptions): Promise<ImportSummary> {
    const file = path.resolve(options.file)
    const wb = XLSX.readFile(file)
    const shPub = wb.Sheets[options.publicationSheet]
    const shDetail = wb.Sheets[options.detailSheet]
    if (!shPub) throw new Error(`Không tìm thấy sheet ${options.publicationSheet}`)
    if (!shDetail) throw new Error(`Không tìm thấy sheet ${options.detailSheet}`)

    const rawPubRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(shPub, { defval: '' })
    const rawDetailRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(shDetail, { defval: '' })
    const pubs = parsePublicationRows(rawPubRows)
    const details = parseDetailRows(rawDetailRows)

    const detailsByCode = new Map<string, PublicationDetailRow[]>()
    for (const d of details) {
      if (!d.maBaiBao) continue
      const list = detailsByCode.get(d.maBaiBao) ?? []
      list.push(d)
      detailsByCode.set(d.maBaiBao, list)
    }

    const typeMap = await buildResearchOutputTypeMap()
    const profileMap = await buildProfileNameMap()
    const profileByStaffCodeMap = await buildProfileByStaffCodeMap()

    const summary: ImportSummary = {
      totalPublications: pubs.length,
      createdPublications: 0,
      updatedPublications: 0,
      skippedPublications: 0,
      createdAuthors: 0,
      errors: [],
      warnings: [],
    }

    for (const row of pubs) {
      if (!row.maBaiBao || !row.tenBaiBao) {
        summary.skippedPublications++
        continue
      }
      const leafCode = mapLeafCode(row.maLoaiCongViec, row.tenLoaiPhanCap)
      if (!leafCode) {
        summary.errors.push(`[${row.maBaiBao}] Không map được mã loại công việc: ${row.maLoaiCongViec}`)
        continue
      }
      const typeId = typeMap.get(leafCode)
      if (!typeId) {
        summary.errors.push(`[${row.maBaiBao}] Không tìm thấy research_output_type code=${leafCode}`)
        continue
      }
      let dRows = (detailsByCode.get(row.maBaiBao) ?? []).filter((x) => normalizeText(x.hoTenCanBo))
      if (row.tongThanhVien != null && Number.isFinite(row.tongThanhVien) && dRows.length > 0) {
        const expected = Number(row.tongThanhVien)
        if (expected > 0 && dRows.length !== expected) {
          summary.warnings.push(
            `[${row.maBaiBao}] Tổng số thành viên sheet chính=${expected} nhưng sheet chi tiết đọc được=${dRows.length}`
          )
        }
      }
      if (dRows.length === 0) {
        const tenKeKhai = normalizeText(row.canBoKeKhai)
        if (!tenKeKhai) {
          summary.errors.push(`[${row.maBaiBao}] Không có chi tiết tác giả và cũng thiếu Cán bộ kê khai`)
          continue
        }
        dRows = [
          {
            maBaiBao: row.maBaiBao,
            maDonVi: '',
            tenDonVi: '',
            tenDonViMoi: '',
            maCanBo: '',
            hoTenCanBo: tenKeKhai,
            tenVaiTro: 'Tác giả đứng đầu',
            gioNckh: null,
            doiTuong: 'Giảng viên',
          },
        ]
        summary.warnings.push(
          `[${row.maBaiBao}] Thiếu sheet chi tiết tác giả, dùng Cán bộ kê khai làm tác giả duy nhất`
        )
      }
      const uuTienChuBai = [...dRows].sort((a, b) => {
        const ra = normalizeTextLoose(a.tenVaiTro)
        const rb = normalizeTextLoose(b.tenVaiTro)
        const sa = ra.includes('dung dau') ? 1 : ra.includes('lien he') ? 2 : 3
        const sb = rb.includes('dung dau') ? 1 : rb.includes('lien he') ? 2 : 3
        return sa - sb
      })
      let ownerProfileId: number | undefined
      for (const d of uuTienChuBai) {
        const byCode = profileByStaffCodeMap.get(normalizeTextLoose(d.maCanBo))
        if (byCode) {
          ownerProfileId = byCode
          break
        }
      }
      if (!ownerProfileId) {
        ownerProfileId = profileMap.get(normalizeTextLoose(row.canBoKeKhai))
      }
      if (!ownerProfileId) {
        summary.errors.push(
          `[${row.maBaiBao}] Không tìm thấy profile chủ bài từ Mã cán bộ (sheet chi tiết) hoặc Cán bộ kê khai: ${row.canBoKeKhai}`
        )
        continue
      }
      const authorNames = dRows.map((d) => d.hoTenCanBo.trim()).filter(Boolean)
      const uniqueAuthorNames = [...new Set(authorNames)]
      const authorsText = uniqueAuthorNames.join(', ')
      const corresponding = dRows.find((d) => normalizeTextLoose(d.tenVaiTro).includes('lien he'))
      const firstAuthor = dRows.find((d) => normalizeTextLoose(d.tenVaiTro).includes('dung dau'))
      const journalOrConference = normalizeText(row.tenTapChi).replace(/\s+/g, ' ').trim() || 'Không rõ nguồn công bố'

      if (options.dryRun) {
        const existed = await Publication.query()
          .where('profile_id', ownerProfileId)
          .where('source', 'INTERNAL')
          .where('source_id', `IMPORT_BAIBAO_${row.maBaiBao}`)
          .first()
        if (existed) summary.updatedPublications++
        else summary.createdPublications++
        summary.createdAuthors += dRows.length
        continue
      }

      await db.transaction(async (trx) => {
        let pub = await Publication.query({ client: trx })
          .where('profile_id', ownerProfileId)
          .where('source', 'INTERNAL')
          .where('source_id', `IMPORT_BAIBAO_${row.maBaiBao}`)
          .first()

        const payload = {
          profileId: ownerProfileId,
          researchOutputTypeId: typeId,
          title: row.tenBaiBao,
          authors: authorsText,
          correspondingAuthor: corresponding?.hoTenCanBo || null,
          myRole: firstAuthor ? 'CHU_TRI' : 'DONG_TAC_GIA',
          publicationType: 'JOURNAL',
          journalOrConference,
          year: row.namXuatBan,
          rank: leafCode.startsWith('QD_R2') || leafCode.startsWith('QD_R3') || leafCode.startsWith('QD_R4') || leafCode.startsWith('QD_R5') || leafCode.startsWith('QD_R6') ? 'ISI' : 'SCOPUS',
          quartile:
            leafCode === 'QD_R2'
              ? 'Q1'
              : leafCode === 'QD_R3'
                ? 'Q2'
                : leafCode === 'QD_R4'
                  ? 'Q3'
                  : leafCode === 'QD_R5'
                    ? 'Q4'
                    : leafCode === 'QD_R6' || leafCode === 'QD_R11'
                      ? 'NO_Q'
                      : null,
          doi: null,
          issn: null,
          isbn: null,
          url: null,
          publicationStatus: 'PUBLISHED',
          source: 'INTERNAL',
          sourceId: `IMPORT_BAIBAO_${row.maBaiBao}`,
          verifiedByNcv: false,
          approvedInternal: null,
          needsIndexConfirmation: false,
          indexMappedCode: leafCode,
          indexMappingReason: `Import từ Excel: ${options.publicationSheet}`,
        } as const

        if (pub) {
          pub.merge(payload)
          await pub.save()
          summary.updatedPublications++
          await PublicationAuthor.query({ client: trx }).where('publication_id', pub.id).delete()
        } else {
          pub = await Publication.create(payload, { client: trx })
          summary.createdPublications++
        }

        let order = 1
        for (const d of dRows) {
          const role = normalizeTextLoose(d.tenVaiTro)
          const isMain = role.includes('dung dau')
          const isCorr = role.includes('lien he')
          const authorProfileId =
            profileByStaffCodeMap.get(normalizeTextLoose(d.maCanBo)) ??
            profileMap.get(normalizeTextLoose(d.hoTenCanBo)) ??
            null
          const aff = inferAffiliation(d)
          await PublicationAuthor.create(
            {
              publicationId: pub.id,
              profileId: authorProfileId,
              fullName: d.hoTenCanBo,
              authorOrder: order++,
              isMainAuthor: isMain,
              isCorresponding: isCorr,
              affiliationType: aff.affiliationType,
              affiliationUnits: aff.affiliationUnits,
              isMultiAffiliationOutsideUdn: aff.isMultiAffiliationOutsideUdn,
              contributionPercent: null,
            },
            { client: trx }
          )
          summary.createdAuthors++
        }
      })
    }

    return summary
  }
}
