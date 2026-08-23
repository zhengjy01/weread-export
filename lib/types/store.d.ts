/**
 * dsh-weread — credential/cache store.
 *
 * Persists the WeRead Skills API key (wrk-...) to ~/.dsh/dsh-weread.json
 * (mode 0600) and the latest sync snapshot (bookshelf + notebook overview)
 * to ~/.dsh/dsh-weread-cache.json. The config file holds the API key plus
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
    /** ISO timestamp of the last successful sync. */
    lastSyncAt: string;
}
/** Public, secret-free status view. */
export interface WereadConfigView {
    configured: boolean;
    apiKeyMasked: string;
    defaultFlomoTag: string;
    lastSyncAt: string;
    configPath: string;
}
/** Mask a credential for display, keeping only the head and tail. */
export declare function mask(value: string): string;
/**
 * Small credential store backed by ~/.dsh/dsh-weread.json.
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
     * Apply a config patch: apiKey / defaultFlomoTag replace, reset clears.
     * Returns the public view.
     */
    patch(args: Record<string, unknown> | undefined): Promise<WereadConfigView>;
}
