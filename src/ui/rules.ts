const URL_RE = /^https?:\/\//i
const GITHUB_BLOB_RE = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/i

export function isUrlSource(value: string): boolean {
  return URL_RE.test(value.trim())
}

function toFetchableUrl(url: string): string {
  const m = url.match(GITHUB_BLOB_RE)
  if (!m) return url
  const [, owner, repo, branch, path] = m
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`
}

export interface RulesResolveError {
  url: string
  error: string
}

export interface ResolvedRules {
  combined: string
  errors: RulesResolveError[]
}

export async function resolveRulesText(raw: string): Promise<ResolvedRules> {
  const lines = raw.split('\n')
  const errors: RulesResolveError[] = []

  const resolvedLines = await Promise.all(
    lines.map(async (line) => {
      const trimmed = line.trim()
      if (!isUrlSource(trimmed)) return line
      const fetchUrl = toFetchableUrl(trimmed)
      try {
        const res = await fetch(fetchUrl)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const content = (await res.text()).trim()
        return `### ${trimmed}\n${content}`
      } catch (e) {
        errors.push({ url: fetchUrl, error: e instanceof Error ? e.message : String(e) })
        return line
      }
    }),
  )

  return { combined: resolvedLines.join('\n'), errors }
}
