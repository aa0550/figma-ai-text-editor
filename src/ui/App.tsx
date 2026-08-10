import { useState, useEffect, useRef } from 'react'
import type { Suggestion, TextNode, PluginMessage, ScanScope } from '../shared/types'
import { usePluginMessage, sendMessage, useNavigate } from './usePluginBridge'
import { checkTextsWithAI } from './deepseek'
import { requestStorage, saveRules, saveApiKey } from './storage'

type Tab = 'scan' | 'results' | 'summary' | 'rules'
type ScanState = 'idle' | 'scanning' | 'checking' | 'done' | 'error'

const TABS: Tab[] = ['scan', 'results', 'summary', 'rules']

export default function App() {
  const [tab, setTab] = useState<Tab>('scan')
  const [rules, setRules] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [scope, setScope] = useState<ScanScope>('page')
  const [onlyVisible, setOnlyVisible] = useState(true)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const [fileKey, setFileKey] = useState<string | null>(null)
  const navigate = useNavigate()
  const dirty = useRef({ rules: false, apiKey: false })
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    requestStorage()
  }, [])

  function onPluginMessage(msg: PluginMessage) {
    if (msg.type === 'scan-complete') {
      handleScanComplete(msg.nodes)
    }
    if (msg.type === 'file-key') {
      setFileKey(msg.key)
    }
    if (msg.type === 'storage-data') {
      if (!dirty.current.rules) setRules(msg.rules)
      if (!dirty.current.apiKey) setApiKey(msg.apiKey)
    }
  }

  usePluginMessage(onPluginMessage)

  async function handleScanComplete(nodes: TextNode[]) {
    const nonEmpty = nodes.filter((n) => n.text.trim().length > 0)
    if (nonEmpty.length === 0) {
      setErrorMsg('На странице нет текстов')
      setScanState('error')
      return
    }
    setScanState('checking')
    setProgress({ done: 0, total: nonEmpty.length })
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const results = await checkTextsWithAI(nonEmpty, rules, apiKey, (done, total) => {
        setProgress({ done, total })
      }, controller.signal)
      if (controller.signal.aborted) return
      setSuggestions(results)
      setScanState('done')
      if (results.length > 0) setTab('results')
    } catch (e) {
      if (controller.signal.aborted) {
        setScanState('idle')
        return
      }
      setErrorMsg(e instanceof Error ? e.message : String(e))
      setScanState('error')
    }
  }

  function startScan() {
    if (!apiKey.trim()) { setErrorMsg('Укажите API ключ DeepSeek'); setScanState('error'); return }
    if (!rules.trim()) { setErrorMsg('Добавьте правила во вкладке «Правила»'); setScanState('error'); return }
    setErrorMsg('')
    setScanState('scanning')
    setSuggestions([])
    sendMessage({ type: 'get-file-key' })
    sendMessage({ type: 'start-scan', scope, onlyVisible })
  }

  function stopScan() {
    abortRef.current?.abort()
  }

  function updateSuggestion(nodeId: string, patch: Partial<Suggestion>) {
    setSuggestions((prev) => prev.map((s) => s.nodeId === nodeId ? { ...s, ...patch } : s))
  }

  function acceptChange(s: Suggestion) {
    sendMessage({ type: 'apply-change', nodeId: s.nodeId, newText: s.suggested })
    updateSuggestion(s.nodeId, { accepted: true, skipped: false })
  }

  function skipChange(s: Suggestion) {
    updateSuggestion(s.nodeId, { skipped: true, accepted: false })
  }

  function acceptAll() {
    const pending = suggestions.filter((s) => !s.skipped)
    sendMessage({ type: 'apply-all', changes: pending.map((s) => ({ nodeId: s.nodeId, newText: s.suggested })) })
    setSuggestions((prev) => prev.map((s) => s.skipped ? s : { ...s, accepted: true }))
  }

  function buildSummary(): string {
    const accepted = suggestions.filter((s) => s.accepted)
    if (accepted.length === 0) return ''
    const lines = accepted.map((s, i) => {
      const link = fileKey
        ? `https://www.figma.com/design/${fileKey}?node-id=${encodeURIComponent(s.parentId)}`
        : `node-id: ${s.parentId}`
      return `${i + 1}. ${link}\nБыло: ${s.original}\nСтало: ${s.suggested}\n${s.reason}`
    })
    return lines.join('\n\n')
  }

  return (
    <div style={styles.root}>
      <nav style={styles.nav}>
        {TABS.map((t) => (
          <button
            key={t}
            style={{ ...styles.navBtn, ...(tab === t ? styles.navActive : {}) }}
            onClick={() => setTab(t)}
          >
            {tabLabel(t)}
          </button>
        ))}
      </nav>

      <div style={styles.content}>
        {tab === 'scan' && (
          <ScanTab
            state={scanState}
            progress={progress}
            error={errorMsg}
            onStart={startScan}
            onStop={stopScan}
            onRetry={() => { setScanState('idle'); setErrorMsg('') }}
          />
        )}
        {tab === 'results' && (
          <ResultsTab
            suggestions={suggestions}
            onNavigate={(s) => navigate(s.nodeId)}
            onAccept={acceptChange}
            onSkip={skipChange}
            onAcceptAll={acceptAll}
          />
        )}
        {tab === 'summary' && (
          <SummaryTab summary={buildSummary()} hasSuggestions={suggestions.length > 0} />
        )}
        {tab === 'rules' && (
          <RulesTab
            rules={rules}
            apiKey={apiKey}
            onRulesChange={(v) => { dirty.current.rules = true; setRules(v); saveRules(v) }}
            onApiKeyChange={(v) => { dirty.current.apiKey = true; setApiKey(v); saveApiKey(v) }}
            scope={scope}
            onScopeChange={setScope}
            onlyVisible={onlyVisible}
            onOnlyVisibleChange={setOnlyVisible}
          />
        )}
      </div>
    </div>
  )
}

