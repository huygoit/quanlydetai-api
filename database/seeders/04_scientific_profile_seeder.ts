import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DateTime } from 'luxon'
import ScientificProfile from '#models/scientific_profile'
import ProfileLanguage from '#models/profile_language'
import Publication from '#models/publication'

/**
 * Seed 5 hồ sơ khoa học mẫu (user_id 2,4,5,6,7) với languages và publications.
 */
const USER_IDS = [6, 7, 2, 5, 4]
const PROFILES = [
  { fullName: 'TS. Nguyễn Văn A', workEmail: 'ncv@university.edu.vn', organization: 'Trường ĐH Bách khoa - ĐHĐN', faculty: 'Khoa CNTT', degree: 'Tiến sĩ', mainResearchArea: 'Công nghệ thông tin', status: 'VERIFIED' as const },
  { fullName: 'Trần Văn B', workEmail: 'cndt@university.edu.vn', organization: 'Trường ĐH Kinh tế - ĐHĐN', faculty: 'Khoa Kinh tế', degree: 'Thạc sĩ', mainResearchArea: 'Kinh tế học', status: 'UPDATED' as const },
  { fullName: 'Phòng Khoa học', workEmail: 'phongkh@university.edu.vn', organization: 'Trường ĐH Bách khoa - ĐHĐN', faculty: 'Phòng KH', degree: 'Thạc sĩ', mainResearchArea: 'Quản lý khoa học', status: 'VERIFIED' as const },
  { fullName: 'Trưởng Khoa CNTT', workEmail: 'truongkhoa@university.edu.vn', organization: 'Trường ĐH Bách khoa - ĐHĐN', faculty: 'Khoa CNTT', degree: 'Tiến sĩ', mainResearchArea: 'Hệ thống thông tin', status: 'VERIFIED' as const },
  { fullName: 'Lãnh đạo', workEmail: 'lanhdao@university.edu.vn', organization: 'Đại học Đà Nẵng', faculty: 'Ban Giám hiệu', degree: 'Tiến sĩ', mainResearchArea: 'Quản lý giáo dục', status: 'DRAFT' as const },
]

export default class ScientificProfileSeeder extends BaseSeeder {
  async run() {
    const profileIds: number[] = []
    for (let i = 0; i < USER_IDS.length; i++) {
      const userId = USER_IDS[i]
      const row = PROFILES[i]
      let p = await ScientificProfile.findBy('user_id', userId)
      if (!p) {
        p = await ScientificProfile.create({
          userId,
          fullName: row.fullName,
          workEmail: row.workEmail,
          organization: row.organization,
          faculty: row.faculty,
          degree: row.degree,
          mainResearchArea: row.mainResearchArea,
          status: row.status,
          completeness: 60,
          verifiedAt: row.status === 'VERIFIED' ? DateTime.now() : null,
          verifiedBy: row.status === 'VERIFIED' ? 'System' : null,
          subResearchAreas: [],
          keywords: [],
        })
      }
      profileIds.push(p.id)
    }

    for (let idx = 0; idx < profileIds.length; idx++) {
      const profileId = profileIds[idx]
      const langs = idx === 0 ? [{ language: 'Tiếng Anh', level: 'C1', certificate: 'IELTS 7.5' }, { language: 'Tiếng Nhật', level: 'N2', certificate: null }] : idx === 1 ? [{ language: 'Tiếng Anh', level: 'B2', certificate: 'TOEIC 800' }] : idx === 2 ? [{ language: 'Tiếng Anh', level: 'C1', certificate: null }] : idx === 3 ? [{ language: 'Tiếng Anh', level: 'C2', certificate: 'IELTS 8.0' }] : [{ language: 'Tiếng Anh', level: 'B2', certificate: null }]
      for (const l of langs) {
        const exists = await ProfileLanguage.query().where('profile_id', profileId).where('language', l.language).first()
        if (!exists) await ProfileLanguage.create({ profileId, language: l.language, level: l.level, certificate: l.certificate, certificateUrl: null })
      }
    }

    const pubList: Array<{ profileIndex: number; title: string; authors: string; publicationType: string; journalOrConference: string; year: number; publicationStatus: string; rank: string | null }> = [
      { profileIndex: 0, title: 'Deep Learning for Healthcare', authors: 'Nguyen Van A, Tran B', publicationType: 'JOURNAL', journalOrConference: 'IEEE Transactions', year: 2023, publicationStatus: 'PUBLISHED', rank: 'ISI' },
      { profileIndex: 0, title: 'AI in Education', authors: 'Nguyen Van A et al.', publicationType: 'CONFERENCE', journalOrConference: 'ICCE 2023', year: 2023, publicationStatus: 'PUBLISHED', rank: 'SCOPUS' },
      { profileIndex: 1, title: 'Economic Policy Analysis', authors: 'Tran Van B', publicationType: 'JOURNAL', journalOrConference: 'Journal of Economics', year: 2022, publicationStatus: 'PUBLISHED', rank: 'DOMESTIC' },
      { profileIndex: 2, title: 'Science Management', authors: 'Phong KH', publicationType: 'JOURNAL', journalOrConference: 'National Journal', year: 2024, publicationStatus: 'UNDER_REVIEW', rank: null },
      { profileIndex: 3, title: 'Information Systems', authors: 'Truong Khoa CNTT', publicationType: 'JOURNAL', journalOrConference: 'ACM SIGMIS', year: 2021, publicationStatus: 'PUBLISHED', rank: 'ISI' },
    ]
    for (const pub of pubList) {
      const profileId = profileIds[pub.profileIndex]
      const exists = await Publication.query().where('profile_id', profileId).where('title', pub.title).first()
      if (!exists) {
        await Publication.create({
          profileId,
          title: pub.title,
          authors: pub.authors,
          publicationType: pub.publicationType,
          journalOrConference: pub.journalOrConference,
          year: pub.year,
          publicationStatus: pub.publicationStatus,
          rank: pub.rank,
          source: 'INTERNAL',
          verifiedByNcv: false,
        })
      }
    }
  }
}
