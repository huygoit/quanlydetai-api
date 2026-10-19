import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import { errors } from '@vinejs/vine'
import User from '#models/user'
import CallForProposal from '#models/call_for_proposal'
import ProjectProposal from '#models/project_proposal'
import ProposalRegistration from '#models/proposal_registration'
import ProposalRegistrationMember from '#models/proposal_registration_member'
import NotificationService from '#services/notification_service'
import EmailLogService from '#services/email_log_service'
import PermissionService from '#services/permission_service'
import { resolveUserUnitLabel, sameDepartmentId } from '#utils/user_unit'
import { mapProjectProposalMemberToApi } from '#utils/project_proposal_member_api'
import {
  resolvedGenderForSave,
  resolvedMemberOrder,
  resolvedMemberRole,
  resolvedProfileIdFromRow,
  resolvedStudentIdFromRow,
  upsertProjectProposalMembersValidator,
  validateMembersListRules,
  type MemberPayloadRow,
} from '#validators/project_proposal_member_validator'

const NHAN_NGOAI = 'Other Organization (Đơn vị khác)'
const NHAN_NGOAI_CU = 'Đơn vị khác'

/** Lỗi nghiệp vụ hồ sơ đăng ký — controller trả 422 */
export class LoiHoSoDangKy extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LoiHoSoDangKy'
  }
}

export type LuuHoSoDangKy = {
  callForProposalId: number
  projectProposalId: number
  proposedBudget: number
  durationMonths: number
  attachmentUrl?: string | null
  note?: string | null
  members: unknown[]
  /** true = gửi hồ sơ, false = lưu nháp */
  gui: boolean
}

function loaiCoQuan(units: string[] | undefined) {
  const picked = Array.isArray(units)
    ? Array.from(new Set(units.map((v) => String(v ?? '').trim()).filter((v) => v.length > 0)))
    : []
  if (picked.length === 0) return null
  const coNgoai = picked.includes(NHAN_NGOAI) || picked.includes(NHAN_NGOAI_CU)
  const coUdn = picked.some((v) => v !== NHAN_NGOAI && v !== NHAN_NGOAI_CU)
  if (coNgoai && coUdn) return 'MIXED' as const
  if (coNgoai) return 'OUTSIDE' as const
  return 'UDN_ONLY' as const
}

function thongDiepVine(raw: unknown): string {
  if (Array.isArray(raw)) {
    const first = raw[0]
    if (first && typeof first === 'object' && 'message' in first) return String(first.message)
    if (typeof first === 'string') return first
  }
  if (raw && typeof raw === 'object') {
    const first = Object.values(raw as Record<string, unknown>)[0]
    if (typeof first === 'string') return first
    if (Array.isArray(first) && first[0]) {
      return typeof first[0] === 'string'
        ? first[0]
        : String((first[0] as { message?: string }).message || 'Danh sách thành viên không hợp lệ.')
    }
  }
  return 'Danh sách thành viên không hợp lệ.'
}

function laFileHopLe(url: string) {
  return /\.(pdf|docx)$/i.test(url.split('?')[0])
}

async function taiThanhVien(registrationId: number) {
  return ProposalRegistrationMember.query()
    .where('proposal_registration_id', registrationId)
    .preload('profile', (q) => q.select('id', 'gender', 'full_name', 'degree', 'academic_title'))
    .preload('student', (q) => q.select('id', 'gender', 'full_name'))
    .orderBy('member_order', 'asc')
}

function dtoThanhVien(rows: ProposalRegistrationMember[]) {
  return rows.map((m) =>
    mapProjectProposalMemberToApi(m as unknown as Parameters<typeof mapProjectProposalMemberToApi>[0])
  )
}

