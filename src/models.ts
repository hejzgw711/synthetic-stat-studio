export type TestMethod = 'welch' | 'student' | 'paired' | 'anova'
export type AnalysisDesign = 'single' | 'twoWay'
export type Tail = 'two-sided' | 'greater' | 'less'
export type DataType = 'decimal' | 'integer'
export type Distribution = 'normal' | 'irregular' | 'lognormal'
export type Trend = 'ascending' | 'descending' | 'similar' | 'custom'
export type CheckStatus = 'PASS' | 'WARN' | 'FAIL'

export interface GroupConfig {
  id: string
  name: string
  n: number
  meanOffset: number
  targetMean: number
  minValue: number
  maxValue: number | null
  targetSd: number
  color: string
}

export interface PairwiseConstraint {
  id: string
  leftGroupId: string
  rightGroupId: string
  /** Whether this pair is used as a hard generation constraint. Omitted means enabled for old project files. */
  enabled?: boolean
  pMin: number
  pMax: number
}

export interface TwoWayFactor {
  name: string
  levels: string[]
}

export interface TwoWayCellConfig {
  id: string
  factorAIndex: number
  factorBIndex: number
  n: number
  targetMean: number
  minValue: number
  maxValue: number | null
  targetSd: number
  color: string
}

export interface TwoWaySettings {
  factorA: TwoWayFactor
  factorB: TwoWayFactor
  cells: TwoWayCellConfig[]
}

export interface GeneratorSettings {
  projectName: string
  analysisDesign?: AnalysisDesign
  method: TestMethod
  tail: Tail
  groups: GroupConfig[]
  pairwiseConstraints: PairwiseConstraint[]
  trend: Trend
  baselineMean: number
  effectMin: number
  effectMax: number
  targetPMin: number
  targetPMax: number
  dataType: DataType
  decimals: number | null
  distribution: Distribution
  irregularity: number
  seedMode: 'random' | 'locked'
  seed: string
  maxAttempts: number
  batchN?: number
  batchMinValue?: number
  batchMaxValue?: number | null
  batchTargetSd?: number
  twoWay?: TwoWaySettings
}

export interface Summary {
  groupId: string
  name: string
  n: number
  values: number[]
  mean: number
  sd: number
  sem: number
  ciLow: number
  ciHigh: number
}

export interface PairwiseResult {
  leftGroupId: string
  leftGroupName: string
  rightGroupId: string
  rightGroupName: string
  statistic: number
  degreesOfFreedom: number
  pValue: number
  adjustedPValue: number
  label: string
}

export interface AnovaEffectResult {
  name: string
  degreesOfFreedom: number
  sumOfSquares: number
  meanSquare: number
  statistic: number
  pValue: number
  effectSize: number
}

export interface TwoWayAnovaResult {
  factorA: AnovaEffectResult
  factorB: AnovaEffectResult
  interaction: AnovaEffectResult
  residualDegreesOfFreedom: number
  totalDegreesOfFreedom: number
  replicatesPerCell: number
}

export interface TestResult {
  method: TestMethod
  tail: Tail
  statistic: number
  degreesOfFreedom: number
  pValue: number
  effectSize: number
  dfBetween?: number
  dfWithin?: number
  pairwise?: PairwiseResult[]
  design?: 'one-way' | 'two-way'
  twoWay?: TwoWayAnovaResult
}

export interface ConstraintCheck {
  label: string
  status: CheckStatus
  detail: string
}

export interface Candidate {
  id: string
  seed: string
  values: number[][]
  summaries: Summary[]
  test: TestResult
  checks: ConstraintCheck[]
  status: CheckStatus
  score: number
  attempts: number
  generatedAt: string
}

export interface GenerationReport {
  settings: GeneratorSettings
  candidates: Candidate[]
  selectedIndex: number
  attempts: number
  startedAt: string
  completedAt: string
  message: string
}
