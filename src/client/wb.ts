/**
 * Shared /wb-git wire helpers for the dock-git client: the response envelope,
 * the POST helper, error formatting (truncated for the on-screen op strip)
 * and the wire value shapes used by BOTH the graph view and the settings
 * panel. Self-contained (no imports beyond the browser globals), so it stays
 * bundle-safe — CommitView and SettingsView import from here instead of
 * duplicating the definitions.
 */

/** One /wb-git response envelope. */
export interface WbEnvelope<T> {
  ok: boolean
  value?: T
  error?: { code: string; message: string }
}

/** POST one /wb-git method; throws on transport/envelope failure. */
export async function postWb<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  let json: WbEnvelope<T>
  try {
    json = (await response.json()) as WbEnvelope<T>
  } catch {
    throw new Error(`${path} returned a malformed response`)
  }
  if (json.ok !== true || json.value === undefined) {
    throw new Error(json.error?.message ?? `${path} failed`)
  }
  return json.value
}

/** Error → string, truncated so the op strip / settings error areas stay readable. */
export function messageOf(cause: unknown): string {
  const text = cause instanceof Error ? cause.message : String(cause)
  return text.length > 500 ? `${text.slice(0, 500)}…` : text
}

/**
 * Build one /wb-git request body: sessionId + optional repoRoot (omitted when
 * empty, so a workspace-root request never pins an explicit root) + extra
 * fields. Endpoints run git at the session cwd unless repoRoot is present,
 * in which case it is the repository root itself.
 */
export function wbBody(
  sessionId: string | undefined,
  repoRoot: string | undefined,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  const body: Record<string, unknown> = { sessionId, ...extra }
  if (repoRoot !== undefined && repoRoot !== '') body.repoRoot = repoRoot
  return body
}

// ── Wire value shapes shared by CommitView and SettingsView ────────────────

/** One /wb-git/config read/write result. */
export interface ConfigValue {
  key: string
  value: string | null
}

/** One remote of /wb-git/remote list. */
export interface RemoteRow {
  name: string
  url: string
}

/** /wb-git/remote list result. */
export interface RemoteListValue {
  remotes: RemoteRow[]
}
