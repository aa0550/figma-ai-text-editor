import { useState, useEffect, useRef } from 'react'
import type { Suggestion, TextNode, PluginMessage } from '../shared/types'
import { usePluginMessage, sendMessage, useNavigate } from './usePluginBridge'
import { checkTextsWithAI } from './openrouter'
import { requestStorage, saveRules, saveApiKey } from './storage'

type Tab = 'rules' | 'scan' | 'results' | 'summary'
type ScanState = 'idle' | 'scanning' | 'checking' | 'done' | 'error'

export default function App() {
  const [tab, setTab] = useState<Tab>('rules')
  const [rules, setRules] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const [fileKey, setFileKey] = useState<string | null>(null)
  const navigate = useNavigate()
  const dirty = useRef({ rules: false, apiKey: false })

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
    try {
      const results = await checkTextsWithAI(nonEmpty, rules, apiKey, (done, total) => {
        setProgress({ done, total })
      })
      setSuggestions(results)
      setScanState('done')
      setTab('results')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e))
      setScanState('error')
    }
  }

  function startScan() {
    if (!apiKey.trim()) { setErrorMsg('Укажите API ключ OpenRouter'); setScanState('error'); return }
    if (!rules.trim()) { setErrorMsg('Добавьте правила во вкладке «Правила»'); setScanState('error'); return }
    setErrorMsg('')
    setScanState('scanning')
    setSuggestions([])
    sendMessage({ type: 'get-file-key' })
    sendMessage({ type: 'start-scan' })
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
    if (accepted.length === 0) return 'Изменений не принято.'
    const date = new Date().toLocaleDateString('ru-RU')
    const lines = accepted.map((s, i) => {
      const link = fileKey
        ? `https://www.figma.com/design/${fileKey}?node-id=${encodeURIComponent(s.nodeId)}`
        : `node-id: ${s.nodeId}`
      return `${i + 1}. Экран «${s.parentName}» (${s.pageName})\n   Было: ${s.original}\n   Стало: ${s.suggested}\n   Ссылка: ${link}`
    })
    return `Изменения текстов — ${date}\n\n${lines.join('\n\n')}`
  }

  return (
    <div style={styles.root}>
      <nav style={styles.nav}>
        {(['rules', 'scan', 'results', 'summary'] as Tab[]).map((t) => (
          <button
            key={t}
            style={{ ...styles.navBtn, ...(tab === t ? styles.navActive : {}) }}
            onClick={() => setTab(t)}
          >
            {tabLabel(t)}
            {t === 'results' && suggestions.length > 0 && (
              <span style={styles.badge}>{suggestions.filter((s) => !s.accepted && !s.skipped).length}</span>
            )}
          </button>
        ))}
      </nav>

      <div style={styles.content}>
        {tab === 'rules' && (
          <RulesTab
            rules={rules}
            apiKey={apiKey}
            onRulesChange={(v) => { dirty.current.rules = true; setRules(v); saveRules(v) }}
            onApiKeyChange={(v) => { dirty.current.apiKey = true; setApiKey(v); saveApiKey(v) }}
          />
        )}
        {tab === 'scan' && (
          <ScanTab
            state={scanState}
            progress={progress}
            error={errorMsg}
            onStart={startScan}
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
            onSummary={() => setTab('summary')}
          />
        )}
        {tab === 'summary' && (
          <SummaryTab summary={buildSummary()} />
        )}
      </div>
    </div>
  )
}

function tabLabel(t: Tab) {
  return { rules: 'Правила', scan: 'Проверка', results: 'Результаты', summary: 'Саммари' }[t]
}

function RulesTab({ rules, apiKey, onRulesChange, onApiKeyChange }: {
  rules: string; apiKey: string
  onRulesChange: (v: string) => void; onApiKeyChange: (v: string) => void
}) {
  return (
    <div style={styles.section}>
      <label style={styles.label}>OpenRouter API Key</label>
      <input
        type="password"
        value={apiKey}
        onChange={(e) => onApiKeyChange(e.target.value.trim())}
        placeholder="sk-or-v1-..."
        style={styles.input}
      />
      <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" style={styles.link}>
        Получить бесплатно →
      </a>
      <label style={styles.label} >Правила и Tone of Voice</label>
      <textarea
        value={rules}
        onChange={(e) => onRulesChange(e.target.value)}
        placeholder="Опишите правила написания текстов: обращение к пользователю, пунктуация, стиль, запрещённые слова и т.д."
        style={styles.textarea}
      />
      <p style={styles.hint}>Изменения сохраняются автоматически</p>
    </div>
  )
}

