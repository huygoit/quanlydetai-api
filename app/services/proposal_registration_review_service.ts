import { DateTime } from 'luxon'
import User from '#models/user'
import ProposalRegistration from '#models/proposal_registration'
import ProposalRegistrationMember from '#models/proposal_registration_member'
import ProjectProposal from '#models/project_proposal'
import OfficialAssignment from '#models/official_assignment'
import ProjectOutline from '#models/project_outline'
import ScientificProfile from '#models/scientific_profile'
import Student from '#models/student'
import KpiResult from '#models/kpi_result'
import ProjectOutlineMember from '#models/project_outline_member'
import PermissionService from '#services/permission_service'
import NotificationService from '#services/notification_service'
import EmailLogService from '#services/email_log_service'
import ProjectOutlineService from '#services/project_outline_service'
import { LoiHoSoDangKy } from '#services/proposal_registration_service'
import {
  getScientificProfileAcademicTitleLabel,
  getScientificProfileDegreeLabel,
} from '#constants/scientific_profile_catalog'

const TRANG_PKH = ['CHO_PKH', 'DKDT_DUOC_CHAP_THUAN', 'DKDT_TU_CHOI'] as const
const TRANG_DONG_TM = ['KHONG_PHE_DUYET', 'BAOVE_KHONG_DAT']

function nhanHocVi(key?: string | null) {
  return getScientificProfileDegreeLabel(key) || key || null
}

function nhanHocHam(key?: string | null) {
  const ten = getScientificProfileAcademicTitleLabel(key)
  if (!ten || key === 'NONE') return null
  return ten
}

export default class ProposalRegistrationReviewService {
  private static async kiemTraPkh(user: User) {
    const duoc = await PermissionService.userHasPermission(user.id, 'project.review')
    if (!duoc) {
      throw new LoiHoSoDangKy('Chỉ Phòng Khoa học và Hợp tác quốc tế được xét duyệt đăng ký.')
    }
  }

  /** Bảng tổng hợp: mỗi nhiệm vụ một dòng, kèm người đã đăng ký */
  static async danhSachNhiemVu(user: User) {
    await this.kiemTraPkh(user)
    const rows = await ProposalRegistration.query()
      .whereIn('status', [...TRANG_PKH, 'CHO_DON_VI'])
      .preload('projectProposal', (q) =>
        q.select(
          'id',
          'code',
          'title',
          'source_idea_id',
          'catalog_registration_status',
          'catalog_registration_note'
        )
      )
      .orderBy('submitted_at', 'desc')

    const thanhVienTheoDon = await this.napThanhVien(rows.map((r) => Number(r.id)))
    const nhom = new Map<number, ProposalRegistration[]>()
    for (const row of rows) {
      const key = Number(row.projectProposalId)
      const list = nhom.get(key) || []
      list.push(row)
      nhom.set(key, list)
    }

    return [...nhom.entries()]
      .filter(([, ds]) => ds.some((d) => d.status !== 'CHO_DON_VI'))
      .map(([id, ds]) => {
      const nv = ds[0].projectProposal
      const choPhong = ds.filter((d) => d.status === 'CHO_PKH').length
      const chapThuan = ds.find((d) => d.status === 'DKDT_DUOC_CHAP_THUAN')
      return {
        id,
        code: nv?.code || '',
        title: nv?.title || '',
        soDon: ds.length,
        choDonVi: ds.filter((d) => d.status === 'CHO_DON_VI').length,
        choPhong,
        nguoiDangKy: ds.map((d) => {
          const tenTv = (thanhVienTheoDon.get(Number(d.id)) || [])
            .map((m) => m.fullName)
            .filter(Boolean)
          return {
            id: d.id,
            ten: tenTv.length ? tenTv.join(', ') : d.ownerName,
            donVi: d.ownerUnit,
            status: d.status,
          }
        }),
        trangThai: nv?.catalogRegistrationStatus || (chapThuan ? 'DA_CHAP_THUAN' : 'CHO_XET'),
        ghiChu: nv?.catalogRegistrationNote || null,
        chuNhiem: chapThuan?.ownerName || null,
      }
    })
  }