export default class ProposalRegistrationService {
  /** Nhiệm vụ + hồ sơ của người đang đăng nhập (nếu đã có) */
  static async nguCanh(userId: number, callForProposalId: number, projectProposalId: number) {
    const { cfp, nhiemVu, dangMo } = await this.taiKhung(callForProposalId, projectProposalId)
    const hoSo = await ProposalRegistration.query()
      .where('project_proposal_id', nhiemVu.id)
      .where('owner_id', userId)
      .first()
    const thanhVien = hoSo ? await taiThanhVien(hoSo.id) : []
    return {
      dangMo,
      hanNop: cfp.submissionPeriod?.deadlineAt?.toISO() ?? cfp.deadlineAt?.toISO() ?? null,
      thongBao: { id: cfp.id, title: cfp.title, status: cfp.status },
      nhiemVu: {
        id: nhiemVu.id,
        code: nhiemVu.code,
        title: nhiemVu.title,
        objectives: nhiemVu.objectives,
        expectedResults: nhiemVu.expectedResults,
        ownerName: nhiemVu.ownerName,
        ownerUnit: nhiemVu.ownerUnit,
        durationMonths: nhiemVu.durationMonths,
        projectProcessType: nhiemVu.projectProcessType
          ? {
              id: nhiemVu.projectProcessType.id,
              code: nhiemVu.projectProcessType.code,
              name: nhiemVu.projectProcessType.name,
            }
          : null,
      },
      hoSo: hoSo ? this.serialize(hoSo) : null,
      thanhVien: dtoThanhVien(thanhVien),
    }
  }

  /** Lưu nháp hoặc gửi. Một người một hồ sơ cho mỗi nhiệm vụ. */
  static async luu(user: User, input: LuuHoSoDangKy) {
    const { cfp, nhiemVu, dangMo } = await this.taiKhung(
      input.callForProposalId,
      input.projectProposalId
    )
    if (!dangMo) {
      throw new LoiHoSoDangKy('Kỳ đăng ký của thông báo này đã đóng.')
    }

    const kinhPhi = Math.round(Number(input.proposedBudget))
    if (!Number.isFinite(kinhPhi) || kinhPhi <= 0) {
      throw new LoiHoSoDangKy('Đề xuất kinh phí phải lớn hơn 0.')
    }

    const thoiGian = Math.round(Number(input.durationMonths))
    if (!Number.isFinite(thoiGian) || thoiGian < 1 || thoiGian > 60) {
      throw new LoiHoSoDangKy('Thời gian thực hiện phải từ 1 đến 60 tháng.')
    }

    const file = input.attachmentUrl?.trim() || null
    if (file && !laFileHopLe(file)) {
      throw new LoiHoSoDangKy('Chỉ nhận file PDF hoặc DOCX.')
    }

    const ghiChu = input.note?.trim() || null
    if (ghiChu && ghiChu.length > 2000) {
      throw new LoiHoSoDangKy('Ghi chú tối đa 2000 ký tự.')
    }

    const danhSach = Array.isArray(input.members) ? input.members : []
    let thanhVien: MemberPayloadRow[] = []
    if (danhSach.length > 0 || input.gui) {
      if (input.gui && danhSach.length === 0) {
        throw new LoiHoSoDangKy('Cần ít nhất 1 thành viên, trong đó có đúng 1 chủ nhiệm.')
      }
      try {
        const checked = await upsertProjectProposalMembersValidator.validate({
          members: danhSach,
        })
        validateMembersListRules(checked.members)
        thanhVien = checked.members
      } catch (error) {
        if (error instanceof errors.E_VALIDATION_ERROR) {
          throw new LoiHoSoDangKy(thongDiepVine(error.messages))
        }
        throw error
      }
    }

    const ownerUnit = await resolveUserUnitLabel(user)
    let hoSo: ProposalRegistration
    try {
      hoSo = await db.transaction(async (trx) => {
      let row = await ProposalRegistration.query({ client: trx })
        .where('project_proposal_id', nhiemVu.id)
        .where('owner_id', user.id)
        .forUpdate()
        .first()

      if (row && row.status !== 'DRAFT') {
        throw new LoiHoSoDangKy('Hồ sơ đã gửi, không sửa được.')
      }

      const trangThai = input.gui ? 'CHO_DON_VI' : 'DRAFT'
      const lucGui = input.gui ? DateTime.now() : null

      if (!row) {
        const code = await ProposalRegistration.generateCode(DateTime.now().year)
        row = await ProposalRegistration.create(
          {
            code,
            projectProposalId: nhiemVu.id,
            callForProposalId: cfp.id,
            ownerId: user.id,
            ownerName: user.fullName,
            ownerEmail: user.email,
            ownerUnit,
            proposedBudget: kinhPhi,
            durationMonths: thoiGian,
            attachmentUrl: file,
            note: ghiChu,
            status: trangThai,
            submittedAt: lucGui,
          },
          { client: trx }
        )
      } else {
        row.useTransaction(trx)
        row.merge({
          proposedBudget: kinhPhi,
          durationMonths: thoiGian,
          attachmentUrl: file,
          note: ghiChu,
          status: trangThai,
          submittedAt: lucGui ?? row.submittedAt,
          ownerName: user.fullName,
          ownerEmail: user.email,
          ownerUnit,
        })
        await row.save()
      }

      await ProposalRegistrationMember.query({ client: trx })
        .where('proposal_registration_id', row.id)
        .delete()

      for (const a of thanhVien) {
        const loai = loaiCoQuan(a.affiliation_units) ?? a.affiliation_type
        await ProposalRegistrationMember.create(
          {
            proposalRegistrationId: row.id,
            // Hàm chuẩn hoá hồ sơ NCV nhận kiểu tác giả bài báo; dòng thành viên cùng các field cần dùng.
            profileId: resolvedProfileIdFromRow(a as never) ?? null,
            studentId: resolvedStudentIdFromRow(a as never) ?? null,
            gender: resolvedGenderForSave(a as never),
            fullName: a.full_name,
            affiliationUnits: a.affiliation_units ?? [],
            memberOrder: resolvedMemberOrder(a),
            role: resolvedMemberRole(a),
            affiliationType: loai,
            isMultiAffiliationOutsideUdn: loai === 'MIXED',
            contributionPercent: a.contribution_percent ?? null,
          },
          { client: trx }
        )
      }

      return row
    })
    } catch (error) {
      if (error instanceof LoiHoSoDangKy) throw error
      const ma = (error as { code?: string })?.code
      if (ma === '23505') {
        throw new LoiHoSoDangKy('Bạn đã có hồ sơ cho nhiệm vụ này. Hãy tải lại trang.')
      }
      throw error
    }

    const savedMembers = await taiThanhVien(hoSo.id)
    if (input.gui) {
      await NotificationService.notifyUnitHeadsRegistrationSubmitted({
        id: hoSo.id,
        code: hoSo.code,
        title: nhiemVu.title,
        ownerId: user.id,
        ownerName: user.fullName,
      })
    }
    return { hoSo: this.serialize(hoSo), thanhVien: dtoThanhVien(savedMembers) }
  }