function ScanTab({ state, progress, error, onStart, onRetry }: {
  state: ScanState; progress: { done: number; total: number }
  error: string; onStart: () => void; onRetry: () => void
}) {
  return (
    <div style={{ ...styles.section, alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      {state === 'idle' && (
        <>
          <p style={styles.hint}>Плагин проверит все тексты на текущей странице</p>
          <button style={styles.primary} onClick={onStart}>Запустить проверку</button>
        </>
      )}
      {state === 'scanning' && <Spinner label="Сканирование текстов..." />}
      {state === 'checking' && (
        <Spinner label={`Проверка AI: ${progress.done} / ${progress.total}`} />
      )}
      {state === 'done' && (
        <>
          <p style={{ color: '#0fa958', fontSize: 14 }}>Проверка завершена</p>
          <button style={styles.secondary} onClick={onRetry}>Проверить снова</button>
        </>
      )}
      {state === 'error' && (
        <>
          <p style={{ color: '#e53e3e', fontSize: 13, textAlign: 'center' }}>{error}</p>
          <button style={styles.secondary} onClick={onRetry}>Попробовать снова</button>
        </>
      )}
    </div>
  )
}

function ResultsTab({ suggestions, onNavigate, onAccept, onSkip, onAcceptAll, onSummary }: {
  suggestions: Suggestion[]
  onNavigate: (s: Suggestion) => void
  onAccept: (s: Suggestion) => void
  onSkip: (s: Suggestion) => void
  onAcceptAll: () => void
  onSummary: () => void
}) {
  const pending = suggestions.filter((s) => !s.accepted && !s.skipped)
  const accepted = suggestions.filter((s) => s.accepted)

  if (suggestions.length === 0) {
    return <div style={{ ...styles.section, alignItems: 'center', padding: 32 }}>
      <p style={styles.hint}>Нет предложений. Запустите проверку.</p>
    </div>
  }

  return (
    <div style={styles.section}>
      <div style={styles.resultsHeader}>
        <span style={styles.hint}>{pending.length} ожидают · {accepted.length} принято</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {pending.length > 0 && <button style={styles.secondary} onClick={onAcceptAll}>Принять все</button>}
          {accepted.length > 0 && <button style={styles.primary} onClick={onSummary}>Саммари</button>}
        </div>
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

function SummaryTab({ summary }: { summary: string }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(summary).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div style={styles.section}>
      <div style={styles.summaryHeader}>
        <span style={styles.label}>Саммари для разработчиков</span>
        <button style={styles.secondary} onClick={copy}>{copied ? 'Скопировано!' : 'Копировать'}</button>
      </div>
      <pre style={styles.summaryBox}>{summary}</pre>
    </div>
  )
}

function Spinner({ label }: { label: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={styles.spinner} />
      <p style={styles.hint}>{label}</p>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#1a1a1a', background: '#fff' },
  nav: { display: 'flex', borderBottom: '1px solid #e5e5e5', background: '#fafafa' },
  navBtn: { flex: 1, padding: '10px 4px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: '#666', position: 'relative' },
  navActive: { color: '#0066ff', borderBottom: '2px solid #0066ff', fontWeight: 600 },
  badge: { position: 'absolute', top: 4, right: 4, background: '#0066ff', color: '#fff', borderRadius: 10, fontSize: 10, padding: '1px 5px', lineHeight: '14px' },
  content: { flex: 1, overflow: 'auto' },
  section: { display: 'flex', flexDirection: 'column', padding: 16, gap: 10, height: '100%', boxSizing: 'border-box' },
  label: { fontWeight: 600, fontSize: 12, color: '#444', marginBottom: 2 },
  input: { border: '1px solid #ddd', borderRadius: 6, padding: '8px 10px', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' },
  textarea: { border: '1px solid #ddd', borderRadius: 6, padding: '10px', fontSize: 13, resize: 'vertical', minHeight: 240, outline: 'none', lineHeight: 1.6, width: '100%', boxSizing: 'border-box' },
  hint: { fontSize: 12, color: '#888', margin: 0 },
  link: { fontSize: 12, color: '#0066ff', textDecoration: 'none', marginTop: -4 },
  primary: { background: '#0066ff', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  secondary: { background: '#f0f0f0', color: '#333', border: 'none', borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontSize: 13 },
  resultsHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  list: { display: 'flex', flexDirection: 'column', gap: 10, overflow: 'auto' },
  card: { border: '1px solid #e5e5e5', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, transition: 'opacity 0.2s' },
  cardMeta: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' },
  frameName: { fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5 },
  navArrow: { fontSize: 11, color: '#0066ff' },
  diff: { display: 'flex', flexDirection: 'column', gap: 4 },
  diffOld: { background: '#fff5f5', borderRadius: 4, padding: '6px 8px', fontSize: 13, color: '#c0392b', borderLeft: '3px solid #e57373', lineHeight: 1.5 },
  diffNew: { background: '#f0fff4', borderRadius: 4, padding: '6px 8px', fontSize: 13, color: '#1a7a3c', borderLeft: '3px solid #4caf50', lineHeight: 1.5 },
  diffLabel: { fontSize: 10, fontWeight: 700, marginRight: 6, opacity: 0.6, textTransform: 'uppercase' },
  diffOldMark: { background: '#f8b4b4', color: '#7a1f1f', borderRadius: 3, padding: '0 2px', textDecoration: 'line-through' },
  diffNewMark: { background: '#a8e6b8', color: '#12401f', borderRadius: 3, padding: '0 2px', fontWeight: 700 },
  reason: { fontSize: 11, color: '#888', fontStyle: 'italic' },
  cardActions: { display: 'flex', gap: 8 },
  acceptBtn: { flex: 1, background: '#f0fff4', color: '#1a7a3c', border: '1px solid #4caf50', borderRadius: 6, padding: '6px', cursor: 'pointer', fontWeight: 600, fontSize: 12 },
  skipBtn: { flex: 1, background: '#fafafa', color: '#666', border: '1px solid #ddd', borderRadius: 6, padding: '6px', cursor: 'pointer', fontSize: 12 },
  statusDone: { fontSize: 12, color: '#1a7a3c', fontWeight: 600 },
  statusSkip: { fontSize: 12, color: '#999' },
  summaryHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  summaryBox: { background: '#f8f8f8', border: '1px solid #e5e5e5', borderRadius: 8, padding: 14, fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word', flex: 1, overflow: 'auto', margin: 0 },
  spinner: { width: 28, height: 28, border: '3px solid #e5e5e5', borderTop: '3px solid #0066ff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' },
}