function tabLabel(t: Tab) {
  return { rules: 'Настройки', scan: 'Проверка', results: 'Результаты', summary: 'Саммари' }[t]
}

function RulesTab({ rules, apiKey, onRulesChange, onApiKeyChange, scope, onScopeChange, onlyVisible, onOnlyVisibleChange }: {
  rules: string; apiKey: string
  onRulesChange: (v: string) => void; onApiKeyChange: (v: string) => void
  scope: ScanScope; onScopeChange: (v: ScanScope) => void
  onlyVisible: boolean; onOnlyVisibleChange: (v: boolean) => void
}) {
  return (
    <div style={styles.section}>
      <div style={styles.fieldGroup}>
        <div style={styles.fieldHeader}>
          <label style={styles.label}>DeepSeek API Key</label>
          <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noreferrer" style={styles.link}>
            Получить ключ
          </a>
        </div>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => onApiKeyChange(e.target.value.trim())}
          placeholder="sk-..."
          style={styles.input}
        />
      </div>
      <div style={styles.optionsBlock}>
        <div style={{ ...styles.fieldGroup, flex: 1 }}>
          <label style={styles.label}>Область сканирования</label>
          <Select
            value={scope}
            onChange={onScopeChange}
            options={[
              { value: 'page', label: 'Текущая страница' },
              { value: 'selection', label: 'Только выделенное' },
            ]}
          />
        </div>
        <div style={{ ...styles.fieldGroup, flex: 1 }}>
          <label style={styles.label}>Видимость элементов</label>
          <Select
            value={onlyVisible ? 'visible' : 'all'}
            onChange={(v) => onOnlyVisibleChange(v === 'visible')}
            options={[
              { value: 'all', label: 'Все элементы' },
              { value: 'visible', label: 'Только видимые' },
            ]}
          />
        </div>
      </div>
      <div style={{ ...styles.fieldGroup, flex: 1 }}>
        <label style={styles.label}>Правила и Tone of Voice</label>
        <textarea
          value={rules}
          onChange={(e) => onRulesChange(e.target.value)}
          placeholder="Опишите правила написания текстов: обращение к пользователю, пунктуация, стиль, запрещённые слова и т.д."
          style={styles.textareaGrow}
        />
      </div>
    </div>
  )
}

