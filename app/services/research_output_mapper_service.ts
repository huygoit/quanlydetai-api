import ResearchOutputType from '#models/research_output_type'

/** Publication để map sang type_id */
export interface PublicationForMapping {
  id?: number
  rank: string | null
  quartile: string | null
  domesticRuleType?: string | null
}

/** Project để map sang type_id */
export interface ProjectForMapping {
  id?: number
  level: string
  acceptanceGrade?: string | null
}

/**
 * Map publication -> leaf code theo spec refactor-kpi.
 * ISI: PUB_WOS_Q1..Q4, PUB_WOS_NO_Q
 * SCOPUS: PUB_SCOPUS_Q1..Q4, PUB_SCOPUS_NO_Q
 * DOMESTIC/OTHER: PUB_DOMESTIC_HDGNN, PUB_CONF_ISBN
 */
function mapPublicationToLeafCode(pub: PublicationForMapping): string | null {
  const rank = (pub.rank ?? '').trim().toUpperCase()
  const quartile = (pub.quartile ?? '').trim().toUpperCase()
  const qLabel = ['Q1', 'Q2', 'Q3', 'Q4'].includes(quartile) ? quartile : 'NO_Q'

  if (rank === 'ISI') return `PUB_WOS_${qLabel}`
  if (rank === 'SCOPUS') return `PUB_SCOPUS_${qLabel}`

  if (rank === 'DOMESTIC' || rank === 'OTHER') {
    const dt = (pub.domesticRuleType ?? '').trim().toUpperCase()
    if (dt === 'HDGSNN_SCORE') return 'PUB_DOMESTIC_HDGNN'
    if (dt === 'CONFERENCE_ISBN') return 'PUB_CONF_ISBN'
  }

  return null
}

/**
 * Map publication -> type_id. Throw nếu không xác định được.
 */
export async function mapPublicationToTypeId(pub: PublicationForMapping): Promise<number> {
  const code = mapPublicationToLeafCode(pub)
  if (!code) {
    const pubId = pub.id ?? '?'
    throw new Error(`Không xác định được loại kết quả NCKH cho publication id=${pubId}. Kiểm tra rank, quartile, domestic_rule_type.`)
  }
  const type = await ResearchOutputType.query().where('code', code).first()
  if (!type) {
    const pubId = pub.id ?? '?'
    throw new Error(
      `Không xác định được loại kết quả NCKH cho publication id=${pubId}. Leaf code "${code}" chưa có trong research_output_types.`
    )
  }
  return type.id
}

/**
 * Map project (level + acceptance_grade) -> type_id.
 * Level NHA_NUOC -> PROJECT_ACCEPTED_NATIONAL, BO -> PROJECT_ACCEPTED_MINISTRY, TRUONG/CO_SO -> PROJECT_ACCEPTED_UNIVERSITY
 */
const PROJECT_LEVEL_TO_CODE: Record<string, string> = {
  NHA_NUOC: 'PROJECT_ACCEPTED_NATIONAL',
  BO: 'PROJECT_ACCEPTED_MINISTRY',
  TRUONG: 'PROJECT_ACCEPTED_UNIVERSITY',
  CO_SO: 'PROJECT_ACCEPTED_UNIVERSITY',
}

export async function mapProjectToTypeId(project: ProjectForMapping): Promise<number> {
  const level = (project.level ?? '').trim().toUpperCase()
  const code = PROJECT_LEVEL_TO_CODE[level] ?? 'PROJECT_ACCEPTED_UNIVERSITY'
  const type = await ResearchOutputType.query().where('code', code).first()
  if (!type) {
    const projId = project.id ?? '?'
    throw new Error(
      `Không xác định được loại kết quả NCKH cho project id=${projId}. Leaf code "${code}" chưa có trong research_output_types.`
    )
  }
  return type.id
}
