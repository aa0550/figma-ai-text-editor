import type { TextNode, Suggestion } from '../shared/types'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = 'x-ai/grok-4'

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

function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  return fenced ? fenced[1] : raw
}

async function checkBatch(nodes: TextNode[], rules: string, apiKey: string, attempt = 0): Promise<Suggestion[]> {
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

Ответь строго валидным JSON-объектом без пояснений и markdown-блоков, в формате:
{
  "changes": [
    {
      "id": "<id из входных данных>",
      "suggested": "<исправленный текст>",
      "reason": "<краткое объяснение на русском, 1 предложение>"
    }
  ]
}

Если все тексты корректны — верни {"changes": []}.`

  let response: Response
  try {
    response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`,
        'HTTP-Referer': 'https://www.figma.com',
        'X-Title': 'UX Text Editor',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      }),
    })
  } catch (e) {
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 3000))
      return checkBatch(nodes, rules, apiKey, attempt + 1)
    }
    throw new Error(`Не удалось связаться с OpenRouter API: ${e instanceof Error ? e.message : String(e)}`)
  }

  if (!response.ok) {
    const err = await response.text()
    if (response.status === 429 && attempt < 4) {
      const retryAfter = Number(response.headers.get('retry-after'))
      const delaySec = retryAfter || Math.min(30, (attempt + 1) * 8)
      await new Promise((r) => setTimeout(r, delaySec * 1000))
      return checkBatch(nodes, rules, apiKey, attempt + 1)
    }
    throw new Error(`OpenRouter API error ${response.status}: ${err}`)
  }

  const data = await response.json()
  const raw = data.choices?.[0]?.message?.content ?? '{"changes":[]}'

  let changes: { id: string; suggested: string; reason: string }[] = []
  try {
    changes = JSON.parse(extractJson(raw)).changes ?? []
  } catch {
    console.error('Failed to parse OpenRouter response:', raw)
    return []
  }

  return changes.flatMap((item) => {
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
