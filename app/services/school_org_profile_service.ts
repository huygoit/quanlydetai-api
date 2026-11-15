import SystemConfig from '#models/system_config'

/** Khóa singleton — thông tin Bên A / profile trường dùng cho BM.06 và branding. */
export const SCHOOL_ORG_PROFILE_KEY = 'school_org_profile'

export type SchoolOrgProfile = {
  logoUrl: string | null
  schoolName: string
  /** Hệ thống đại học vùng, ví dụ: Đại học Đà Nẵng */
  universitySystem: string
  daiDienBenA: string
  chucVuBenA: string
  diaChiBenA: string
  dienThoaiBenA: string
  emailBenA: string
  taiKhoanBenA: string
  nganHangBenA: string
  maSoThueBenA: string
}

const DEFAULTS: SchoolOrgProfile = {
  logoUrl: null,
  schoolName: '',
  universitySystem: 'Đại học Đà Nẵng',
  daiDienBenA: '',
  chucVuBenA: '',
  diaChiBenA: '',
  dienThoaiBenA: '',
  emailBenA: '',
  taiKhoanBenA: '',
  nganHangBenA: '',
  maSoThueBenA: '',
}

function str(v: unknown) {
  return String(v ?? '').trim()
}

export default class SchoolOrgProfileService {
  static defaults(): SchoolOrgProfile {
    return { ...DEFAULTS }
  }

  static parse(raw: string | null | undefined): SchoolOrgProfile {
    if (!raw || !String(raw).trim()) return this.defaults()
    try {
      const p = JSON.parse(String(raw)) as Partial<SchoolOrgProfile>
      return {
        logoUrl: p.logoUrl ? String(p.logoUrl).trim() : null,
        schoolName: str(p.schoolName),
        universitySystem: str(p.universitySystem) || DEFAULTS.universitySystem,
        daiDienBenA: str(p.daiDienBenA),
        chucVuBenA: str(p.chucVuBenA),
        diaChiBenA: str(p.diaChiBenA),
        dienThoaiBenA: str(p.dienThoaiBenA),
        emailBenA: str(p.emailBenA),
        taiKhoanBenA: str(p.taiKhoanBenA),
        nganHangBenA: str(p.nganHangBenA),
        maSoThueBenA: str(p.maSoThueBenA),
      }
    } catch {
      return this.defaults()
    }
  }

  static async ensureRow() {
    let row = await SystemConfig.findBy('key', SCHOOL_ORG_PROFILE_KEY)
    if (!row) {
      row = await SystemConfig.create({
        key: SCHOOL_ORG_PROFILE_KEY,
        value: JSON.stringify(DEFAULTS),
        description: 'Profile trường / Bên A (logo, tên, đại diện, MST…) cho BM.06 & branding',
      })
    }
    return row
  }

  static async get(): Promise<SchoolOrgProfile> {
    const row = await this.ensureRow()
    return this.parse(row.value)
  }

  static async update(input: Partial<SchoolOrgProfile>): Promise<SchoolOrgProfile> {
    const current = await this.get()
    const next: SchoolOrgProfile = {
      logoUrl:
        input.logoUrl === undefined
          ? current.logoUrl
          : input.logoUrl
            ? String(input.logoUrl).trim()
            : null,
      schoolName: input.schoolName !== undefined ? str(input.schoolName) : current.schoolName,
      universitySystem:
        input.universitySystem !== undefined
          ? str(input.universitySystem) || DEFAULTS.universitySystem
          : current.universitySystem,
      daiDienBenA: input.daiDienBenA !== undefined ? str(input.daiDienBenA) : current.daiDienBenA,
      chucVuBenA: input.chucVuBenA !== undefined ? str(input.chucVuBenA) : current.chucVuBenA,
      diaChiBenA: input.diaChiBenA !== undefined ? str(input.diaChiBenA) : current.diaChiBenA,
      dienThoaiBenA:
        input.dienThoaiBenA !== undefined ? str(input.dienThoaiBenA) : current.dienThoaiBenA,
      emailBenA: input.emailBenA !== undefined ? str(input.emailBenA) : current.emailBenA,
      taiKhoanBenA:
        input.taiKhoanBenA !== undefined ? str(input.taiKhoanBenA) : current.taiKhoanBenA,
      nganHangBenA:
        input.nganHangBenA !== undefined ? str(input.nganHangBenA) : current.nganHangBenA,
      maSoThueBenA:
        input.maSoThueBenA !== undefined ? str(input.maSoThueBenA) : current.maSoThueBenA,
    }

    const row = await this.ensureRow()
    row.value = JSON.stringify(next)
    await row.save()
    return next
  }

  /** Map sang biến merge BM.06 (Bên A). */
  static toBm06Vars(profile: SchoolOrgProfile): Record<string, string> {
    return {
      ten_ben_a: profile.schoolName,
      dai_dien_ben_a: profile.daiDienBenA,
      chuc_vu_ben_a: profile.chucVuBenA,
      chuc_vu_dai_dien_ben_a: profile.chucVuBenA,
      dia_chi_ben_a: profile.diaChiBenA,
      dien_thoai_ben_a: profile.dienThoaiBenA,
      email_ben_a: profile.emailBenA,
      tai_khoan_ben_a: profile.taiKhoanBenA,
      ngan_hang_ben_a: profile.nganHangBenA,
      ma_so_thue_ben_a: profile.maSoThueBenA,
      he_thong_dai_hoc: profile.universitySystem,
    }
  }

  static async bm06PartyAVars(): Promise<Record<string, string>> {
    return this.toBm06Vars(await this.get())
  }
}
