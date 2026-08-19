import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const RULES_DIR = join(import.meta.dirname, '..', 'rules')

// Matches lines like "- A → B" or "A -> B", allowing "/" synonyms on either side.
const TERM_LINE_RE = /^-?\s*(.+?)\s*(?:→|->)\s*(.+?)\s*$/

function normalize(term) {
  return term.trim().toLowerCase().replace(/\s+/g, ' ')
}

function extractRules(text) {
  const rules = []
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line.startsWith('-')) continue
    const m = line.match(TERM_LINE_RE)
    if (!m) continue
    rules.push({ from: normalize(m[1]), to: normalize(m[2]) })
  }
  return rules
}

const files = readdirSync(RULES_DIR).filter((f) => f.endsWith('.md'))
const rulesByFile = files.map((file) => ({
  file,
  rules: extractRules(readFileSync(join(RULES_DIR, file), 'utf8')),
}))

const conflicts = []
for (let i = 0; i < rulesByFile.length; i++) {
  for (let j = i + 1; j < rulesByFile.length; j++) {
    const a = rulesByFile[i]
    const b = rulesByFile[j]
    for (const ra of a.rules) {
      for (const rb of b.rules) {
        if (ra.from === rb.to && ra.to === rb.from) {
          conflicts.push({ fileA: a.file, ruleA: ra, fileB: b.file, ruleB: rb })
        }
      }
    }
  }
}

if (conflicts.length === 0) {
  console.log('Конфликтов между правилами не найдено.')
} else {
  console.log(`Найдено конфликтов: ${conflicts.length}\n`)
  for (const c of conflicts) {
    console.log(`  ${c.fileA}: "${c.ruleA.from}" → "${c.ruleA.to}"`)
    console.log(`  ${c.fileB}: "${c.ruleB.from}" → "${c.ruleB.to}"`)
    console.log('')
  }
  process.exitCode = 1
}
