import ReactECharts from 'echarts-for-react'
import { forwardRef } from 'react'
import type { Candidate, GeneratorSettings } from '../models'

const axis = '#657d79'

function axisValue(value: number) {
  if (!Number.isFinite(value)) return ''
  const rounded = Number(value.toFixed(2))
  return String(rounded)
}

function pLabel(pValue: number) {
  const p = pValue < 0.0001 ? pValue.toExponential(2) : pValue.toFixed(4)
  const stars = pValue < 0.0001 ? '****' : pValue < 0.001 ? '***' : pValue < 0.01 ? '**' : pValue < 0.05 ? '*' : 'ns'
  return `p=${p} ${stars}`
}

export const ResultChart = forwardRef<ReactECharts, { candidate: Candidate; settings: GeneratorSettings; errorType: 'sd' | 'sem' | 'ci' }>(({ candidate, settings, errorType }, ref) => {
  const summaries = candidate.summaries
  const errorValues = summaries.map((summary) => errorType === 'sem' ? [summary.mean - summary.sem, summary.mean + summary.sem] : errorType === 'ci' ? [summary.ciLow, summary.ciHigh] : [summary.mean - summary.sd, summary.mean + summary.sd])
  const allValues = [...candidate.values.flat(), ...errorValues.flat()]
  const min = Math.min(...allValues)
  const max = Math.max(...allValues)
  const range = Math.max(1, max - min)
  const pairAnnotations = settings.pairwiseConstraints.filter((constraint) => constraint.enabled !== false).flatMap((constraint) => {
    const left = settings.groups.findIndex((group) => group.id === constraint.leftGroupId)
    const right = settings.groups.findIndex((group) => group.id === constraint.rightGroupId)
    if (left < 0 || right < 0) return []
    const pair = candidate.test.method === 'anova'
      ? candidate.test.pairwise?.find((item) => item.leftGroupId === constraint.leftGroupId && item.rightGroupId === constraint.rightGroupId)
      : left === 0 && right === 1
        ? { pValue: candidate.test.pValue, adjustedPValue: candidate.test.pValue }
        : undefined
    if (!pair) return []
    return [{ left, right, pValue: pair.adjustedPValue, label: pLabel(pair.adjustedPValue) }]
  })
  const bracketBase = max + range * 0.1
  const bracketStep = range * 0.12
  const highestBracket = pairAnnotations.length ? bracketBase + (pairAnnotations.length - 1) * bracketStep : max
  const yMin = Math.min(0, min - range * 0.15)
  const yMax = highestBracket + range * (pairAnnotations.length ? 0.18 : 0.12)
  const points = candidate.values.flatMap((values, groupIndex) => values.map((value, index) => [groupIndex + ((index - (values.length - 1) / 2) * 0.035), value]))

  const option = {
    animationDuration: 320,
    grid: { left: 58, right: 24, top: 62, bottom: 58 },
    tooltip: { trigger: 'item' },
    xAxis: { type: 'category', data: settings.groups.map((group) => group.name), axisLabel: { color: '#263936', rotate: settings.groups.length > 4 ? 25 : 0 }, axisLine: { lineStyle: { color: axis } } },
    yAxis: { type: 'value', min: yMin, max: yMax, name: 'Synthetic value', nameTextStyle: { color: '#263936' }, axisLabel: { color: '#263936', formatter: axisValue }, splitLine: { lineStyle: { color: '#dfe7e5' } } },
    series: [
      { type: 'bar', barWidth: '44%', data: summaries.map((summary, index) => ({ value: summary.mean, itemStyle: { color: settings.groups[index]?.color ?? '#9acddb', borderColor: '#354a46', borderWidth: 1.2 } })) },
      { type: 'scatter', symbolSize: 9, data: points, itemStyle: { color: '#1d2927' }, z: 5 },
      { type: 'custom', data: errorValues.map(([low, high], index) => [index, low, high]), renderItem: (_params: unknown, api: { value: (index: number) => number; coord: (value: number[]) => number[] }) => {
        const x = api.coord([api.value(0), api.value(1)])[0]
        const low = api.coord([api.value(0), api.value(1)])[1]
        const high = api.coord([api.value(0), api.value(2)])[1]
        return { type: 'group', children: [{ type: 'line', shape: { x1: x, y1: low, x2: x, y2: high }, style: { stroke: '#1d2927', lineWidth: 1.5 } }, { type: 'line', shape: { x1: x - 7, y1: low, x2: x + 7, y2: low }, style: { stroke: '#1d2927', lineWidth: 1.5 } }, { type: 'line', shape: { x1: x - 7, y1: high, x2: x + 7, y2: high }, style: { stroke: '#1d2927', lineWidth: 1.5 } }] }
      }, z: 4 },
      { type: 'custom', data: pairAnnotations.map((annotation, index) => [annotation.left, annotation.right, bracketBase + index * bracketStep, annotation.label]), renderItem: (_params: unknown, api: { value: (index: number) => number | string; coord: (value: number[]) => number[] }) => {
        const left = api.coord([Number(api.value(0)), Number(api.value(2))])
        const right = api.coord([Number(api.value(1)), Number(api.value(2))])
        return { type: 'group', children: [{ type: 'polyline', shape: { points: [[left[0], left[1] + 7], [left[0], left[1]], [right[0], right[1]], [right[0], right[1] + 7]] }, style: { stroke: '#1d2927', fill: null, lineWidth: 1.5 } }, { type: 'text', style: { text: String(api.value(3)), x: (left[0] + right[0]) / 2, y: left[1] - 8, textAlign: 'center', textVerticalAlign: 'bottom', font: '700 12px sans-serif', fill: '#1d2927' } }] }
      }, z: 6 },
    ],
  }
  return <ReactECharts ref={ref} option={option} style={{ height: 390 }} notMerge />
})