function ScanTab({ state, progress, error, onStart, onStop, onRetry }: {
  state: ScanState; progress: { done: number; total: number }
  error: string
  onStart: () => void; onStop: () => void; onRetry: () => void
}) {
  return (
    <div style={{ ...styles.section, alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      {(state === 'idle' || state === 'done') && (
        <button style={styles.primary} onClick={onStart}>Проверить</button>
      )}
      {state === 'scanning' && <Spinner />}
      {state === 'checking' && (
        <>
          <Spinner label={`Проверка ${progress.done} / ${progress.total}`} labelStyle={styles.status} />
          <button style={styles.secondary} onClick={onStop}>Остановить</button>
        </>
      )}
      {state === 'error' && (
        <>
          <p style={{ color: '#F24822', fontSize: 12, textAlign: 'center' }}>{error}</p>
          <button style={styles.secondary} onClick={onRetry}>Попробовать снова</button>
        </>
      )}
    </div>
  )
}

function ResultsTab({ suggestions, onNavigate, onAccept, onSkip, onAcceptAll }: {
  suggestions: Suggestion[]
  onNavigate: (s: Suggestion) => void
  onAccept: (s: Suggestion) => void
  onSkip: (s: Suggestion) => void
  onAcceptAll: () => void
}) {
  const pending = suggestions.filter((s) => !s.accepted && !s.skipped)
  const accepted = suggestions.filter((s) => s.accepted)

  if (suggestions.length === 0) {
    return <div style={{ ...styles.section, padding: '0 16px', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ ...styles.status, fontSize: 12, textAlign: 'center' }}>Нет предложений. Запустите проверку.</p>
    </div>
  }

  return (
    <div style={{ ...styles.section, padding: '16px 12px 0' }}>
      <div style={styles.resultsHeader}>
        <span style={styles.status}>{pending.length} ожидают · {accepted.length} принято</span>
      </div>
      <div style={styles.list}>
        {suggestions.map((s) => (
          <SuggestionCard
            key={s.nodeId}
            suggestion={s}
            onNavigate={() => onNavigate(s)}
            onAccept={() => onAccept(s)}
            onSkip={() => onSkip(s)}
          />
        ))}
      </div>
      {pending.length > 0 && <button style={styles.secondary} onClick={onAcceptAll}>Принять все</button>}
    </div>
  )
}

function diffParts(a: string, b: string) {
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--
    endB--
  }
  return {
    prefix: a.slice(0, start),
    oldMid: a.slice(start, endA),
    newMid: b.slice(start, endB),
    suffix: a.slice(endA),
  }
}

function SuggestionCard({ suggestion: s, onNavigate, onAccept, onSkip }: {
  suggestion: Suggestion; onNavigate: () => void; onAccept: () => void; onSkip: () => void
}) {
  const isDone = s.accepted || s.skipped
  const { prefix, oldMid, newMid, suffix } = diffParts(s.original, s.suggested)
  return (
    <div style={{ ...styles.card, opacity: isDone ? 0.5 : 1 }}>
      <div style={styles.cardMeta} onClick={onNavigate}>
        <span style={styles.frameName}>{s.parentName}</span>
        <span style={styles.navArrow}>→</span>
      </div>
      <div style={styles.diff}>
        <div style={styles.diffOld}>
          <span style={styles.diffLabel}>Было</span>
          {prefix}<mark style={styles.diffOldMark}>{oldMid}</mark>{suffix}
        </div>
        <div style={styles.diffNew}>
          <span style={styles.diffLabel}>Стало</span>
          {prefix}<mark style={styles.diffNewMark}>{newMid}</mark>{suffix}
        </div>
      </div>
      <div style={styles.reason}>{s.reason}</div>
      {!isDone && (
        <div style={styles.cardActions}>
          <button style={styles.acceptBtn} onClick={onAccept}>Принять</button>
          <button style={styles.skipBtn} onClick={onSkip}>Пропустить</button>
        </div>
      )}
      {s.accepted && <div style={styles.statusDone}>Принято ✓</div>}
      {s.skipped && <div style={styles.statusSkip}>Пропущено</div>}
    </div>
  )
}

function copyToClipboard(text: string) {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.focus()
  ta.select()
  document.execCommand('copy')
  document.body.removeChild(ta)
}

function SummaryTab({ summary, hasSuggestions }: { summary: string; hasSuggestions: boolean }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    copyToClipboard(summary)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!summary) {
    return <div style={{ ...styles.section, padding: '0 16px', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ ...(hasSuggestions ? { ...styles.status, fontSize: 13 } : { ...styles.status, fontSize: 12 }), textAlign: 'center' }}>{hasSuggestions ? 'Нет принятых изменений' : 'Нет предложений. Запустите проверку.'}</p>
    </div>
  }

  return (
    <div style={styles.section}>
      <pre style={styles.summaryBox}>{summary}</pre>
      <button style={styles.secondary} onClick={copy}>{copied ? 'Скопировано!' : 'Копировать'}</button>
    </div>
  )
}

