import openAlexConfig from '#config/openalex'
import ResearchOutputType from '#models/research_output_type'
import JournalIndexLookupService from '#services/journal_index_lookup_service'

type OpenAlexAuthor = {
  id?: string
  display_name?: string
  orcid?: string | null
}

type OpenAlexInstitution = {
  display_name?: string
}

type OpenAlexAuthorship = {
  author?: OpenAlexAuthor
  institutions?: OpenAlexInstitution[]
  is_corresponding?: boolean
}

type OpenAlexSource = {
  display_name?: string
  issn_l?: string | null
  issn?: string[] | null
  type?: string | null
}

type OpenAlexLocation = {
  source?: OpenAlexSource | null
  landing_page_url?: string | null
}

type OpenAlexBiblio = {
  volume?: string | null
  issue?: string | null
  first_page?: string | null
  last_page?: string | null
}

type OpenAlexWork = {
  id?: string
  title?: string
  display_name?: string
  publication_year?: number
  doi?: string | null
  type?: string | null
  type_crossref?: string | null
  biblio?: OpenAlexBiblio | null
  primary_location?: OpenAlexLocation | null
  locations?: OpenAlexLocation[]
  authorships?: OpenAlexAuthorship[]
}

export type OpenAlexPublicationAuthorDraft = {
  fullName: string
  profileId: number | null
  authorOrder: number
  isMainAuthor: boolean
  isCorresponding: boolean
  affiliationUnits: string[]
  affiliationType: 'UDN_ONLY' | 'MIXED' | 'OUTSIDE'
  isMultiAffiliationOutsideUdn: boolean
}

export type OpenAlexPublicationDraft = {
  source: 'OPENALEX'
  sourceId: string
  title: string
  year: number | null
  doi: string | null
  issn: string | null
  volume: string | null
  issue: string | null
  pages: string | null
  url: string | null
  journalOrConference: string
  publicationType: 'JOURNAL' | 'CONFERENCE'
  publicationStatus: 'PUBLISHED'
  authorsText: string
  researchOutputTypeId: number | null
  researchOutputTypeCode: string | null
  typeMappingReason: string
  needsIndexConfirmation: boolean
  authors: OpenAlexPublicationAuthorDraft[]
}

const OTHER_ORG_LABEL = 'Other Organization (Đơn vị khác)'
const UDN_AFFILIATION_UNITS = [
  'The University of Danang (Đại học Đà Nẵng)',
  'The University of Danang - University of Science and Technology (Trường Đại học Bách khoa)',
  'The University of Danang - University of Economics (Trường Đại học Kinh tế)',
  'The University of Danang - University of Science and Education (Trường Đại học Sư phạm)',
  'University of Foreign Language Studies - The University of Danang (Trường Đại học Ngoại ngữ)',
  'University of Technology and Education - The University of Danang (Trường Đại học Sư phạm Kỹ thuật)',
  'Vietnam-Korea University of Information and Communication Technology - The University of Danang (Trường Đại học Công nghệ Thông tin và Truyền thông Việt - Hàn)',
  'School of Medicine and Pharmacy - The University of Danang (Trường Y Dược)',
  'The University of Danang Campus in Kon Tum (Phân hiệu Đại học Đà Nẵng tại Kon Tum)',
  'Vietnam-UK Institute for Research and Executive Education - The University of Danang (Viện Nghiên cứu và Đào tạo Việt - Anh)',
  'Danang International Institute of Technology - The University of Danang (Viện Công nghệ Quốc tế DNIIT)',
  'Faculty of Physical Education - The University of Danang (Khoa Giáo dục Thể chất)',
  'Center for Defense and Security Education - The University of Danang (Trung tâm Giáo dục Quốc phòng và An ninh)',
] as const

