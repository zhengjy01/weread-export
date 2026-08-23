/**
 * weread-export — credential/cache store.
 *
 * Persists the WeRead Skills API key (wrk-...) to ~/.dsh/weread-export.json
 * (mode 0600) and the latest sync snapshot (bookshelf + notebook overview)
 * to ~/.dsh/weread-export-cache.json. The config file holds the API key plus
 * the default flomo tag used by weread_flomo. Reads are lazy and cached;
 * the public view() never exposes secrets. Config paths can be overridden
 * with DSH_WEREAD_CONFIG / DSH_WEREAD_CACHE (used by tests).
 */
/** Default machine-wide config location (mode 0600). */
export declare const DEFAULT_CONFIG_FILE: string;
/** Default sync cache location (mode 0600). */
export declare const DEFAULT_CACHE_FILE: string;
/** Test override for the config location. */
export declare function configPath(): string;
/** Test override for the cache location. */
export declare function cachePath(): string;
/** Persisted credential shape. Secrets never leave this module. */
export interface WereadCredentials {
    /** WeRead Skills API key (wrk-...), user-bound. */
    apiKey: string;
    /** Default flomo tag for weread_flomo exports (without leading #). */
    defaultFlomoTag: string;
    /** Highlights per export: 0 = export ALL, N > 0 = cap at N. */
    exportLimit: number;
    /** Default export destination: flomo | local | notion. */
    exportDest: ExportDest;
    /** Local export directory (required when dest=local; no default). */
    localExportDir: string;
    /** Notion integration token (plugin-owned, independent of dsh-notion). */
    notionToken: string;
    /** Notion target parent page: id or URL (page must share with the token). */
    notionTargetPageId: string;
    /** Whether to run highlights through the LLM prompt before export. */
    usePrompt: boolean;
    /** LLM prompt template ({title}/{author}/{highlights}/{thoughts} placeholders). */
    exportPrompt: string;
    /** OpenAI-compatible chat completions base URL. */
    llmBaseUrl: string;
    /** LLM API key (custom, panel-configured). */
    llmApiKey: string;
    /** LLM model name. */
    llmModel: string;
    /** ISO timestamp of the last successful sync. */
    lastSyncAt: string;
}
/** Export destination; 'all' = every configured target at once. */
export type ExportDest = 'flomo' | 'local' | 'notion' | 'all';
/** Public, secret-free status view. */
export interface WereadConfigView {
    configured: boolean;
    apiKeyMasked: string;
    defaultFlomoTag: string;
    exportLimit: number;
    exportDest: ExportDest;
    localExportDir: string;
    notionConfigured: boolean;
    notionTargetPageId: string;
    usePrompt: boolean;
    llmConfigured: boolean;
    llmBaseUrl: string;
    llmModel: string;
    lastSyncAt: string;
    configPath: string;
}
/** Mask a credential for display, keeping only the head and tail. */
export declare function mask(value: string): string;
/** Default export prompt template. */
export declare const DEFAULT_EXPORT_PROMPT: string;
/**
 * Small credential store backed by ~/.dsh/weread-export.json.
 * Reads are lazy and cached; writes use mode 0600 so the API key never
 * leaks to other local users.
 */
export declare class WereadStore {
    config: WereadCredentials | null;
    load(): Promise<WereadCredentials>;
    save(next: WereadCredentials): Promise<void>;
    /** Public, secret-free view. */
    view(): Promise<WereadConfigView>;
    /**
     * Apply a config patch: any supported field replaces, reset clears.
     * Returns the public view.
     */
    patch(args: Record<string, unknown> | undefined): Promise<WereadConfigView>;
}
