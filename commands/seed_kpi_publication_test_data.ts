import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import ScientificProfile from '#models/scientific_profile'
import Publication from '#models/publication'
import PublicationAuthor from '#models/publication_author'
import KpiEngineService from '#services/kpi_engine_service'

type PubLeaf = {
  id: number
  code: string
  name: string
}

type CreatedPublication = {
  id: number
  code: string
  title: string
  ownerProfileId: number
  hours: number
  points: number
}

const TAG = '[TEST1883]'
const ORG = 'Trường Đại học Sư phạm - Đại học Đà Nẵng'

function toRankFromCode(code: string): { rank: string | null; quartile: string | null } {
  if (code.includes('WOS')) return { rank: 'WOS', quartile: code.includes('NO_Q') ? 'NO_Q' : code.slice(-2) }
  if (code.includes('SCOPUS')) return { rank: 'SCOPUS', quartile: code.includes('NO_Q') ? 'NO_Q' : code.slice(-2) }
  if (code === 'PUB_DOMESTIC_HDGNN') return { rank: 'DOMESTIC', quartile: null }
  if (code === 'PUB_CONF_ISBN') return { rank: 'CONFERENCE', quartile: null }
  return { rank: null, quartile: null }
}

function isHdgsnnLeaf(code: string, name: string): boolean {
  const c = code.toUpperCase()
  const n = name.toLowerCase()
  return c.includes('HDG') || n.includes('hdgsnn')
}

function isIsbnLeaf(code: string, name: string): boolean {
  const c = code.toUpperCase()
  const n = name.toLowerCase()
  return c.includes('ISBN') || n.includes('isbn')
}

async function getOrCreateUserProfile(input: {
  email: string
  fullName: string
  gender: 'MALE' | 'FEMALE'
}): Promise<{ user: User; profile: ScientificProfile }> {
  let user = await User.query().where('email', input.email).first()
  if (!user) {
    user = await User.create({
      fullName: input.fullName,
      email: input.email,
      // User model tự hash password qua withAuthFinder.
      password: 'Test@123456',
      role: 'NCV',
      roleLabel: 'Nhà khoa học',
      isActive: true,
    })
  }

  let profile = await ScientificProfile.query().where('user_id', user.id).first()
  if (!profile) {
    profile = await ScientificProfile.create({
      userId: user.id,
      fullName: input.fullName,
      workEmail: input.email,
      organization: ORG,
      gender: input.gender,
      status: 'UPDATED',
      completeness: 100,
    })
  } else {
    profile.fullName = input.fullName
    profile.workEmail = input.email
    profile.organization = ORG
    profile.gender = input.gender
    await profile.save()
  }

  return { user, profile }
}

async function cleanupOldTestPublications(profileIds: number[]) {
  if (!profileIds.length) return
  const oldIds = await Publication.query()
    .whereIn('profile_id', profileIds)
    .whereILike('title', `${TAG}%`)
    .select('id')
  const ids = oldIds.map((x) => Number(x.id))
  if (!ids.length) return
  await PublicationAuthor.query().whereIn('publication_id', ids).delete()
  await Publication.query().whereIn('id', ids).delete()
}

async function fetchPublicationLeafTypes(): Promise<PubLeaf[]> {
  let rows = await db
    .from('research_output_types as t')
    .select('t.id', 't.code', 't.name')
    .where('t.is_active', true)
    .whereLike('t.code', 'PUB_%')
    .whereNotExists((sub) => {
      sub.from('research_output_types as c').select(db.raw('1')).whereRaw('c.parent_id = t.id')
    })
    .orderBy('t.sort_order', 'asc')

  if (rows.length === 0) {
    rows = await db
      .from('research_output_types as t')
      .join('research_output_rules as r', 'r.type_id', 't.id')
      .leftJoin('research_output_types as p1', 'p1.id', 't.parent_id')
      .leftJoin('research_output_types as p0', 'p0.id', 'p1.parent_id')
      .select('t.id', 't.code', 't.name')
      .where('t.is_active', true)
      .whereNotExists((sub) => {
        sub.from('research_output_types as c').select(db.raw('1')).whereRaw('c.parent_id = t.id')
      })
      .where((q) => {
        q.whereILike('t.code', 'PUB_%')
          .orWhereILike('t.name', '%bài báo%')
          .orWhereILike('t.name', '%hội thảo%')
          .orWhereILike('p1.name', '%bài báo%')
          .orWhereILike('p1.name', '%hội thảo%')
          .orWhereILike('p0.name', '%bài báo%')
          .orWhereILike('p0.name', '%hội thảo%')
          .orWhereILike('p0.name', '%công bố%')
      })
      .orderBy('t.sort_order', 'asc')
  }

  return rows.map((r) => ({ id: Number(r.id), code: String(r.code), name: String(r.name) }))
}

