import ReactECharts from 'echarts-for-react'
import { forwardRef } from 'react'
import type { Candidate, GeneratorSettings } from '../models'

const axis = '#657d79'

export const ResultChart = forwardRef<ReactECharts, { candidate: Candidate; settings: GeneratorSettings; errorType: 'sd' | 'sem' | 'ci' }>(({ candidate, settings, errorType }, ref) => {
  const summaries = candidate.summaries
  const errorValues = summaries.map((summary) => errorType === 'sem' ? [summary.mean - summary.sem, summary.mean + summary.sem] : errorType === 'ci' ? [summary.ciLow, summary.ciHigh] : [summary.mean - summary.sd, summary.mean + summary.sd])
  const allValues = [...candidate.values.flat(), ...errorValues.flat()]
  const min = Math.min(...allValues)
  const max = Math.max(...allValues)
  const range = Math.max(1, max - min)
  const bracketY = max + range * 0.16
  const yMin = Math.min(0, min - range * 0.15)
  const yMax = bracketY + range * 0.2
  const points = candidate.values.flatMap((values, groupIndex) => values.map((value, index) => [groupIndex + ((index - (values.length - 1) / 2) * 0.035), value]))
  const label = candidate.test.method === 'anova' ? `ANOVA p=${candidate.test.pValue.toPrecision(3)}` : candidate.test.pValue <= 0.0001 ? '****' : candidate.test.pValue <= 0.001 ? '***' : candidate.test.pValue <= 0.01 ? '**' : candidate.test.pValue <= 0.05 ? '*' : 'ns'
  const lastIndex = Math.max(1, summaries.length - 1)

  const option = {
    animationDuration: 320,
    grid: { left: 58, right: 24, top: 62, bottom: 58 },
    tooltip: { trigger: 'item' },
    xAxis: { type: 'category', data: settings.groups.map((group) => group.name), axisLabel: { color: '#263936', rotate: settings.groups.length > 4 ? 25 : 0 }, axisLine: { lineStyle: { color: axis } } },
    yAxis: { type: 'value', min: yMin, max: yMax, name: 'Synthetic value', nameTextStyle: { color: '#263936' }, axisLabel: { color: '#263936' }, splitLine: { lineStyle: { color: '#dfe7e5' } } },
    series: [
      { type: 'bar', barWidth: '44%', data: summaries.map((summary, index) => ({ value: summary.mean, itemStyle: { color: settings.groups[index]?.color ?? '#9acddb', borderColor: '#354a46', borderWidth: 1.2 } })) },
      { type: 'scatter', symbolSize: 9, data: points, itemStyle: { color: '#1d2927' }, z: 5 },
      { type: 'custom', data: errorValues.map(([low, high], index) => [index, low, high]), renderItem: (_params: unknown, api: { value: (index: number) => number; coord: (value: number[]) => number[] }) => {
        const x = api.coord([api.value(0), api.value(1)])[0]
        const low = api.coord([api.value(0), api.value(1)])[1]
        const high = api.coord([api.value(0), api.value(2)])[1]
        return { type: 'group', children: [{ type: 'line', shape: { x1: x, y1: low, x2: x, y2: high }, style: { stroke: '#1d2927', lineWidth: 1.5 } }, { type: 'line', shape: { x1: x - 7, y1: low, x2: x + 7, y2: low }, style: { stroke: '#1d2927', lineWidth: 1.5 } }, { type: 'line', shape: { x1: x - 7, y1: high, x2: x + 7, y2: high }, style: { stroke: '#1d2927', lineWidth: 1.5 } }] }
      }, z: 4 },
      { type: 'custom', data: [[0, lastIndex, bracketY, label]], renderItem: (_params: unknown, api: { value: (index: number) => number | string; coord: (value: number[]) => number[] }) => {
        const left = api.coord([Number(api.value(0)), Number(api.value(2))])
        const right = api.coord([Number(api.value(1)), Number(api.value(2))])
        return { type: 'group', children: [{ type: 'polyline', shape: { points: [[left[0], left[1] + 7], [left[0], left[1]], [right[0], right[1]], [right[0], right[1] + 7]] }, style: { stroke: '#1d2927', fill: null, lineWidth: 1.5 } }, { type: 'text', style: { text: String(api.value(3)), x: (left[0] + right[0]) / 2, y: left[1] - 8, textAlign: 'center', textVerticalAlign: 'bottom', font: '700 12px sans-serif', fill: '#1d2927' } }] }
      }, z: 6 },
    ],
  }
  return <ReactECharts ref={ref} option={option} style={{ height: 390 }} notMerge />
})
