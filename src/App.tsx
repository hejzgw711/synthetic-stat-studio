import {
  AlertTriangle,
  BarChart3,
  Check,
  Copy,
  Download,
  FileArchive,
  FileDown,
  FolderOpen,
  Lock,
  Plus,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Unlock,
  X,
} from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import ReactECharts from 'echarts-for-react'
import { ResultChart } from './components/ResultChart'
import { cloneSettings, defaultSettings, ensurePairwiseConstraints, generateCandidates } from './core/generator'
import { copyPrismColumns, exportCsv, exportXlsx, exportZip, saveProject } from './exporters'
import type { Candidate, GenerationReport, GeneratorSettings, GroupConfig } from './models'

const colors = ['#9acddb', '#e7ad97', '#b7d8aa', '#c4b0dd', '#e3c58d', '#9fb5d8']

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>
}

function Numeric({ value, min, max, step = 1, disabled, onChange }: { value: number; min?: number; max?: number; step?: number; disabled?: boolean; onChange: (value: number) => void }) {
  return <input type="number" value={value} min={min} max={max} step={step} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} />
}

function OptionalNumeric({ value, min, max, step = 1, disabled, placeholder, onChange }: { value: number | null | undefined; min?: number; max?: number; step?: number; disabled?: boolean; placeholder?: string; onChange: (value: number | null) => void }) {
  return <input type="number" value={value ?? ''} min={min} max={max} step={step} disabled={disabled} placeholder={placeholder} onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))} />
}

function Section({ number, title, subtitle, children }: { number: number; title: string; subtitle: string; children: ReactNode }) {
  return <section className="panel config-section"><header className="section-header"><span className="step">{number}</span><div><h2>{title}</h2><p>{subtitle}</p></div></header>{children}</section>
}

function formatP(value: number) {
  if (value < 0.0001) return value.toExponential(3)
  return value.toFixed(5)
}

function methodLabel(method: GeneratorSettings['method']) {
  if (method === 'student') return "Student's unpaired t-test"
  if (method === 'paired') return 'Paired t-test'
  if (method === 'anova') return 'One-way ANOVA'
  return "Welch's unpaired t-test"
}

function constraintPreset(constraint: { pMin: number; pMax: number }) {
  return pPresets.find((preset) => preset.min === constraint.pMin && preset.max === constraint.pMax)?.label ?? 'custom'
}

function presetRange(preset: (typeof pPresets)[number]) {
  if (preset.label === 'ns') return 'p≥0.05'
  if (preset.min === 0) return `p<${preset.max}`
  return `${preset.min}≤p<${preset.max}`
}

function constraintTarget(settings: GeneratorSettings) {
  const constraint = settings.pairwiseConstraints[0]
  return constraint && constraint.enabled !== false ? `${constraint.pMin}–${constraint.pMax}` : '未约束'
}

const pPresets = [
  { label: 'ns', min: 0.05, max: 1 },
  { label: '*', min: 0.01, max: 0.05 },
  { label: '**', min: 0.001, max: 0.01 },
  { label: '***', min: 0.0001, max: 0.001 },
  { label: '****', min: 0, max: 0.0001 },
]