  /** So sánh các đơn của một nhiệm vụ */
  static async soSanh(user: User, nhiemVuId: number) {
    await this.kiemTraPkh(user)
    const nhiemVu = await ProjectProposal.find(nhiemVuId)
    if (!nhiemVu) throw new LoiHoSoDangKy('Không tìm thấy nhiệm vụ.')

    const ds = await ProposalRegistration.query()
      .where('project_proposal_id', nhiemVuId)
      .whereIn('status', [...TRANG_PKH, 'CHO_DON_VI'])
      .orderBy('submitted_at', 'desc')

    const thanhVienTheoDon = await this.napThanhVien(ds.map((d) => Number(d.id)))
    const profileIds = [
      ...new Set(
        [...thanhVienTheoDon.values()]
          .flat()
          .map((m) => m.profileId)
          .filter((id): id is number => !!id)
          .map(Number)
      ),
    ]
    const hoSoTheoId = new Map<number, ScientificProfile>()
    if (profileIds.length) {
      const hoSo = await ScientificProfile.query()
        .whereIn('id', profileIds)
        .select('id', 'user_id', 'degree', 'academic_title')
      for (const p of hoSo) hoSoTheoId.set(Number(p.id), p)
    }
    const ownerChuaCoHoSo = ds
      .map((d) => Number(d.ownerId))
      .filter((uid) => ![...hoSoTheoId.values()].some((p) => Number(p.userId) === uid))
    if (ownerChuaCoHoSo.length) {
      const them = await ScientificProfile.query()
        .whereIn('user_id', ownerChuaCoHoSo)
        .select('id', 'user_id', 'degree', 'academic_title')
      for (const p of them) hoSoTheoId.set(Number(p.id), p)
    }

    const studentIds = [
      ...new Set(
        [...thanhVienTheoDon.values()]
          .flat()
          .map((m) => m.studentId)
          .filter((id): id is number => !!id)
          .map(Number)
      ),
    ]
    const sinhVien = studentIds.length
      ? await Student.query().whereIn('id', studentIds).select('id', 'full_name', 'class_name', 'major_name')
      : []
    const sinhVienTheoId = new Map(sinhVien.map((s) => [Number(s.id), s]))

    const kpi = hoSoTheoId.size
      ? await KpiResult.query()
          .whereIn('profile_id', [...hoSoTheoId.keys()])
          .orderBy('academic_year', 'desc')
      : []
    const diem = new Map<number, number>()
    for (const row of kpi) {
      const pid = Number(row.profileId)
      if (!diem.has(pid)) diem.set(pid, Number(row.totalHours || 0))
    }

    const profileTheoUser = new Map(
      [...hoSoTheoId.values()]
        .filter((p) => p.userId != null)
        .map((p) => [Number(p.userId), p])
    )
    const dangLam = await this.demNhiemVuDangLam([...profileTheoUser.keys()], profileTheoUser)

    const giao = await OfficialAssignment.query().where('danh_muc_id', nhiemVuId).first()

    return {
      nhiemVu: {
        id: nhiemVu.id,
        code: nhiemVu.code,
        title: nhiemVu.title,
        ideaId: nhiemVu.sourceIdeaId,
        trangThai: nhiemVu.catalogRegistrationStatus,
        ghiChu: nhiemVu.catalogRegistrationNote,
      },
      daPhanCong: giao
        ? {
            id: giao.id,
            code: giao.code,
            dangKyId: giao.dangKyId,
            principalName: giao.principalName,
            outlineId: giao.outlineId,
          }
        : null,
      don: ds.map((d) => ({
        id: d.id,
        code: d.code,
        ownerId: d.ownerId,
        ownerName: d.ownerName,
        ownerUnit: d.ownerUnit,
        proposedBudget: Number(d.proposedBudget || 0),
        durationMonths: d.durationMonths,
        note: d.note,
        attachmentUrl: d.attachmentUrl,
        status: d.status,
        pkhReason: d.pkhReason,
        unitComment: d.unitComment,
        thanhVien: this.dongThanhVien(
          d,
          thanhVienTheoDon.get(Number(d.id)) || [],
          hoSoTheoId,
          profileTheoUser,
          sinhVienTheoId,
          diem,
          dangLam
        ),
      })),
    }
  }

