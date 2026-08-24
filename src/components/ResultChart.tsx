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

function twoWayOption(candidate: Candidate, settings: GeneratorSettings, errorType: 'sd' | 'sem' | 'ci') {
  const twoWay = settings.twoWay!
  const factorACount = twoWay.factorA.levels.length
  const factorBCount = twoWay.factorB.levels.length
  const summaries = twoWay.cells.map((cell) => candidate.summaries.find((summary) => summary.groupId === cell.id)!).map((summary) => summary)
  const errorFor = (summary: Candidate['summaries'][number]) => errorType === 'sem' ? [summary.mean - summary.sem, summary.mean + summary.sem] : errorType === 'ci' ? [summary.ciLow, summary.ciHigh] : [summary.mean - summary.sd, summary.mean + summary.sd]
  const values = twoWay.cells.flatMap((cell, index) => [...(candidate.values[index] ?? []), ...errorFor(summaries[index])])
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(1, max - min)
  const pairAnnotations = settings.pairwiseConstraints.filter((constraint) => constraint.enabled !== false).flatMap((constraint) => {
    const leftCell = twoWay.cells.find((cell) => cell.id === constraint.leftGroupId)
    const rightCell = twoWay.cells.find((cell) => cell.id === constraint.rightGroupId)
    const pair = candidate.test.pairwise?.find((item) => item.leftGroupId === constraint.leftGroupId && item.rightGroupId === constraint.rightGroupId)
    if (!leftCell || !rightCell || !pair) return []
    return [{ leftB: leftCell.factorBIndex, leftA: leftCell.factorAIndex, rightB: rightCell.factorBIndex, rightA: rightCell.factorAIndex, label: pLabel(pair.adjustedPValue) }]
  })
  const bracketBase = max + range * 0.1
  const bracketStep = range * 0.12
  const yMax = (pairAnnotations.length ? bracketBase + (pairAnnotations.length - 1) * bracketStep : max) + range * (pairAnnotations.length ? 0.18 : 0.12)
  const colors = ['#7c7c7c', '#a9a9b0', '#8d969c', '#b9b2a8', '#959595', '#c1c1c1']
  const barSeries = twoWay.factorA.levels.map((level, factorAIndex) => ({ name: level, type: 'custom', data: twoWay.cells.filter((cell) => cell.factorAIndex === factorAIndex).map((cell) => { const index = twoWay.cells.findIndex((item) => item.id === cell.id); return [cell.factorBIndex, cell.factorAIndex, summaries[index].mean] }), renderItem: (_params: unknown, api: any) => { const b = Number(api.value(0)); const a = Number(api.value(1)); const meanValue = Number(api.value(2)); const center = api.coord([b, 0]); const next = api.coord([b + 1, 0]); const band = Math.abs(next[0] - center[0]); const width = band * 0.72 / factorACount; const x = center[0] + (a - (factorACount - 1) / 2) * width - width / 2; const y = api.coord([b, meanValue])[1]; const y0 = api.coord([b, 0])[1]; return { type: 'rect', shape: { x, y: Math.min(y, y0), width: width * 0.84, height: Math.abs(y0 - y) }, style: { fill: colors[a % colors.length], stroke: '#121212', lineWidth: 1.4 } } }, z: 2 }))
  const pointSeries = twoWay.factorA.levels.map((level, factorAIndex) => ({ name: `${level} points`, type: 'custom', data: twoWay.cells.filter((cell) => cell.factorAIndex === factorAIndex).flatMap((cell) => { const index = twoWay.cells.findIndex((item) => item.id === cell.id); const values = candidate.values[index] ?? []; return values.map((value, replicate) => [cell.factorBIndex, cell.factorAIndex, value, (replicate - (values.length - 1) / 2) * 0.035]) }), renderItem: (_params: unknown, api: any) => { const b = Number(api.value(0)); const a = Number(api.value(1)); const value = Number(api.value(2)); const jitter = Number(api.value(3)); const center = api.coord([b, value]); const next = api.coord([b + 1, value]); const width = Math.abs(next[0] - center[0]) * 0.72 / factorACount; return { type: 'circle', shape: { cx: center[0] + (a - (factorACount - 1) / 2) * width + jitter * 5, cy: center[1], r: 5 }, style: { fill: '#ffffff', stroke: '#111111', lineWidth: 2 } } }, silent: true, z: 5 }))
  const errorSeries = { name: 'error', type: 'custom', data: twoWay.cells.map((cell, index) => { const [low, high] = errorFor(summaries[index]); return [cell.factorBIndex, cell.factorAIndex, low, high] }), renderItem: (_params: unknown, api: any) => { const b = Number(api.value(0)); const a = Number(api.value(1)); const low = Number(api.value(2)); const high = Number(api.value(3)); const center = api.coord([b, high]); const next = api.coord([b + 1, high]); const width = Math.abs(next[0] - center[0]) * 0.72 / factorACount; const x = center[0] + (a - (factorACount - 1) / 2) * width; const lowY = api.coord([b, low])[1]; const highY = api.coord([b, high])[1]; return { type: 'group', children: [{ type: 'line', shape: { x1: x, y1: lowY, x2: x, y2: highY }, style: { stroke: '#111111', lineWidth: 1.6 } }, { type: 'line', shape: { x1: x - 7, y1: lowY, x2: x + 7, y2: lowY }, style: { stroke: '#111111', lineWidth: 1.6 } }, { type: 'line', shape: { x1: x - 7, y1: highY, x2: x + 7, y2: highY }, style: { stroke: '#111111', lineWidth: 1.6 } }] } }, silent: true, z: 4 }
  const annotationSeries = { name: 'annotations', type: 'custom', data: pairAnnotations.map((annotation, index) => [annotation.leftB, annotation.leftA, annotation.rightB, annotation.rightA, bracketBase + index * bracketStep, annotation.label]), renderItem: (_params: unknown, api: any) => { const leftBase = api.coord([Number(api.value(0)), Number(api.value(4))]); const rightBase = api.coord([Number(api.value(2)), Number(api.value(4))]); const band = Math.abs(api.coord([1, Number(api.value(4))])[0] - api.coord([0, Number(api.value(4))])[0]); const width = band * 0.72 / factorACount; const left = [leftBase[0] + (Number(api.value(1)) - (factorACount - 1) / 2) * width, leftBase[1]]; const right = [rightBase[0] + (Number(api.value(3)) - (factorACount - 1) / 2) * width, rightBase[1]]; return { type: 'group', children: [{ type: 'polyline', shape: { points: [[left[0], left[1] + 7], [left[0], left[1]], [right[0], right[1]], [right[0], right[1] + 7]] }, style: { stroke: '#111111', fill: null, lineWidth: 1.5 } }, { type: 'text', style: { text: String(api.value(5)), x: (left[0] + right[0]) / 2, y: left[1] - 8, textAlign: 'center', textVerticalAlign: 'bottom', font: '700 12px sans-serif', fill: '#111111' } }] } }, silent: true, z: 6 }
  return { animationDuration: 320, grid: { left: 58, right: 24, top: 54, bottom: 82 }, legend: { top: 8, right: 10, data: twoWay.factorA.levels, icon: 'circle', textStyle: { color: '#1d2927' } }, tooltip: { trigger: 'item' }, xAxis: { type: 'category', data: twoWay.factorB.levels, axisLabel: { color: '#1d2927', rotate: factorBCount > 4 ? 28 : 0 }, axisLine: { lineStyle: { color: '#111111', width: 2 } }, axisTick: { lineStyle: { color: '#111111' } }, splitLine: { show: false } }, yAxis: { type: 'value', min: Math.min(0, min - range * 0.15), max: yMax, name: 'Synthetic value', nameTextStyle: { color: '#1d2927' }, axisLabel: { color: '#1d2927', formatter: axisValue }, axisLine: { show: true, onZero: false, lineStyle: { color: '#111111', width: 2 } }, axisTick: { show: true, lineStyle: { color: '#111111' } }, splitLine: { lineStyle: { color: '#e0e0e0' } } }, series: [...barSeries, ...pointSeries, errorSeries, annotationSeries] }
}

export const ResultChart = forwardRef<ReactECharts, { candidate: Candidate; settings: GeneratorSettings; errorType: 'sd' | 'sem' | 'ci' }>(({ candidate, settings, errorType }, ref) => {
  if (settings.analysisDesign === 'twoWay' && settings.twoWay) return <ReactECharts ref={ref} option={twoWayOption(candidate, settings, errorType)} style={{ height: 420 }} notMerge />
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