  /** Danh sách đơn: trưởng đơn vị thấy chờ xác nhận; PKH thấy đơn đã chuyển sang */
  static async danhSachChoDonVi(user: User) {
    const laKhoa = await PermissionService.userHasPermission(user.id, 'project.assign_reviewer')
    if (laKhoa && user.departmentId != null) {
      const ids = await this.idCungDonVi(user)
      const rows = ids.length
        ? await ProposalRegistration.query()
            .where('status', 'CHO_DON_VI')
            .whereIn('owner_id', ids)
            .preload('projectProposal', (q) => q.select('id', 'code', 'title'))
            .orderBy('submitted_at', 'desc')
        : []
      return { coTheXuLy: true, items: rows.map((row) => this.serializeChoDuyet(row)) }
    }

    const laPkh = await PermissionService.userHasPermission(user.id, 'project.review')
    if (laPkh) {
      const rows = await ProposalRegistration.query()
        .where('status', 'CHO_PKH')
        .preload('projectProposal', (q) => q.select('id', 'code', 'title'))
        .orderBy('submitted_at', 'desc')
      return { coTheXuLy: false, items: rows.map((row) => this.serializeChoDuyet(row)) }
    }

    throw new LoiHoSoDangKy('Chỉ người có quyền xác nhận đăng ký của đơn vị được xem danh sách này.')
  }