  /** Chấp thuận một đơn. Các đơn đã tới phòng bị từ chối với cùng một lý do. */
  static async chapThuan(user: User, nhiemVuId: number, dangKyId: number, lyDo: string) {
    await this.kiemTraPkh(user)
    const nhiemVu = await this.taiNhiemVuMo(nhiemVuId)
    const ds = await this.donDaGui(nhiemVuId)
    if (ds.some((d) => d.status === 'CHO_DON_VI')) {
      throw new LoiHoSoDangKy('Còn đơn đang chờ đơn vị xác nhận. Hãy đợi đủ đơn rồi mới chấp thuận.')
    }
    const chon = ds.find((d) => Number(d.id) === Number(dangKyId))
    if (!chon || chon.status === 'CHO_DON_VI') {
      throw new LoiHoSoDangKy('Chỉ chấp thuận đơn đã được đơn vị xác nhận.')
    }
    const conLai = ds.filter((d) => Number(d.id) !== Number(chon.id))
    const chu = lyDo.trim()
    if (conLai.length && !chu) {
      throw new LoiHoSoDangKy('Cần lý do từ chối các đơn còn lại.')
    }
    if (chu.length > 2000) throw new LoiHoSoDangKy('Lý do tối đa 2000 ký tự.')

    chon.status = 'DKDT_DUOC_CHAP_THUAN'
    chon.pkhReason = null
    await chon.save()
    for (const row of conLai) {
      row.status = 'DKDT_TU_CHOI'
      row.pkhReason = chu
      await row.save()
    }
    return this.soSanh(user, nhiemVu.id)
  }

  /** Sửa lý do từ chối của một đơn, trước khi xác nhận phân công */
  static async suaLyDo(user: User, dangKyId: number, lyDo: string) {
    await this.kiemTraPkh(user)
    const row = await ProposalRegistration.find(dangKyId)
    if (!row || row.status !== 'DKDT_TU_CHOI') {
      throw new LoiHoSoDangKy('Chỉ sửa lý do của đơn đã bị từ chối.')
    }
    const nhiemVu = await ProjectProposal.find(row.projectProposalId)
    if (nhiemVu?.catalogRegistrationStatus) {
      throw new LoiHoSoDangKy('Nhiệm vụ đã chốt, không sửa lý do nữa.')
    }
    const chu = lyDo.trim()
    if (!chu) throw new LoiHoSoDangKy('Cần nhập lý do.')
    if (chu.length > 2000) throw new LoiHoSoDangKy('Lý do tối đa 2000 ký tự.')
    row.pkhReason = chu
    await row.save()
    return { id: row.id, pkhReason: row.pkhReason }
  }