function normalizeSpace(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function toOpenAlexOrcid(orcid: string): string {
  const raw = orcid.trim()
  if (!raw) return ''
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw
  return `https://orcid.org/${raw}`
}

function pickFirstIssn(work: OpenAlexWork): string | null {
  const fromPrimary = work.primary_location?.source?.issn_l?.trim()
  if (fromPrimary) return fromPrimary
  const arr = work.primary_location?.source?.issn
  if (Array.isArray(arr)) {
    const f = arr.find((x) => typeof x === 'string' && x.trim().length > 0)
    if (f) return f.trim()
  }
  return null
}

function composePages(biblio: OpenAlexBiblio | null | undefined): string | null {
  const first = biblio?.first_page?.trim()
  const last = biblio?.last_page?.trim()
  if (first && last) return `${first}-${last}`
  return first || last || null
}

function looksLikeConference(work: OpenAlexWork): boolean {
  const t = String(work.type ?? work.type_crossref ?? '')
    .toLowerCase()
    .trim()
  if (t.includes('proceedings') || t.includes('conference')) return true
  const venue = String(work.primary_location?.source?.display_name ?? '')
    .toLowerCase()
    .trim()
  return venue.includes('conference') || venue.includes('symposium') || venue.includes('workshop')
}

function inferPublicationType(work: OpenAlexWork): 'JOURNAL' | 'CONFERENCE' {
  return looksLikeConference(work) ? 'CONFERENCE' : 'JOURNAL'
}

function inferResearchOutputTypeCode(work: OpenAlexWork): { code: string; reason: string } {
  if (looksLikeConference(work)) {
    return {
      code: 'QD_R15',
      reason: 'OpenAlex nhận diện dạng hội thảo/proceedings nên map mặc định vào QD_R15.',
    }
  }
  return {
    code: 'QD_R11',
    reason:
      'OpenAlex không cung cấp quartile Q1-Q4 trực tiếp cho từng bài, nên bài báo tạp chí được map mặc định vào QD_R11 nếu chưa tra được chỉ mục.',
  }
}

function mapInstitutionToUdnUnit(name: string): string | null {
  const n = normalizeSpace(name)
  if (!n) return null
  const found = UDN_AFFILIATION_UNITS.find((unit) => {
    const u = normalizeSpace(unit)
    return n === u || n.includes(u) || u.includes(n)
  })
  if (found) return found
  if (n.includes('university of danang') || n.includes('dai hoc da nang')) {
    return UDN_AFFILIATION_UNITS[0]
  }
  return null
}

function deriveAffiliationTypeFromUnits(units: string[]): 'UDN_ONLY' | 'MIXED' | 'OUTSIDE' {
  const hasOutside = units.includes(OTHER_ORG_LABEL)
  const hasUdn = units.some((u) => u !== OTHER_ORG_LABEL)
  if (hasOutside && hasUdn) return 'MIXED'
  if (hasOutside) return 'OUTSIDE'
  return 'UDN_ONLY'
}

async function mapTypeCodeToId(code: string): Promise<number | null> {
  const t = await ResearchOutputType.query().where('code', code).first()
  return t?.id ?? null
}

function stripDoiPrefix(doi: string | null | undefined): string | null {
  if (!doi) return null
  const trimmed = doi.trim()
  if (!trimmed) return null
  return trimmed.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
}

export default class OpenAlexService {
  static async resolveAuthorIdByOrcid(orcid: string): Promise<string | null> {
    const orcidUrl = toOpenAlexOrcid(orcid)
    if (!orcidUrl) return null
    const url = new URL('/authors', openAlexConfig.baseUrl)
    url.searchParams.set('filter', `orcid:${orcidUrl}`)
    url.searchParams.set('per-page', '1')
    if (openAlexConfig.mailto) url.searchParams.set('mailto', openAlexConfig.mailto)
    if (openAlexConfig.apiKey) url.searchParams.set('api_key', openAlexConfig.apiKey)

    const res = await fetch(url.toString())
    if (!res.ok) return null
    const json = (await res.json()) as { results?: Array<{ id?: string }> }
    return json.results?.[0]?.id ?? null
  }

  static async fetchPublicationDraftsByOrcid(params: {
    orcid: string
    profileId: number
    profileFullName: string
    year?: number
    perPage?: number
  }): Promise<OpenAlexPublicationDraft[]> {
    const normalizedOwnerOrcid = normalizeSpace(toOpenAlexOrcid(params.orcid))
    const authorId = await this.resolveAuthorIdByOrcid(params.orcid)
    if (!authorId) return []

    const perPage = Math.min(Math.max(params.perPage ?? 20, 1), 50)
    const url = new URL('/works', openAlexConfig.baseUrl)
    url.searchParams.set('filter', `authorships.author.id:${authorId}`)
    url.searchParams.set('per-page', String(perPage))
    url.searchParams.set('sort', 'publication_year:desc')
    if (params.year && Number.isFinite(params.year)) {
      url.searchParams.set('filter', `authorships.author.id:${authorId},publication_year:${params.year}`)
    }
    if (openAlexConfig.mailto) url.searchParams.set('mailto', openAlexConfig.mailto)
    if (openAlexConfig.apiKey) url.searchParams.set('api_key', openAlexConfig.apiKey)

    const res = await fetch(url.toString())
    if (!res.ok) {
      throw new Error(`OpenAlex trả về lỗi HTTP ${res.status}`)
    }
    const json = (await res.json()) as { results?: OpenAlexWork[] }
    const works = Array.isArray(json.results) ? json.results : []

    return Promise.all(
      works.map(async (work) => {
        const title = String(work.title ?? work.display_name ?? '').trim() || 'Không có tiêu đề'
        const journalOrConference =
          String(work.primary_location?.source?.display_name ?? '').trim() || 'Không rõ nguồn công bố'
        const publicationType = inferPublicationType(work)
        const doi = stripDoiPrefix(work.doi)
        const issn = pickFirstIssn(work)
        const pages = composePages(work.biblio)
        const volume = work.biblio?.volume?.trim() || null
        const issue = work.biblio?.issue?.trim() || null
        const urlValue =
          work.primary_location?.landing_page_url?.trim() ||
          work.locations?.find((x) => typeof x.landing_page_url === 'string' && x.landing_page_url.trim())?.landing_page_url?.trim() ||
          null
        const { code: researchOutputTypeCode, reason: typeMappingReason } = inferResearchOutputTypeCode(work)
        let mappedCode: string | null = researchOutputTypeCode
        let mappedId: number | null = await mapTypeCodeToId(researchOutputTypeCode)
        let mappedReason = typeMappingReason
        let needsIndexConfirmation = false
        if (publicationType === 'JOURNAL') {
          // Với bài tạp chí: chỉ map mã lá khi tra được dữ liệu chỉ mục theo ISSN+năm.
          // Nếu không đủ dữ liệu thì để trống để bắt buộc user/chuyên viên chọn lại mục lá.
          mappedCode = null
          mappedId = null
          needsIndexConfirmation = true
          const resolved = await JournalIndexLookupService.resolveByIssn({
            issn,
            issnL: work.primary_location?.source?.issn_l ?? null,
            year: Number.isFinite(Number(work.publication_year)) ? Number(work.publication_year) : null,
          })
          if (resolved.code) mappedCode = resolved.code
          if (resolved.typeId) mappedId = resolved.typeId
          mappedReason = resolved.reason
          needsIndexConfirmation = resolved.needsConfirmation
        }

        const ownerNorm = normalizeSpace(params.profileFullName)
        const authors = (Array.isArray(work.authorships) ? work.authorships : []).map((a, idx) => {
          const fullName = String(a.author?.display_name ?? '').trim() || `Tác giả ${idx + 1}`
          const institutions = Array.isArray(a.institutions) ? a.institutions : []
          const mappedUnits = Array.from(
            new Set(
              institutions
                .map((i) => String(i.display_name ?? '').trim())
                .map((name) => mapInstitutionToUdnUnit(name))
                .filter((v): v is string => Boolean(v))
            )
          )
          const hasOutsideFromInstitutions = institutions.some((i) => !mapInstitutionToUdnUnit(String(i.display_name ?? '')))
          const affiliationUnits = [...mappedUnits]
          if (affiliationUnits.length === 0 || hasOutsideFromInstitutions) {
            affiliationUnits.push(OTHER_ORG_LABEL)
          }
          const normalizedUnits = Array.from(new Set(affiliationUnits))
          const affiliationType = deriveAffiliationTypeFromUnits(normalizedUnits)
          const normalizedAuthorOrcid = normalizeSpace(String(a.author?.orcid ?? ''))
          const isOwnerByOrcid =
            normalizedOwnerOrcid.length > 0 &&
            normalizedAuthorOrcid.length > 0 &&
            normalizedOwnerOrcid === normalizedAuthorOrcid
          const isOwnerByName = ownerNorm.length >= 2 && normalizeSpace(fullName) === ownerNorm
          return {
            fullName,
            profileId: isOwnerByOrcid || isOwnerByName ? params.profileId : null,
            authorOrder: idx + 1,
            isMainAuthor: idx === 0,
            isCorresponding: Boolean(a.is_corresponding),
            affiliationUnits: normalizedUnits,
            affiliationType,
            isMultiAffiliationOutsideUdn: affiliationType === 'MIXED',
          } satisfies OpenAlexPublicationAuthorDraft
        })

        const authorsText = authors.map((a) => a.fullName).join(', ')

        return {
          source: 'OPENALEX',
          sourceId: String(work.id ?? ''),
          title,
          year: Number.isFinite(Number(work.publication_year)) ? Number(work.publication_year) : null,
          doi,
          issn,
          volume,
          issue,
          pages,
          url: urlValue,
          journalOrConference,
          publicationType,
          publicationStatus: 'PUBLISHED',
          authorsText,
          researchOutputTypeId: mappedId,
          researchOutputTypeCode: mappedCode,
          typeMappingReason: mappedReason,
          needsIndexConfirmation,
          authors,
        } satisfies OpenAlexPublicationDraft
      })
    )
  }
}