  static async demChoDonVi(user: User) {
    const duoc = await PermissionService.userHasPermission(user.id, 'project.assign_reviewer')
    if (!duoc || user.departmentId == null) return 0
    const ids = await this.idCungDonVi(user)
    if (!ids.length) return 0
    const result = await ProposalRegistration.query()
      .where('status', 'CHO_DON_VI')
      .whereIn('owner_id', ids)
      .count('* as total')
    return Number(result[0].$extras.total || 0)
  }

  /** Mở một đơn: người nộp, thành viên, kinh phí, file */
  static async chiTietChoDonVi(user: User, id: number) {
    const row = await this.taiDon(id)
    const owner = await User.find(row.ownerId)
    const laKhoa = await PermissionService.userHasPermission(user.id, 'project.assign_reviewer')
    const cungDonVi = sameDepartmentId(user.departmentId, owner?.departmentId)
    const laPkh = await PermissionService.userHasPermission(user.id, 'project.review')
    const duocXem = (laKhoa && cungDonVi) || (laPkh && row.status === 'CHO_PKH')
    if (!duocXem) {
      throw new LoiHoSoDangKy('Bạn chỉ xem hồ sơ của người cùng đơn vị, hoặc hồ sơ đã chuyển PKH.')
    }
    const thanhVien = await taiThanhVien(row.id)
    return {
      coTheXuLy: laKhoa && cungDonVi && row.status === 'CHO_DON_VI',
      hoSo: this.serializeChoDuyet(row),
      thanhVien: dtoThanhVien(thanhVien),
    }
  }

  /** Xác nhận → chờ PKH. Ghi chú không bắt buộc. */
  static async xacNhan(user: User, id: number, ghiChu?: string | null) {
    await this.kiemTraTruongDonVi(user)
    const row = await this.taiDonCungDonVi(user, id)
    if (row.status !== 'CHO_DON_VI') {
      throw new LoiHoSoDangKy('Chỉ xác nhận đơn đang chờ đơn vị.')
    }
    const chu = ghiChu?.trim() || null
    if (chu && chu.length > 2000) {
      throw new LoiHoSoDangKy('Ghi chú tối đa 2000 ký tự.')
    }
    row.unitComment = chu
    row.status = 'CHO_PKH'
    await row.save()
    await row.load('projectProposal')

    await NotificationService.notifyPkhRegistrationReady({
      id: row.id,
      code: row.code,
      title: row.projectProposal?.title || row.code,
      ownerName: row.ownerName,
    })
    await NotificationService.push(row.ownerId, {
      type: 'PROJECT_UPDATE',
      title: `Hồ sơ đăng ký ${row.code}`,
      message: `Hồ sơ đăng ký ${row.code} đã được đơn vị xác nhận, chuyển Phòng Khoa học và Hợp tác quốc tế.`,
      link: `/projects/dang-ky?callForProposalId=${row.callForProposalId}&nhiemVuId=${row.projectProposalId}`,
    })
    return this.serializeChoDuyet(row)
  }

  /** Trả lại → nháp. Lý do bắt buộc. Gửi email cho người nộp. */
  static async traLai(user: User, id: number, lyDo: string) {
    await this.kiemTraTruongDonVi(user)
    const row = await this.taiDonCungDonVi(user, id)
    if (row.status !== 'CHO_DON_VI') {
      throw new LoiHoSoDangKy('Chỉ trả lại đơn đang chờ đơn vị.')
    }
    const chu = lyDo.trim()
    if (!chu) throw new LoiHoSoDangKy('Cần nhập lý do trả lại.')
    if (chu.length > 2000) throw new LoiHoSoDangKy('Lý do tối đa 2000 ký tự.')

    row.unitComment = chu
    row.status = 'DRAFT'
    await row.save()

    const link = `/projects/dang-ky?callForProposalId=${row.callForProposalId}&nhiemVuId=${row.projectProposalId}`
    await NotificationService.push(row.ownerId, {
      type: 'PROJECT_UPDATE',
      title: `Hồ sơ đăng ký ${row.code} bị trả lại`,
      message: `Đơn vị trả lại hồ sơ ${row.code}. Lý do: ${chu}`,
      link,
    })
    await EmailLogService.sendToUser(
      row.ownerId,
      `Hồ sơ đăng ký ${row.code} bị trả lại`,
      `Đơn vị trả lại hồ sơ đăng ký thực hiện ${row.code}.\n\nLý do: ${chu}\n\nVui lòng đăng nhập, chỉnh sửa và gửi lại.`,
      'proposal_registration',
      row.id
    )
    return this.serialize(row)
  }

