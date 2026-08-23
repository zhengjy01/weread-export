/**
 * weread-export — LLM prompt processing.
 *
 * A minimal OpenAI-compatible chat-completions client (DeepSeek-style). The
 * base URL, API key, and model are configured in the settings panel (the AI
 * section of this plugin) — no dependency on the host model registry. Used
 * to run highlights through a user-editable prompt before export.
 */

/** LLM endpoint configuration. */
export interface LlmConfig {
  baseUrl: string
  apiKey: string
  model: string
}

/** Request timeout for one chat completion. */
const REQUEST_TIMEOUT_MS = 60000

/** Is the LLM configured (key + base url + model present)? */
export function llmConfigured(config: LlmConfig): boolean {
  return config.apiKey.trim() !== '' && config.baseUrl.trim() !== '' && config.model.trim() !== ''
}

/**
 * One chat completion. Resolves the assistant text; rejects with a readable
 * error on transport or API failures.
 */
export async function chatComplete(config: LlmConfig, system: string, user: string): Promise<string> {
  if (!llmConfigured(config)) {
    throw new Error('LLM 未配置：请在设置面板「AI」区填写 API Key / Base URL / 模型。')
  }
  const base = config.baseUrl.trim().replace(/\/+$/, '')
  const url = base.endsWith('/chat/completions') ? base : base + '/chat/completions'
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + config.apiKey.trim(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model.trim(),
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.4,
        max_tokens: 4000,
        stream: false,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    throw new Error('LLM 请求失败（网络错误）: ' + String(error instanceof Error ? error.message : error))
  }
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new Error('LLM 返回了无法解析的响应（HTTP ' + response.status + '）')
  }
  if (!response.ok) {
    const record = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {}
    const message = typeof record.message === 'string' ? record.message
      : (typeof record.error === 'object' && record.error !== null
        ? String((record.error as Record<string, unknown>).message ?? JSON.stringify(record.error))
        : 'HTTP ' + response.status)
    throw new Error('LLM 请求失败: ' + message)
  }
  const record = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {}
  const choices = record.choices
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new Error('LLM 响应缺少 choices')
  }
  const first = choices[0] as Record<string, unknown>
  const message = typeof first.message === 'object' && first.message !== null
    ? first.message as Record<string, unknown>
    : {}
  const content = typeof message.content === 'string' ? message.content : ''
  return content
}

/**
 * Fill {title} / {author} / {highlights} / {thoughts} placeholders in a
 * prompt template.
 */
export function renderPrompt(
  template: string,
  vars: { title: string; author: string; highlights: string; thoughts: string },
): string {
  return template
    .replaceAll('{title}', vars.title)
    .replaceAll('{author}', vars.author)
    .replaceAll('{highlights}', vars.highlights)
    .replaceAll('{thoughts}', vars.thoughts)
}
