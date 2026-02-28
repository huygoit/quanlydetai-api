import type { CalculationResult, KpiContext, KpiOutput } from '#types/kpi'
import { mapProjectToTypeId } from '#services/research_output_mapper_service'
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
  context: KpiContext
): Promise<CalculationResult> {
  const warnings: string[] = []
  if (output.type !== 'PROJECT') {
    return { hours: 0, warnings: ['Output không phải PROJECT'] }
  }

  const { project } = output

  const typeId = await mapProjectToTypeId({
    id: project.id,
    level: project.level,
    acceptanceGrade: project.acceptanceGrade,
  })

  const rule = await ResearchOutputRule.query()
    .where('type_id', typeId)
    .firstOrFail()

  if ((rule.ruleKind || '').toUpperCase() !== 'MULTIPLY_C') {
    warnings.push(`Rule type_id=${typeId} không phải MULTIPLY_C`)
    return { hours: 0, warnings, details: { projectId: project.id } }
  }

  const baseHours = rule.hoursValue != null ? Number(rule.hoursValue) : 0
  if (baseHours <= 0) {
    warnings.push(`Rule type_id=${typeId} có hours_value không hợp lệ`)
    return { hours: 0, warnings }
  }

  let cFactor: number
  if (project.cFactor != null && project.cFactor > 0) {
    cFactor = Number(project.cFactor)
  } else if (project.acceptanceGrade) {
    const grade = project.acceptanceGrade.trim().toUpperCase()
    cFactor = ACCEPTANCE_GRADE_CFACTOR[grade]
    if (cFactor === undefined) {
      warnings.push(`Thiếu mapping acceptance_grade: ${project.acceptanceGrade}`)
      return { hours: 0, warnings, details: { projectId: project.id } }
    }
  } else {
    warnings.push('Thiếu acceptance_grade và c_factor cho đề tài')
    return { hours: 0, warnings, details: { projectId: project.id } }
  }

  const hours = Math.round(baseHours * cFactor * 100) / 100

  return {
    hours,
    warnings,
    details: {
      projectId: project.id,
      typeId,
      baseHours,
      cFactor,
    },
  }
}