async function createPublicationWithAuthors(input: {
  profileId: number
  isFemaleContext?: boolean
  code: string
  name: string
  typeId: number
  authors: Array<{
    profileId: number | null
    fullName: string
    isMainAuthor: boolean
    isCorresponding: boolean
    affiliationType: 'UDN_ONLY' | 'MIXED' | 'OUTSIDE'
    isMultiAffiliationOutsideUdn?: boolean
  }>
  hdgsnnScore?: number | null
  isbn?: string | null
  domesticRuleType?: string | null
}): Promise<CreatedPublication> {
  const authorNames = input.authors.map((a) => a.fullName).join('; ')
  const rankInfo = toRankFromCode(input.code)
  const now = new Date()

  const publication = await Publication.create({
    profileId: input.profileId,
    researchOutputTypeId: input.typeId,
    title: `${TAG}[${input.code}] ${input.name}`,
    authors: authorNames,
    correspondingAuthor: input.authors.find((a) => a.isCorresponding)?.fullName || null,
    myRole: 'AUTHOR',
    publicationType: 'JOURNAL',
    journalOrConference: `Tap chi/Ky yeu test ${input.code}`,
    year: now.getFullYear(),
    volume: '1',
    issue: '1',
    pages: '1-10',
    rank: rankInfo.rank,
    quartile: rankInfo.quartile,
    doi: `10.1883/test.${input.code.toLowerCase()}`,
    issn: '1234-5678',
    isbn: input.isbn ?? null,
    url: `https://example.com/${input.code.toLowerCase()}`,
    publicationStatus: 'PUBLISHED',
    academicYear: '2025-2026',
    source: 'INTERNAL',
    sourceId: `TEST-${input.code}-${now.getTime()}`,
    verifiedByNcv: true,
    approvedInternal: true,
    attachmentUrl: null,
    domesticRuleType: input.domesticRuleType ?? null,
    hdgsnnScore: input.hdgsnnScore ?? null,
  })

  for (let i = 0; i < input.authors.length; i++) {
    const a = input.authors[i]!
    await PublicationAuthor.create({
      publicationId: publication.id,
      profileId: a.profileId,
      fullName: a.fullName,
      authorOrder: i + 1,
      isMainAuthor: a.isMainAuthor,
      isCorresponding: a.isCorresponding,
      affiliationType: a.affiliationType,
      isMultiAffiliationOutsideUdn: a.isMultiAffiliationOutsideUdn === true,
      contributionPercent: null,
    })
  }

  const result = await KpiEngineService.calculateOutputHours(
    {
      type: 'PUBLICATION',
      publication: {
        id: publication.id,
        ownerProfileId: input.profileId,
        researchOutputTypeId: input.typeId,
        hdgsnnScore: input.hdgsnnScore ?? null,
      },
      authors: input.authors.map((a) => ({
        profileId: a.profileId,
        fullName: a.fullName,
        isMainAuthor: a.isMainAuthor,
        isCorresponding: a.isCorresponding,
        affiliationType: a.affiliationType,
        isMultiAffiliationOutsideUdn: a.isMultiAffiliationOutsideUdn === true,
      })),
    },
    {
      profileId: input.profileId,
      academicYear: '2025-2026',
      isFemale: input.isFemaleContext === true,
      profileFullName: input.authors[0]?.fullName ?? null,
    }
  )

  return {
    id: publication.id,
    code: input.code,
    title: publication.title,
    ownerProfileId: input.profileId,
    hours: result.hours,
    points: result.points ?? 0,
  }
}