function PairwiseConstraintPanel({ settings, onEdit }: { settings: GeneratorSettings; onEdit: (mutator: (draft: GeneratorSettings) => void) => void }) {
  const enabledConstraints = settings.pairwiseConstraints.filter((constraint) => constraint.enabled !== false)
  const groupName = (id: string) => settings.groups.find((group) => group.id === id)?.name ?? id
  return <>
    <details className="pair-selector">
      <summary>选择需要约束的组对 <strong>{enabledConstraints.length}/{settings.pairwiseConstraints.length}</strong></summary>
      <div className="pair-selector-menu">{settings.pairwiseConstraints.map((constraint) => <label key={constraint.id}><input type="checkbox" checked={constraint.enabled !== false} onChange={(event) => onEdit((draft) => { draft.pairwiseConstraints.find((item) => item.id === constraint.id)!.enabled = event.target.checked })} /><span>{groupName(constraint.leftGroupId)} vs {groupName(constraint.rightGroupId)}</span></label>)}</div>
    </details>
    <div className="pair-constraint-editor">{enabledConstraints.map((constraint) => <div className="pair-constraint-row" key={constraint.id}><strong>{groupName(constraint.leftGroupId)} vs {groupName(constraint.rightGroupId)}</strong><Field label="预设"><select value={constraintPreset(constraint)} onChange={(event) => onEdit((draft) => { const current = draft.pairwiseConstraints.find((item) => item.id === constraint.id); const preset = pPresets.find((item) => item.label === event.target.value); if (current && preset) { current.pMin = preset.min; current.pMax = preset.max } })}><option value="custom">自定义</option>{pPresets.map((preset) => <option key={preset.label} value={preset.label}>{preset.label}（{presetRange(preset)}）</option>)}</select></Field><Field label="p 最小"><Numeric value={constraint.pMin} min={0} max={1} step={0.001} onChange={(value) => onEdit((draft) => { draft.pairwiseConstraints.find((item) => item.id === constraint.id)!.pMin = value })} /></Field><span>&lt; p &lt;</span><Field label="p 最大"><Numeric value={constraint.pMax} min={0} max={1} step={0.001} onChange={(value) => onEdit((draft) => { draft.pairwiseConstraints.find((item) => item.id === constraint.id)!.pMax = value })} /></Field></div>)}</div>
    {enabledConstraints.length === 0 && <div className="no-pair-constraint">当前未选择组对：仅按统计设计、均值、范围、SD 和趋势生成。</div>}
  </>
}

function nextGroup(settings: GeneratorSettings): GroupConfig {
  const index = settings.groups.length
  const previous = settings.groups[index - 1]
  return { id: `group-${Date.now()}-${index}`, name: `Group ${index + 1}`, n: 6, meanOffset: index * 1.5, targetMean: (previous?.targetMean ?? 10) + 1.5, minValue: previous?.minValue ?? 0, maxValue: previous?.maxValue ?? null, targetSd: previous?.targetSd ?? 1.2, color: colors[index % colors.length] }
}

