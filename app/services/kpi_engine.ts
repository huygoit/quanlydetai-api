/**
 * KPI Engine: tập hợp strategy và getStrategyForOutput.
 * Dùng đuôi .js để tương thích runtime sau khi build.
 */
import type { IKpiCalculatorStrategy, KpiOutput } from '#types/kpi'
import {
  publicationStrategySupports,
  publicationStrategyCalculate,
} from './kpi_engine/publication_strategy.js'
import {
  projectStrategySupports,
  projectStrategyCalculate,
} from './kpi_engine/project_strategy.js'
import {
  simpleFixedStrategySupports,
  simpleFixedStrategyCalculate,
} from './kpi_engine/simple_fixed_strategy.js'

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