export default class SeedKpiPublicationTestData extends BaseCommand {
  static commandName = 'seed:kpi-publication-test-data'
  static description =
    'Tạo dữ liệu test thật cho toàn bộ lá công bố PUB_* và các ca công thức trọng yếu theo QĐ 1883'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({
    flagName: 'email',
    description: 'Email tài khoản test chính (mặc định: ncv.test.kpi@dhsudn.local)',
  })
  declare email?: string

  async run() {
    const mainEmail = (this.email || 'ncv.test.kpi@dhsudn.local').trim().toLowerCase()
    const femaleEmail = 'ncv.test.kpi.female@dhsudn.local'

    const { profile: mainProfile } = await getOrCreateUserProfile({
      email: mainEmail,
      fullName: 'NCV TEST KPI',
      gender: 'MALE',
    })
    const { profile: femaleProfile } = await getOrCreateUserProfile({
      email: femaleEmail,
      fullName: 'NCV TEST KPI FEMALE',
      gender: 'FEMALE',
    })

    await cleanupOldTestPublications([Number(mainProfile.id), Number(femaleProfile.id)])

    const leafTypes = await fetchPublicationLeafTypes()
    if (!leafTypes.length) {
      this.logger.error('Không tìm thấy lá PUB_* trong bảng research_output_types.')
      this.exitCode = 1
      return
    }

    const created: CreatedPublication[] = []

    for (const leaf of leafTypes) {
      const row = await createPublicationWithAuthors({
        profileId: Number(mainProfile.id),
        code: leaf.code,
        name: leaf.name,
        typeId: leaf.id,
        hdgsnnScore: isHdgsnnLeaf(leaf.code, leaf.name) ? 1.5 : null,
        isbn: isIsbnLeaf(leaf.code, leaf.name) ? '978-604-00-0000-0' : null,
        domesticRuleType: isHdgsnnLeaf(leaf.code, leaf.name)
          ? 'HDGSNN_SCORE'
          : isIsbnLeaf(leaf.code, leaf.name)
            ? 'CONFERENCE_ISBN'
            : null,
        authors: [
          {
            profileId: Number(mainProfile.id),
            fullName: 'NCV TEST KPI',
            isMainAuthor: true,
            isCorresponding: true,
            affiliationType: 'UDN_ONLY',
          },
          {
            profileId: null,
            fullName: 'Dong tac gia 01',
            isMainAuthor: true,
            isCorresponding: true,
            affiliationType: 'UDN_ONLY',
          },
        ],
      })
      created.push(row)
    }

    const baseLeaf = leafTypes[0]!
    created.push(
      await createPublicationWithAuthors({
        profileId: Number(mainProfile.id),
        code: `${baseLeaf.code}_A15`,
        name: 'Ca he so a = 1.5',
        typeId: baseLeaf.id,
        authors: [
          {
            profileId: Number(mainProfile.id),
            fullName: 'NCV TEST KPI',
            isMainAuthor: true,
            isCorresponding: true,
            affiliationType: 'UDN_ONLY',
          },
          {
            profileId: null,
            fullName: 'Dong tac gia MIXED',
            isMainAuthor: true,
            isCorresponding: true,
            affiliationType: 'MIXED',
          },
        ],
      })
    )
    created.push(
      await createPublicationWithAuthors({
        profileId: Number(mainProfile.id),
        code: `${baseLeaf.code}_OUTSIDE`,
        name: 'Ca muc 1.5 OUTSIDE',
        typeId: baseLeaf.id,
        authors: [
          {
            profileId: Number(mainProfile.id),
            fullName: 'NCV TEST KPI',
            isMainAuthor: true,
            isCorresponding: true,
            affiliationType: 'OUTSIDE',
          },
          {
            profileId: null,
            fullName: 'Dong tac gia 02',
            isMainAuthor: true,
            isCorresponding: true,
            affiliationType: 'UDN_ONLY',
          },
        ],
      })
    )
    created.push(
      await createPublicationWithAuthors({
        profileId: Number(mainProfile.id),
        code: `${baseLeaf.code}_MIXED_HALF`,
        name: 'Ca MIXED chia 2',
        typeId: baseLeaf.id,
        authors: [
          {
            profileId: Number(mainProfile.id),
            fullName: 'NCV TEST KPI',
            isMainAuthor: true,
            isCorresponding: true,
            affiliationType: 'MIXED',
            isMultiAffiliationOutsideUdn: true,
          },
          {
            profileId: null,
            fullName: 'Dong tac gia 03',
            isMainAuthor: true,
            isCorresponding: true,
            affiliationType: 'UDN_ONLY',
          },
        ],
      })
    )
    created.push(
      await createPublicationWithAuthors({
        profileId: Number(mainProfile.id),
        code: `${baseLeaf.code}_COAUTHOR`,
        name: 'Ca dong tac gia',
        typeId: baseLeaf.id,
        authors: [
          {
            profileId: Number(mainProfile.id),
            fullName: 'NCV TEST KPI',
            isMainAuthor: false,
            isCorresponding: false,
            affiliationType: 'UDN_ONLY',
          },
          {
            profileId: null,
            fullName: 'Tac gia chinh 01',
            isMainAuthor: true,
            isCorresponding: true,
            affiliationType: 'UDN_ONLY',
          },
          {
            profileId: null,
            fullName: 'Tac gia 03',
            isMainAuthor: false,
            isCorresponding: false,
            affiliationType: 'UDN_ONLY',
          },
        ],
      })
    )
    created.push(
      await createPublicationWithAuthors({
        profileId: Number(mainProfile.id),
        code: `${baseLeaf.code}_SINGLE`,
        name: 'Ca 1 tac gia',
        typeId: baseLeaf.id,
        authors: [
          {
            profileId: Number(mainProfile.id),
            fullName: 'NCV TEST KPI',
            isMainAuthor: false,
            isCorresponding: false,
            affiliationType: 'UDN_ONLY',
          },
        ],
      })
    )
    created.push(
      await createPublicationWithAuthors({
        profileId: Number(femaleProfile.id),
        isFemaleContext: true,
        code: `${baseLeaf.code}_FEMALE`,
        name: 'Ca he so nu 1.2',
        typeId: baseLeaf.id,
        authors: [
          {
            profileId: Number(femaleProfile.id),
            fullName: 'NCV TEST KPI FEMALE',
            isMainAuthor: true,
            isCorresponding: true,
            affiliationType: 'UDN_ONLY',
          },
          {
            profileId: null,
            fullName: 'Dong tac gia 04',
            isMainAuthor: true,
            isCorresponding: true,
            affiliationType: 'UDN_ONLY',
          },
        ],
      })
    )

    this.logger.info(`Đã tạo tài khoản test chính: ${mainEmail}`)
    this.logger.info(`Đã tạo tài khoản test nữ: ${femaleEmail}`)
    this.logger.success(`Đã tạo tổng cộng ${created.length} công bố test.`)

    for (const c of created) {
      this.logger.info(
        `  [OK] pub_id=${c.id} | code=${c.code} | profile_id=${c.ownerProfileId} | giờ=${c.hours} | điểm=${c.points}`
      )
    }

    this.logger.info('Gợi ý số test case cơ bản theo phụ lục 1883 cho nhóm công bố:')
    this.logger.info('  - 12 case lá danh mục PUB_* (mỗi lá 1 case chuẩn)')
    this.logger.info('  - 6 case công thức trọng yếu (a=1.5, OUTSIDE, MIXED chia 2, đồng tác giả, 1 tác giả, nữ)')
    this.logger.info('  => Tối thiểu 18 case cơ bản.')
  }
}