  private static async kiemTraTruongDonVi(user: User) {
    const duoc = await PermissionService.userHasPermission(user.id, 'project.assign_reviewer')
    if (!duoc) {
      throw new LoiHoSoDangKy('Chỉ người có quyền xác nhận đăng ký của đơn vị được xử lý.')
    }
    if (user.departmentId == null) {
      throw new LoiHoSoDangKy('Tài khoản chưa gắn đơn vị, không xác nhận được hồ sơ.')
    }
  }

  private static async idCungDonVi(user: User) {
    if (user.departmentId == null) return []
    const peer = await User.query().where('department_id', user.departmentId).select('id')
    return peer.map((u) => u.id)
  }

  private static async taiDon(id: number) {
    const row = await ProposalRegistration.query()
      .where('id', id)
      .preload('projectProposal', (q) =>
        q.select('id', 'code', 'title', 'objectives', 'expected_results')
      )
      .first()
    if (!row) throw new LoiHoSoDangKy('Không tìm thấy hồ sơ đăng ký.')
    return row
  }

  private static async taiDonCungDonVi(user: User, id: number) {
    const row = await this.taiDon(id)
    const owner = await User.find(row.ownerId)
    if (!sameDepartmentId(user.departmentId, owner?.departmentId)) {
      throw new LoiHoSoDangKy('Bạn chỉ xác nhận hồ sơ của người cùng đơn vị.')
    }
    return row
  }

  private static serializeChoDuyet(row: ProposalRegistration) {
    const nv = row.projectProposal
    return {
      ...this.serialize(row),
      nhiemVu: nv ? { id: nv.id, code: nv.code, title: nv.title, objectives: nv.objectives, expectedResults: nv.expectedResults } : null,
    }
  }

  private static serialize(row: ProposalRegistration) {
    return {
      id: row.id,
      code: row.code,
      projectProposalId: row.projectProposalId,
      callForProposalId: row.callForProposalId,
      ownerId: row.ownerId,
      ownerName: row.ownerName,
      ownerUnit: row.ownerUnit,
      proposedBudget: Number(row.proposedBudget || 0),
      durationMonths: row.durationMonths,
      attachmentUrl: row.attachmentUrl,
      note: row.note,
      unitComment: row.unitComment,
      status: row.status,
      submittedAt: row.submittedAt?.toISO() ?? null,
    }
  }

  private static async taiKhung(callForProposalId: number, projectProposalId: number) {
    const cfp = await CallForProposal.query()
      .where('id', callForProposalId)
      .preload('submissionPeriod')
      .first()
    if (!cfp || cfp.status !== 'PUBLISHED') {
      throw new LoiHoSoDangKy('Thông báo chưa phát hành, chưa mở đăng ký.')
    }
    const nhiemVu = await ProjectProposal.query()
      .where('id', projectProposalId)
      .preload('projectProcessType')
      .first()
    if (!nhiemVu) {
      throw new LoiHoSoDangKy('Không tìm thấy nhiệm vụ.')
    }
    if (Number(nhiemVu.callForProposalId) !== Number(cfp.id)) {
      throw new LoiHoSoDangKy('Nhiệm vụ không thuộc thông báo này.')
    }
    const dangMo = cfp.submissionPeriod ? cfp.submissionPeriod.isAcceptingNow() : false
    return { cfp, nhiemVu, dangMo }
  }
}