  /** Chốt phân công: tạo nhiệm vụ chính thức, mở thuyết minh, gửi email mọi người đã đăng ký */
  static async phanCong(user: User, nhiemVuId: number) {
    await this.kiemTraPkh(user)
    const nhiemVu = await this.taiNhiemVuMo(nhiemVuId)
    const daCo = await OfficialAssignment.query().where('danh_muc_id', nhiemVuId).first()
    if (daCo) throw new LoiHoSoDangKy('Nhiệm vụ này đã được phân công.')

    const ds = await this.donDaGui(nhiemVuId)
    if (ds.some((d) => d.status === 'CHO_DON_VI' || d.status === 'CHO_PKH')) {
      throw new LoiHoSoDangKy('Còn đơn chưa chấp thuận hoặc chưa bị từ chối.')
    }
    const chon = ds.filter((d) => d.status === 'DKDT_DUOC_CHAP_THUAN')
    if (chon.length !== 1) {
      throw new LoiHoSoDangKy('Hãy chấp thuận đúng một đơn trước khi phân công.')
    }
    const tuChoi = ds.filter((d) => d.status === 'DKDT_TU_CHOI')
    if (tuChoi.some((d) => !d.pkhReason?.trim())) {
      throw new LoiHoSoDangKy('Mỗi đơn từ chối cần có lý do trước khi gửi kết quả.')
    }

    const don = chon[0]
    const outline = await this.moThuyetMinh(nhiemVu, don, user.id)
    const giao = await OfficialAssignment.create({
      code: await OfficialAssignment.generateCode(DateTime.now().year),
      danhMucId: nhiemVu.id,
      dangKyId: don.id,
      ideaId: nhiemVu.sourceIdeaId,
      principalUserId: don.ownerId,
      principalName: don.ownerName,
      status: 'DUOC_GIAO',
      outlineId: outline.id,
      createdBy: user.id,
    })

    nhiemVu.catalogRegistrationStatus = 'DA_GIAO'
    nhiemVu.canWriteOutline = true
    nhiemVu.catalogRegistrationNote = null
    await nhiemVu.save()

    await this.guiKetQua(nhiemVu, don, tuChoi, outline.id, giao.code)
    return {
      id: giao.id,
      code: giao.code,
      outlineId: outline.id,
      principalName: giao.principalName,
    }
  }

  /** Không tuyển được ai: đóng đăng ký trên danh mục và từ chối các đơn đang chờ */
  static async dongDangKy(user: User, nhiemVuId: number, lyDo: string) {
    await this.kiemTraPkh(user)
    const nhiemVu = await this.taiNhiemVuMo(nhiemVuId)
    const chu = lyDo.trim()
    if (!chu) throw new LoiHoSoDangKy('Cần ghi lý do không tuyển được.')
    if (chu.length > 2000) throw new LoiHoSoDangKy('Lý do tối đa 2000 ký tự.')

    const ds = await this.donDaGui(nhiemVuId)
    if (ds.some((d) => d.status === 'DKDT_DUOC_CHAP_THUAN')) {
      throw new LoiHoSoDangKy('Đã có đơn được chấp thuận. Hãy xác nhận phân công, hoặc chấp thuận đơn khác trước.')
    }

    nhiemVu.catalogRegistrationStatus = 'DM_DONG_DANG_KY'
    nhiemVu.catalogRegistrationNote = chu
    await nhiemVu.save()

    for (const row of ds) {
      if (row.status === 'CHO_PKH' || row.status === 'CHO_DON_VI') {
        row.status = 'DKDT_TU_CHOI'
        row.pkhReason = chu
        await row.save()
      }
      const link = `/projects/dang-ky?callForProposalId=${row.callForProposalId}&nhiemVuId=${nhiemVu.id}`
      const message = `Nhiệm vụ "${nhiemVu.title}" không tuyển được người thực hiện. Lý do: ${chu}`
      await NotificationService.push(row.ownerId, {
        type: 'PROJECT_UPDATE',
        title: `Nhiệm vụ ${nhiemVu.code} đóng đăng ký`,
        message,
        link,
      })
      await EmailLogService.sendToUser(
        row.ownerId,
        `Nhiệm vụ ${nhiemVu.code} không tuyển được người thực hiện`,
        message,
        'proposal_registration',
        row.id
      )
    }
    return { id: nhiemVu.id, trangThai: nhiemVu.catalogRegistrationStatus, ghiChu: chu }
  }

  private static async taiNhiemVuMo(id: number) {
    const nhiemVu = await ProjectProposal.find(id)
    if (!nhiemVu) throw new LoiHoSoDangKy('Không tìm thấy nhiệm vụ.')
    if (nhiemVu.catalogRegistrationStatus === 'DA_GIAO') {
      throw new LoiHoSoDangKy('Nhiệm vụ đã được phân công.')
    }
    if (nhiemVu.catalogRegistrationStatus === 'DM_DONG_DANG_KY') {
      throw new LoiHoSoDangKy('Nhiệm vụ đã đóng đăng ký.')
    }
    return nhiemVu
  }

