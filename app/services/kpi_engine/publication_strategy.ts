import type { CalculationResult, KpiContext, KpiOutput } from '#types/kpi'
import { mapPublicationToTypeId } from '#services/research_output_mapper_service'
import ResearchOutputRule from '#models/research_output_rule'

/** Hệ số a_factor theo affiliation_type */
const A_FACTOR: Record<string, number> = {
  UDN_ONLY: 1,
  MIXED: 0.7,
  OUTSIDE: 0.5,
}

export function publicationStrategySupports(output: KpiOutput): boolean {
  return output.type === 'PUBLICATION'
}

export async function publicationStrategyCalculate(
  output: KpiOutput,
  context: KpiContext
): Promise<CalculationResult> {
  const warnings: string[] = []
  if (output.type !== 'PUBLICATION') {
    return { hours: 0, warnings: ['Output không phải PUBLICATION'] }
  }

  const { publication, authors } = output

  if (!authors || authors.length === 0) {
    warnings.push('Publication chưa có authors')
    return { hours: 0, warnings, details: { publicationId: publication.id } }
  }

  const p = authors.length
  const mainAuthors = authors.filter((a) => a.isMainAuthor)
  const n = mainAuthors.length

  if (n < 1) {
    warnings.push('Số tác giả chính (n) phải >= 1')
    return { hours: 0, warnings, details: { n, p } }
  }
  if (p < 1) {
    warnings.push('Tổng số tác giả (p) phải >= 1')
    return { hours: 0, warnings, details: { n, p } }
  }
  if (n > p) {
    warnings.push('Số tác giả chính (n) không được lớn hơn tổng số tác giả (p)')
    return { hours: 0, warnings, details: { n, p } }
  }

  const typeId = await mapPublicationToTypeId({
    id: publication.id,
    rank: publication.rank,
    quartile: publication.quartile,
    domesticRuleType: publication.domesticRuleType,
  })

  const rule = await ResearchOutputRule.query()
    .where('type_id', typeId)
    .firstOrFail()

  const kind = (rule.ruleKind || '').toUpperCase()
  if (kind !== 'FIXED' && kind !== 'MULTIPLY_A') {
    warnings.push(`Rule kind ${kind} chưa được hỗ trợ (chỉ FIXED, MULTIPLY_A)`)
    return { hours: 0, warnings, details: { typeId, ruleKind: kind } }
  }

  const B0 = rule.hoursValue != null ? Number(rule.hoursValue) : 0
  if (B0 <= 0) {
    warnings.push(`Rule type_id=${typeId} có hours_value không hợp lệ`)
    return { hours: 0, warnings }
  }

  const authorForProfile = authors.find((a) => a.profileId === context.profileId)
  if (!authorForProfile) {
    warnings.push('Giảng viên không nằm trong danh sách tác giả của bài báo')
    return { hours: 0, warnings, details: { publicationId: publication.id, profileId: context.profileId } }
  }

  const aFactor = A_FACTOR[authorForProfile.affiliationType] ?? 1
  const B = B0 * aFactor

  const isMain = authorForProfile.isMainAuthor
  let hours = isMain ? B / (3 * n) + (2 * B) / (3 * p) : (2 * B) / (3 * p)

  if (authorForProfile.isMultiAffiliationOutsideUdn) {
    hours /= 2
  }
  if (context.isFemale) {
    hours *= 1.2
  }

  hours = Math.round(hours * 100) / 100

  return {
    hours,
    warnings,
    details: {
      publicationId: publication.id,
      typeId,
      B0,
      aFactor,
      B,
      n,
      p,
      isMainAuthor: isMain,
      multiAffiliationDivide: authorForProfile.isMultiAffiliationOutsideUdn,
      femaleBonus: context.isFemale ?? false,
    },
  }
}
