import type { CalculationResult, KpiContext, KpiOutput } from '#types/kpi'
import ResearchOutputRule from '#models/research_output_rule'

const ACCEPTANCE_GRADE_CFACTOR: Record<string, number> = {
  EXCELLENT: 1.1,
  PASS_ON_TIME: 1.0,
  PASS_LATE: 0.5,
}

export function projectStrategySupports(output: KpiOutput): boolean {
  return output.type === 'PROJECT'
}

export async function projectStrategyCalculate(
  output: KpiOutput,
  _context: KpiContext
): Promise<CalculationResult> {
  const warnings: string[] = []
  if (output.type !== 'PROJECT') {
    return { hours: 0, points: 0, warnings: ['Output không phải PROJECT'] }
  }

  const { project } = output
  const typeId = project.researchOutputTypeId

  if (!typeId) {
    warnings.push('Đề xuất đề tài chưa gán loại kết quả NCKH (research_output_type_id)')
    return { hours: 0, points: 0, warnings, details: { projectId: project.id } }
  }

  let rule: ResearchOutputRule
  try {
    rule = await ResearchOutputRule.query().where('type_id', typeId).firstOrFail()
  } catch {
    warnings.push(`Không tìm thấy rule cho type_id=${typeId}`)
    return { hours: 0, points: 0, warnings, details: { projectId: project.id, typeId } }
  }

  const kind = (rule.ruleKind || '').toUpperCase()
  const baseHours = rule.hoursValue != null ? Number(rule.hoursValue) : 0
  const basePoints =
    rule.pointsValue != null && Number(rule.pointsValue) > 0
      ? Number(rule.pointsValue)
      : baseHours

  if (kind === 'MULTIPLY_C') {
    if (baseHours <= 0) {
      warnings.push(`Rule type_id=${typeId} có hours_value không hợp lệ`)
      return { hours: 0, points: 0, warnings }
    }

    let cFactor: number
    if (project.cFactor != null && project.cFactor > 0) {
      cFactor = Number(project.cFactor)
    } else if (project.acceptanceGrade) {
      const grade = project.acceptanceGrade.trim().toUpperCase()
      cFactor = ACCEPTANCE_GRADE_CFACTOR[grade]
      if (cFactor === undefined) {
        warnings.push(`Thiếu mapping acceptance_grade: ${project.acceptanceGrade}`)
        return { hours: 0, points: 0, warnings, details: { projectId: project.id } }
      }
    } else {
      warnings.push('Thiếu acceptance_grade và c_factor cho đề tài')
      return { hours: 0, points: 0, warnings, details: { projectId: project.id } }
    }

    const hours = Math.round(baseHours * cFactor * 100) / 100
    const points = Math.round(basePoints * cFactor * 100) / 100
    return {
      hours,
      points,
      warnings,
      details: { projectId: project.id, typeId, baseHours, basePoints, cFactor, ruleKind: kind },
    }
  }

  if (kind === 'FIXED') {
    if (baseHours <= 0) {
      warnings.push('FIXED: hours_value không hợp lệ')
      return { hours: 0, points: 0, warnings }
    }
    const points = Math.round(basePoints * 100) / 100
    return {
      hours: Math.round(baseHours * 100) / 100,
      points,
      warnings,
      details: { projectId: project.id, typeId, baseHours, basePoints, ruleKind: kind },
    }
  }

  warnings.push(`Rule kind ${kind} cho đề tài chưa được hỗ trợ đầy đủ`)
  return { hours: 0, points: 0, warnings, details: { projectId: project.id, typeId, ruleKind: kind } }
}