  private static async napThanhVien(donIds: number[]) {
    const map = new Map<number, ProposalRegistrationMember[]>()
    if (!donIds.length) return map
    const rows = await ProposalRegistrationMember.query()
      .whereIn('proposal_registration_id', donIds)
      .orderBy('member_order', 'asc')
    for (const row of rows) {
      const key = Number(row.proposalRegistrationId)
      const list = map.get(key) || []
      list.push(row)
      map.set(key, list)
    }
    return map
  }

  /** Mỗi người trong đơn: học hàm, học vị, giờ NCKH, số nhiệm vụ đang làm */
  private static dongThanhVien(
    don: ProposalRegistration,
    members: ProposalRegistrationMember[],
    hoSoTheoId: Map<number, ScientificProfile>,
    profileTheoUser: Map<number, ScientificProfile>,
    sinhVienTheoId: Map<number, Student>,
    diem: Map<number, number>,
    dangLam: Map<number, number>
  ) {
    const hang = (profile: ScientificProfile | undefined, ten: string, vaiTro: string) => {
      const userId = profile?.userId != null ? Number(profile.userId) : null
      return {
        ten,
        vaiTro,
        hocVi: nhanHocVi(profile?.degree),
        hocHam: nhanHocHam(profile?.academicTitle),
        diemNckh: profile ? (diem.get(Number(profile.id)) ?? null) : null,
        soNhiemVuDangLam: userId != null ? dangLam.get(userId) || 0 : 0,
      }
    }

    const ds = members.map((m) => {
      const profile = m.profileId ? hoSoTheoId.get(Number(m.profileId)) : undefined
      const sv = m.studentId ? sinhVienTheoId.get(Number(m.studentId)) : undefined
      return hang(profile, m.fullName || sv?.fullName || '—', m.role)
    })

    const daCoNguoiNop = members.some((m) => {
      const profile = m.profileId ? hoSoTheoId.get(Number(m.profileId)) : undefined
      if (profile?.userId != null && Number(profile.userId) === Number(don.ownerId)) return true
      return (m.fullName || '').trim().toLowerCase() === don.ownerName.trim().toLowerCase()
    })
    if (!daCoNguoiNop) {
      ds.unshift(hang(profileTheoUser.get(Number(don.ownerId)), don.ownerName, 'PRINCIPAL'))
    }
    return ds.length ? ds : [hang(profileTheoUser.get(Number(don.ownerId)), don.ownerName, 'PRINCIPAL')]
  }

  private static donDaGui(nhiemVuId: number) {
    return ProposalRegistration.query()
      .where('project_proposal_id', nhiemVuId)
      .whereNot('status', 'DRAFT')
  }

  private static async demNhiemVuDangLam(
    userIds: number[],
    profileTheoUser: Map<number, ScientificProfile>
  ) {
    const dem = new Map<number, Set<number>>()
    const cong = (userId: number, outlineId: number) => {
      const set = dem.get(userId) || new Set<number>()
      set.add(outlineId)
      dem.set(userId, set)
    }
    if (!userIds.length) return new Map<number, number>()

    const cuaChu = await ProjectOutline.query()
      .whereIn('owner_id', userIds)
      .whereNotIn('status', TRANG_DONG_TM)
      .select('id', 'owner_id')
    for (const row of cuaChu) cong(Number(row.ownerId), Number(row.id))

    const profileIds = [...profileTheoUser.values()].map((p) => p.id)
    if (profileIds.length) {
      const thanhVien = await ProjectOutlineMember.query()
        .whereIn('profile_id', profileIds)
        .select('project_outline_id', 'profile_id')
      const userTheoProfile = new Map(
        [...profileTheoUser.entries()].map(([userId, p]) => [Number(p.id), userId])
      )
      const outlineIds = [...new Set(thanhVien.map((m) => Number(m.projectOutlineId)))]
      const conMo = outlineIds.length
        ? await ProjectOutline.query()
            .whereIn('id', outlineIds)
            .whereNotIn('status', TRANG_DONG_TM)
            .select('id')
        : []
      const mo = new Set(conMo.map((o) => Number(o.id)))
      for (const mem of thanhVien) {
        const oid = Number(mem.projectOutlineId)
        if (!mo.has(oid)) continue
        const uid = userTheoProfile.get(Number(mem.profileId))
        if (uid) cong(uid, oid)
      }
    }
    return new Map([...dem.entries()].map(([id, set]) => [id, set.size]))
  }

