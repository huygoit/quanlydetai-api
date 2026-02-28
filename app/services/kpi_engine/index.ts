import type { IKpiCalculatorStrategy, KpiOutput } from '#types/kpi'
import {
  publicationStrategySupports,
  publicationStrategyCalculate,
} from './publication_strategy'
import {
  projectStrategySupports,
  projectStrategyCalculate,
} from './project_strategy'
import {
  simpleFixedStrategySupports,
  simpleFixedStrategyCalculate,
} from './simple_fixed_strategy'

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
