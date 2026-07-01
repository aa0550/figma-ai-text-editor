import type { TextNode, Suggestion } from '../shared/types'

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

export async function checkTextsWithAI(
  nodes: TextNode[],
  rules: string,
  apiKey: string,
  onProgress: (done: number, total: number) => void,
): Promise<Suggestion[]> {
  const BATCH = 20
  const results: Suggestion[] = []

  for (let i = 0; i < nodes.length; i += BATCH) {
    const batch = nodes.slice(i, i + BATCH)
    const batchResults = await checkBatch(batch, rules, apiKey)
    results.push(...batchResults)
    onProgress(Math.min(i + BATCH, nodes.length), nodes.length)
  }

  return results
}

async function checkBatch(nodes: TextNode[], rules: string, apiKey: string): Promise<Suggestion[]> {
  const textsJson = JSON.stringify(
    nodes.map((n) => ({ id: n.id, text: n.text })),
    null,
    2,
  )

  const prompt = `Ты редактор UX-текстов. Ниже правила tone of voice и стиля:

---
${rules}
---

Проверь следующие тексты и предложи исправления ТОЛЬКО там, где нарушены правила. Если текст корректен — не включай его в ответ.

Тексты (JSON):
${textsJson}

Ответь строго валидным JSON-массивом без пояснений и markdown-блоков:
[
  {
    "id": "<id из входных данных>",
    "suggested": "<исправленный текст>",
    "reason": "<краткое объяснение на русском, 1 предложение>"
  }
]

Если все тексты корректны — верни пустой массив [].`

  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Gemini API error ${response.status}: ${err}`)
  }

  const data = await response.json()
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]'

  let parsed: { id: string; suggested: string; reason: string }[] = []
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.error('Failed to parse Gemini response:', raw)
    return []
  }

  return parsed.flatMap((item) => {
    const node = nodes.find((n) => n.id === item.id)
    if (!node || node.text === item.suggested) return []
    return [{
      nodeId: item.id,
      original: node.text,
      suggested: item.suggested,
      reason: item.reason,
      parentName: node.parentName,
      pageName: node.pageName,
    }]
  })
}