  /** Mở bản thuyết minh cho chủ nhiệm vừa được giao */
  private static async moThuyetMinh(
    nhiemVu: ProjectProposal,
    don: ProposalRegistration,
    actorId: number
  ) {
    let outline = await ProjectOutline.query().where('project_proposal_id', nhiemVu.id).first()
    if (!outline) {
      outline = await ProjectOutlineService.createFromProposal(nhiemVu, actorId)
    }
    const batDau = DateTime.now().startOf('day')
    outline.ownerId = don.ownerId
    outline.ownerName = don.ownerName
    outline.ownerEmail = don.ownerEmail
    outline.ownerUnit = don.ownerUnit
    outline.requestedBudget = Number(don.proposedBudget || 0)
    outline.hostUnit = don.ownerUnit
    outline.startDate = batDau
    outline.endDate = batDau.plus({ months: Number(don.durationMonths || 1) }).minus({ days: 1 })
    await outline.save()

    const thanhVien = await ProposalRegistrationMember.query()
      .where('proposal_registration_id', don.id)
      .orderBy('member_order', 'asc')
    await ProjectOutlineService.replaceMembers(
      outline.id,
      thanhVien.length
        ? thanhVien.map((m) => ({
            profileId: m.profileId,
            studentId: m.studentId,
            departmentId: m.departmentId,
            fullName: m.fullName,
            memberOrder: m.memberOrder,
            role: m.role,
            affiliationType: m.affiliationType,
            affiliationUnits: m.affiliationUnits,
            contributionPercent: m.contributionPercent,
            gender: m.gender,
            isMultiAffiliationOutsideUdn: m.isMultiAffiliationOutsideUdn,
          }))
        : [
            {
              fullName: don.ownerName,
              memberOrder: 1,
              role: 'PRINCIPAL',
            },
          ]
    )
    outline.completionPercent = ProjectOutlineService.calcCompletion(
      outline,
      await ProjectOutlineService.loadMembers(outline.id),
      await ProjectOutlineService.loadBudgetLines(outline.id)
    )
    await outline.save()
    return outline
  }

  private static async guiKetQua(
    nhiemVu: ProjectProposal,
    chon: ProposalRegistration,
    tuChoi: ProposalRegistration[],
    outlineId: number,
    maNhiemVu: string
  ) {
    const linkDat = `/projects/outlines/form/${outlineId}`
    const dat = `Bạn được giao chủ nhiệm nhiệm vụ "${nhiemVu.title}" (${maNhiemVu}). Hãy vào thuyết minh để tiếp tục.`
    await NotificationService.push(chon.ownerId, {
      type: 'PROJECT_UPDATE',
      title: `Được giao nhiệm vụ ${nhiemVu.code}`,
      message: dat,
      link: linkDat,
    })
    await EmailLogService.sendToUser(
      chon.ownerId,
      `Bạn được giao nhiệm vụ ${nhiemVu.code}`,
      dat,
      'proposal_registration',
      chon.id
    )

    for (const row of tuChoi) {
      const link = `/projects/dang-ky?callForProposalId=${row.callForProposalId}&nhiemVuId=${nhiemVu.id}`
      const message = `Đơn đăng ký nhiệm vụ "${nhiemVu.title}" không được chọn. Lý do: ${row.pkhReason}`
      await NotificationService.push(row.ownerId, {
        type: 'PROJECT_UPDATE',
        title: `Đơn ${row.code} không được chọn`,
        message,
        link,
      })
      await EmailLogService.sendToUser(
        row.ownerId,
        `Kết quả đăng ký nhiệm vụ ${nhiemVu.code}`,
        message,
        'proposal_registration',
        row.id
      )
    }
  }
}