export default function App() {
  const [settings, setSettings] = useState<GeneratorSettings>(() => cloneSettings(defaultSettings))
  const [report, setReport] = useState<GenerationReport>(() => generateCandidates(cloneSettings(defaultSettings)))
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [dirty, setDirty] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [errorType, setErrorType] = useState<'sd' | 'sem' | 'ci'>('sd')
  const [notice, setNotice] = useState('')
  const chartRef = useRef<ReactECharts>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const selected = report.candidates[selectedIndex] ?? report.candidates[0]
  const isMultiGroup = settings.groups.length >= 3

  const edit = (mutator: (draft: GeneratorSettings) => void) => {
    setSettings((current) => {
      const draft = cloneSettings(current)
      mutator(draft)
      return draft
    })
    setDirty(true)
  }

  const addGroup = () => edit((draft) => {
    draft.groups.push(nextGroup(draft))
    draft.pairwiseConstraints = ensurePairwiseConstraints(draft)
    if (draft.groups.length >= 3) draft.method = 'anova'
  })

  const removeGroup = (id: string) => edit((draft) => {
    if (draft.groups.length <= 2) return
    draft.groups = draft.groups.filter((group) => group.id !== id)
    draft.pairwiseConstraints = ensurePairwiseConstraints(draft)
    if (draft.groups.length === 2 && draft.method === 'anova') draft.method = 'welch'
  })

  const updateGroup = (id: string, mutator: (group: GroupConfig) => void) => edit((draft) => {
    const group = draft.groups.find((item) => item.id === id)
    if (group) mutator(group)
  })

  const applyBatchSettings = () => edit((draft) => {
    const minimum = draft.batchMinValue ?? 0
    const maximum = draft.batchMaxValue ?? null
    const targetSd = draft.batchTargetSd ?? 1.2
    draft.groups.forEach((group) => { group.minValue = minimum; group.maxValue = maximum; group.targetSd = targetSd })
  })

  const resetForm = () => {
    if (!window.confirm('清空当前设置并恢复初始模板？')) return
    const freshSettings = cloneSettings(defaultSettings)
    setSettings(freshSettings)
    setReport(generateCandidates(cloneSettings(freshSettings)))
    setSelectedIndex(0)
    setDirty(false)
    setErrorType('sd')
    setNotice('已清空当前设置，可以重新填写')
  }

  const generate = () => {
    setGenerating(true)
    setNotice('')
    const worker = new Worker(new URL('./workers/generator.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<{ ok: boolean; report?: GenerationReport; error?: string }>) => {
      if (event.data.ok && event.data.report) {
        setReport(event.data.report)
        setSelectedIndex(0)
        setDirty(false)
        setNotice(event.data.report.message)
      } else setNotice(event.data.error ?? '生成失败')
      setGenerating(false)
      worker.terminate()
    }
    worker.onerror = () => { setNotice('随机搜索线程运行失败'); setGenerating(false); worker.terminate() }
    worker.postMessage(cloneSettings(settings))
  }

  const loadProject = async (file: File) => {
    try {
      const payload = JSON.parse(await file.text()) as { schemaVersion?: number; settings?: GeneratorSettings; report?: GenerationReport | null }
      if (payload.schemaVersion !== 1 || !payload.settings) throw new Error('不是受支持的 Synthetic Data Studio 项目文件')
      setSettings(payload.settings)
      setReport(payload.report?.candidates?.length ? payload.report : generateCandidates(payload.settings))
      setSelectedIndex(0)
      setDirty(false)
      setNotice('项目已打开')
    } catch (error) { setNotice(error instanceof Error ? error.message : '项目读取失败') }
  }

  const copyData = async () => {
    if (!selected) return
    await copyPrismColumns(selected, report.settings)
    setNotice('已复制为列式数据')
  }

  const exportPng = () => {
    const url = chartRef.current?.getEchartsInstance().getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#ffffff' })
    if (!url) return
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${settings.projectName}_plot.png`
    anchor.click()
  }

  return <main className="app">
    <header className="topbar panel"><div className="brand"><span className="eyebrow">SYNTHETIC DATA STUDIO</span><h1>统计反推模拟数据生成器</h1><p>目标统计约束下的本地随机数据工作台</p></div><div className="top-actions">
      <input ref={fileInput} hidden type="file" accept=".json,.synthetic.json" onChange={(event) => event.target.files?.[0] && loadProject(event.target.files[0])} />
      <button className="button reset" onClick={resetForm}><RotateCcw size={17} />清空重填</button><button className="button secondary" onClick={() => fileInput.current?.click()}><FolderOpen size={17} />打开</button><button className="button secondary" onClick={() => saveProject(settings, report)}><Save size={17} />保存</button><button className="button primary" onClick={generate} disabled={generating}>{generating ? <RefreshCw className="spin" size={17} /> : <Sparkles size={17} />}{generating ? '搜索中' : '生成方案'}</button><button className="button warm" onClick={() => selected && exportXlsx(report, selected)}><FileDown size={17} />导出 XLSX</button><button className="button secondary" onClick={() => exportZip(report)}><FileArchive size={17} />候选 ZIP</button>
    </div></header>
    <nav className="tabs"><button className="active"><BarChart3 size={16} />数据反推生成</button><span className="independent-badge">独立网页 · 本地计算</span>{dirty && <span className="dirty">参数已修改，请重新生成</span>}</nav>
    <div className="warning-banner"><AlertTriangle size={16} /><strong>SIMULATED / 合成模拟数据</strong><span>仅用于教学、绘图、统计方法验证和软件测试，不代表真实实验观测。</span></div>

    <div className="workspace"><div className="config-column">
      <Section number={1} title="数据设置" subtitle="选择数值类型、保留位数和分布形态；离散大小在每组的目标 SD 中设置"><div className="grid three"><Field label="数据类型"><select value={settings.dataType} onChange={(event) => edit((draft) => { draft.dataType = event.target.value as GeneratorSettings['dataType']; if (draft.dataType === 'integer') draft.decimals = 0 })}><option value="decimal">小数</option><option value="integer">整数</option></select></Field><Field label="小数位数"><div className="decimal-setting"><Numeric value={settings.decimals ?? 2} min={0} max={12} disabled={settings.dataType === 'integer' || settings.decimals === null} onChange={(value) => edit((draft) => { draft.decimals = value })} /><button type="button" className={settings.decimals === null ? 'active' : ''} disabled={settings.dataType === 'integer'} onClick={() => edit((draft) => { draft.decimals = draft.decimals === null ? 2 : null })}>{settings.decimals === null ? '不限制 ✓' : '不做要求'}</button></div></Field><Field label="分布形态"><select value={settings.distribution} onChange={(event) => edit((draft) => { draft.distribution = event.target.value as GeneratorSettings['distribution'] })}><option value="normal">正态分布</option><option value="lognormal">对数正态（log 原始值后近似正态）</option><option value="irregular">轻度不规则（轻微偏态）</option></select></Field><Field label="不规则程度"><Numeric value={settings.irregularity} min={0} max={1} step={0.05} disabled={settings.distribution !== 'irregular'} onChange={(value) => edit((draft) => { draft.irregularity = value })} /></Field><Field label="最大尝试次数"><Numeric value={settings.maxAttempts} min={1000} max={500000} step={1000} onChange={(value) => edit((draft) => { draft.maxAttempts = value })} /></Field></div></Section>

      <Section number={2} title="统计设计" subtitle="两组使用 t-test；三组及以上自动切换为 one-way ANOVA">
        <div className="grid three"><Field label="统计方法">{isMultiGroup ? <div className="auto-method"><strong>One-way ANOVA</strong><small>已根据组数自动选择</small></div> : <select value={settings.method} onChange={(event) => edit((draft) => { draft.method = event.target.value as GeneratorSettings['method'] })}><option value="welch">Welch t-test</option><option value="student">Student t-test</option><option value="paired">Paired t-test</option></select>}</Field><Field label="检验侧数"><select disabled={isMultiGroup} value={settings.tail} onChange={(event) => edit((draft) => { draft.tail = event.target.value as GeneratorSettings['tail'] })}><option value="two-sided">双侧</option><option value="greater">单侧：第二组更高</option><option value="less">单侧：第二组更低</option></select></Field><Field label="项目名称"><input value={settings.projectName} onChange={(event) => edit((draft) => { draft.projectName = event.target.value })} /></Field></div>
        <div className="batch-range"><div><strong>批量范围与离散设置</strong><small>应用后覆盖所有组；单组仍可继续单独修改</small></div><Field label="批量最小值"><Numeric value={settings.batchMinValue ?? 0} step={0.1} onChange={(value) => edit((draft) => { draft.batchMinValue = value })} /></Field><Field label="批量最大值"><OptionalNumeric value={settings.batchMaxValue} step={0.1} placeholder="不限制" onChange={(value) => edit((draft) => { draft.batchMaxValue = value })} /></Field><Field label="批量离散 SD"><Numeric value={settings.batchTargetSd ?? 1.2} min={0.01} step={0.1} onChange={(value) => edit((draft) => { draft.batchTargetSd = value })} /></Field><button className="button secondary batch-apply" onClick={applyBatchSettings}>应用到所有组</button></div><div className="group-list">{settings.groups.map((group, index) => <article className="group-card" key={group.id}><span className="group-mark" style={{ background: group.color }}>{String.fromCharCode(65 + index)}</span><Field label="组名称"><input value={group.name} onChange={(event) => updateGroup(group.id, (item) => { item.name = event.target.value })} /></Field><Field label="n"><Numeric value={group.n} min={2} max={50} onChange={(value) => updateGroup(group.id, (item) => { item.n = value })} /></Field><Field label="目标均值"><Numeric value={group.targetMean} step={0.1} onChange={(value) => updateGroup(group.id, (item) => { item.targetMean = value })} /></Field><Field label="离散 SD"><Numeric value={group.targetSd} min={0.01} step={0.1} onChange={(value) => updateGroup(group.id, (item) => { item.targetSd = value })} /></Field><Field label="最小值"><Numeric value={group.minValue} step={0.1} onChange={(value) => updateGroup(group.id, (item) => { item.minValue = value })} /></Field><Field label="最大值"><OptionalNumeric value={group.maxValue} step={0.1} placeholder="不限制" onChange={(value) => updateGroup(group.id, (item) => { item.maxValue = value })} /></Field><button className="remove-group" disabled={settings.groups.length <= 2} title="删除组" onClick={() => removeGroup(group.id)}><X size={14} /></button></article>)}<button className="add-group" onClick={addGroup}><Plus size={17} />添加一组</button></div>
      </Section>

      <Section number={3} title="趋势与效应" subtitle="默认按每组手动填写的目标均值判断趋势；也可切换为递增、递减或各组接近"><div className="trend-control"><button className={settings.trend === 'custom' ? 'active' : ''} onClick={() => edit((draft) => { draft.trend = 'custom' })}>按手填均值</button><button className={settings.trend === 'ascending' ? 'active' : ''} onClick={() => edit((draft) => { draft.trend = 'ascending' })}>递增趋势</button><button className={settings.trend === 'descending' ? 'active' : ''} onClick={() => edit((draft) => { draft.trend = 'descending' })}>递减趋势</button><button className={settings.trend === 'similar' ? 'active' : ''} onClick={() => edit((draft) => { draft.trend = 'similar' })}>各组接近</button></div></Section>

      <Section number={4} title="p 值约束" subtitle="下拉勾选需要约束的组对；未勾选组对仍计算 p 值，但不参与候选筛选"><PairwiseConstraintPanel settings={settings} onEdit={edit} /><p className="constraint-note">勾选的组对按所设 p 值区间筛选；未勾选的组对只按统计设计完成计算，不做 p 值要求。三组及以上的区间应用于 BH-FDR 校正后的成对比较。</p></Section>

      <Section number={5} title="随机设置" subtitle="默认每次使用新的安全随机 seed；锁定后才能复现同一候选"><div className="seed-row"><button className={`lock-toggle ${settings.seedMode === 'locked' ? 'locked' : ''}`} onClick={() => edit((draft) => { draft.seedMode = draft.seedMode === 'locked' ? 'random' : 'locked' })}>{settings.seedMode === 'locked' ? <Lock size={16} /> : <Unlock size={16} />}{settings.seedMode === 'locked' ? '已锁定 seed' : '每次全新随机'}</button><Field label="复现 seed" hint={settings.seedMode === 'random' ? '生成后在结果中记录自动 seed' : '相同参数与 seed 得到相同候选'}><input disabled={settings.seedMode === 'random'} value={settings.seed} onChange={(event) => edit((draft) => { draft.seed = event.target.value })} /></Field><button className="button primary generate-large" onClick={generate} disabled={generating}>{generating ? <RefreshCw className="spin" size={18} /> : <Play size={18} />}{generating ? '正在随机搜索' : '生成 3 套候选'}</button></div></Section>
    </div>

    <aside className="result-column panel"><header className="result-header"><div><span className="step">6</span><div><h2>结果预览</h2><p>{report.message}</p></div></div><span className={`status ${selected?.status.toLowerCase()}`}>{selected?.status}</span></header><div className="candidate-tabs">{report.candidates.map((candidate, index) => <button className={selectedIndex === index ? 'active' : ''} onClick={() => setSelectedIndex(index)} key={candidate.id}><span>方案 {String.fromCharCode(65 + index)}</span><strong>p={formatP(candidate.test.pValue)}</strong><small>{candidate.status} · 第 {candidate.attempts} 次抽样</small></button>)}</div>
      {selected && <>
        <div className="result-toolbar">
          <div className="segmented"><button className={errorType === 'sd' ? 'active' : ''} onClick={() => setErrorType('sd')}>SD</button><button className={errorType === 'sem' ? 'active' : ''} onClick={() => setErrorType('sem')}>SEM</button><button className={errorType === 'ci' ? 'active' : ''} onClick={() => setErrorType('ci')}>95% CI</button></div>
          <button className="icon-text" onClick={exportPng}><Download size={14} />PNG</button>
        </div>
        <div className="chart"><ResultChart ref={chartRef} candidate={selected} settings={report.settings} errorType={errorType} /></div>
        <div className="target-result">
          <div><span>{selected.test.method === 'anova' ? 'ANOVA p 值' : '目标范围'}</span><strong>{selected.test.method === 'anova' ? formatP(selected.test.pValue) : constraintTarget(report.settings)}</strong></div>
          <div><span>实际 p 值</span><strong>{formatP(selected.test.pValue)}</strong></div>
          <div><span>{selected.test.method === 'anova' ? 'η² 效应量' : '效应量'}</span><strong>{selected.test.effectSize.toFixed(3)}</strong></div>
          <div><span>组数</span><strong>{selected.summaries.length}</strong></div>
        </div>
        <section className="stat-card">
          <header><div><h3>统计摘要</h3><p>{methodLabel(selected.test.method)} · {selected.test.method === 'anova' ? `df=${selected.test.dfBetween},${selected.test.dfWithin}` : selected.test.tail}</p></div><span className="seed-display">seed {selected.seed.slice(0, 18)}…</span></header>
          <div className="summary-grid">{selected.summaries.map((summary, index) => <article key={summary.groupId}><span className="group-mark" style={{ background: report.settings.groups[index]?.color }}>{String.fromCharCode(65 + index)}</span><strong>{summary.name}</strong><dl><div><dt>n</dt><dd>{summary.n}</dd></div><div><dt>Mean</dt><dd>{summary.mean.toFixed(4)}</dd></div><div><dt>SD</dt><dd>{summary.sd.toFixed(4)}</dd></div><div><dt>SEM</dt><dd>{summary.sem.toFixed(4)}</dd></div></dl></article>)}</div>
          <div className="test-strip"><div><span>{selected.test.method === 'anova' ? 'F' : 't'}</span><strong>{selected.test.statistic.toFixed(4)}</strong></div><div><span>df</span><strong>{selected.test.method === 'anova' ? `${selected.test.dfBetween},${selected.test.dfWithin}` : selected.test.degreesOfFreedom.toFixed(3)}</strong></div><div><span>p</span><strong>{formatP(selected.test.pValue)}</strong></div><div><span>{selected.test.method === 'anova' ? 'η²' : "Cohen's d/dz"}</span><strong>{selected.test.effectSize.toFixed(3)}</strong></div></div>
        </section>
        {selected.test.method === 'anova' && <section className="pairwise-card"><header><div><h3>组间比较</h3><p>Welch pairwise + BH-FDR</p></div></header><div className="pairwise-list">{selected.test.pairwise?.map((pair) => <div className="pairwise-row" key={`${pair.leftGroupId}-${pair.rightGroupId}`}><span>{pair.leftGroupName} vs {pair.rightGroupName}</span><strong>{pair.label}</strong><small>p={formatP(pair.pValue)} · FDR={formatP(pair.adjustedPValue)}</small></div>)}</div></section>}
        <section className="raw-card"><header><div><h3>原始数据</h3><p>最终舍入值；复制到 Prism、R 或 Python 可独立回算</p></div><div><button className="icon-text" onClick={copyData}><Copy size={14} />复制列数据</button><button className="icon-text" onClick={() => exportCsv(selected, report.settings)}><Download size={14} />CSV</button></div></header><div className="raw-table"><table><thead><tr><th>#</th>{selected.summaries.map((summary) => <th key={summary.groupId}>{summary.name}</th>)}</tr></thead><tbody>{Array.from({ length: Math.max(...selected.values.map((values) => values.length)) }, (_, index) => <tr key={index}><td>{index + 1}</td>{selected.values.map((values, groupIndex) => <td key={selected.summaries[groupIndex]?.groupId}>{values[index] ?? ''}</td>)}</tr>)}</tbody></table></div></section>
        <section className="checks-card"><header><ShieldCheck size={17} /><h3>约束验证</h3><span>{report.attempts.toLocaleString()} 次完整随机抽样</span></header>{selected.checks.map((check) => <div className={`check-row ${check.status.toLowerCase()}`} key={check.label}>{check.status === 'PASS' ? <Check size={15} /> : check.status === 'WARN' ? <AlertTriangle size={15} /> : <X size={15} />}<strong>{check.label}</strong><span>{check.detail}</span></div>)}</section>
      </>}
    </aside></div><footer>SIMULATED / 合成模拟数据　·　生成日志、约束和随机 seed 随项目导出　·　不代表真实实验观测</footer>{notice && <div className="toast" onClick={() => setNotice('')}>{notice}</div>}
  </main>
}
