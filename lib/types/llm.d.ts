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
    baseUrl: string;
    apiKey: string;
    model: string;
}
/** Is the LLM configured (key + base url + model present)? */
export declare function llmConfigured(config: LlmConfig): boolean;
/**
 * One chat completion. Resolves the assistant text; rejects with a readable
 * error on transport or API failures.
 */
export declare function chatComplete(config: LlmConfig, system: string, user: string): Promise<string>;
/**
 * Fill {title} / {author} / {highlights} / {thoughts} placeholders in a
 * prompt template.
 */
export declare function renderPrompt(template: string, vars: {
    title: string;
    author: string;
    highlights: string;
    thoughts: string;
}): string;
