/**
 * KPI Engine: tập hợp strategy và getStrategyForOutput.
 * Import tương đối với .ts để runtime (ts-node) tìm đúng file.
 */
import type { IKpiCalculatorStrategy, KpiOutput } from '#types/kpi'
import {
  publicationStrategySupports,
  publicationStrategyCalculate,
} from './kpi_engine/publication_strategy.ts'
import {
  projectStrategySupports,
  projectStrategyCalculate,
} from './kpi_engine/project_strategy.ts'
import {
  simpleFixedStrategySupports,
  simpleFixedStrategyCalculate,
} from './kpi_engine/simple_fixed_strategy.ts'

const publicationStrategy: IKpiCalculatorStrategy = {
  supports: publicationStrategySupports,
  calculate: publicationStrategyCalculate,
}

const projectStrategy: IKpiCalculatorStrategy = {
  supports: projectStrategySupports,
  calculate: projectStrategyCalculate,
}

const simpleFixedStrategy: IKpiCalculatorStrategy = {
  supports: simpleFixedStrategySupports,
  calculate: simpleFixedStrategyCalculate,
}

export const strategies: IKpiCalculatorStrategy[] = [
  publicationStrategy,
  projectStrategy,
  simpleFixedStrategy,
]

export function getStrategyForOutput(output: KpiOutput): IKpiCalculatorStrategy | null {
  return strategies.find((s) => s.supports(output)) ?? null
}