function Spinner({ label, labelStyle }: { label?: string; labelStyle?: React.CSSProperties }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={styles.spinner} />
      {label && <p style={labelStyle ?? styles.hint}>{label}</p>}
    </div>
  )
}

function Select<T extends string>({ value, onChange, options }: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  return (
    <div ref={ref} style={styles.selectWrap}>
      <button type="button" style={styles.select} onClick={() => setOpen((o) => !o)}>
        <span>{current?.label}</span>
        <span style={styles.selectArrow}>▾</span>
      </button>
      {open && (
        <div style={styles.selectMenu}>
          {options.map((opt) => (
            <div
              key={opt.value}
              className="select-option"
              style={{ ...styles.selectOption, ...(opt.value === value ? styles.selectOptionActive : {}) }}
              onClick={() => { onChange(opt.value); setOpen(false) }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', fontSize: 12, color: '#1E1E1E', background: '#fff' },
  nav: { display: 'flex', gap: 2, margin: '16px', padding: 4, background: '#F2F2F2', borderRadius: 9 },
  navBtn: { flex: 1, padding: '8px 4px', border: 'none', background: 'transparent', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#1E1E1E', transition: 'background 0.15s, color 0.15s' },
  navActive: { background: '#fff', color: '#1E1E1E', boxShadow: '0 1px 2px rgba(0,0,0,0.15)' },
  content: { flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' },
  section: { display: 'flex', flexDirection: 'column', padding: '0 16px 16px', gap: 16, height: '100%', boxSizing: 'border-box', background: '#fff' },
  label: { fontWeight: 600, fontSize: 12, color: '#1E1E1E', marginBottom: 2 },
  input: { border: '1px solid #E6E6E6', background: '#F5F5F5', borderRadius: 7, padding: '9px 11px', fontSize: 12, fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box', color: '#1E1E1E' },
  textarea: { border: '1px solid #E6E6E6', background: '#F5F5F5', borderRadius: 7, padding: '10px 11px', fontSize: 12, fontFamily: 'inherit', resize: 'vertical', minHeight: 240, outline: 'none', lineHeight: 1.6, width: '100%', boxSizing: 'border-box', color: '#1E1E1E' },
  textareaGrow: { border: '1px solid #E6E6E6', background: '#F5F5F5', borderRadius: 7, padding: '10px 11px', fontSize: 12, fontFamily: 'inherit', resize: 'none', outline: 'none', lineHeight: 1.6, width: '100%', boxSizing: 'border-box', color: '#1E1E1E', flex: 1 },
  hint: { fontSize: 12, color: '#8C8C8C', margin: 0 },
  status: { fontSize: 12, color: '#1E1E1E', margin: 0 },
  link: { fontSize: 12, color: '#0D99FF', textDecoration: 'none', fontWeight: 500, marginTop: -2 },
  fieldHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 4 },
  optionsBlock: { display: 'flex', flexDirection: 'row', gap: 8, width: '100%' },
  selectWrap: { position: 'relative', flex: 1 },
  select: { border: '1px solid #E6E6E6', background: '#F5F5F5', borderRadius: 7, padding: '9px 11px', fontSize: 12, outline: 'none', width: '100%', boxSizing: 'border-box', color: '#1E1E1E', fontFamily: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, textAlign: 'left' },
  selectArrow: { fontSize: 10, color: '#8C8C8C' },
  selectMenu: { position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#fff', border: '1px solid #E6E6E6', borderRadius: 7, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', padding: 4, zIndex: 10 },
  selectOption: { padding: '8px 9px', borderRadius: 5, fontSize: 12, color: '#1E1E1E', cursor: 'pointer' },
  selectOptionActive: { background: 'rgba(13,153,255,0.1)', color: '#0D99FF', fontWeight: 600 },
  primary: { background: '#0D99FF', color: '#fff', border: 'none', borderRadius: 7, padding: '9px 18px', cursor: 'pointer', fontWeight: 600, fontSize: 12 },
  secondary: { background: '#fff', color: '#1E1E1E', border: '1px solid #E6E6E6', borderRadius: 7, padding: '8px 13px', cursor: 'pointer', fontSize: 12, fontWeight: 500 },
  resultsHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  list: { display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto' },
  card: { border: '1px solid #E6E6E6', borderRadius: 7, padding: 13, display: 'flex', flexDirection: 'column', gap: 8, transition: 'opacity 0.2s', background: '#fff' },
  cardMeta: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' },
  frameName: { fontSize: 11, fontWeight: 600, color: '#8C8C8C', textTransform: 'uppercase', letterSpacing: 0.5 },
  navArrow: { fontSize: 12, color: '#0D99FF' },
  diff: { display: 'flex', flexDirection: 'column', gap: 4 },
  diffOld: { background: '#F5F5F5', borderRadius: 5, padding: '7px 9px', fontSize: 12, color: '#1E1E1E', lineHeight: 1.5 },
  diffNew: { background: '#F5F5F5', borderRadius: 5, padding: '7px 9px', fontSize: 12, color: '#1E1E1E', lineHeight: 1.5 },
  diffLabel: { fontSize: 10, fontWeight: 700, marginRight: 6, color: '#8C8C8C', textTransform: 'uppercase' },
  diffOldMark: { background: 'rgba(140,140,140,0.2)', color: '#8C8C8C', textDecoration: 'line-through', borderRadius: 3, padding: '0 2px' },
  diffNewMark: { background: 'rgba(13,153,255,0.12)', color: '#0D99FF', fontWeight: 700, borderRadius: 3, padding: '0 2px' },
  reason: { fontSize: 11, color: '#1E1E1E' },
  cardActions: { display: 'flex', gap: 8 },
  acceptBtn: { flex: 1, background: '#0D99FF', color: '#fff', border: 'none', borderRadius: 7, padding: '7px', cursor: 'pointer', fontWeight: 600, fontSize: 12 },
  skipBtn: { flex: 1, background: '#fff', color: '#8C8C8C', border: '1px solid #E6E6E6', borderRadius: 7, padding: '7px', cursor: 'pointer', fontSize: 12 },
  statusDone: { fontSize: 12, color: '#14AE5C', fontWeight: 600 },
  statusSkip: { fontSize: 12, color: '#8C8C8C' },
  summaryBox: { background: '#F5F5F5', border: '1px solid #E6E6E6', borderRadius: 7, padding: 13, fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word', flex: 1, overflow: 'auto', margin: 0, color: '#1E1E1E' },
  spinner: { width: 26, height: 26, border: '3px solid #E6E6E6', borderTop: '3px solid #0D99FF', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' },
}
