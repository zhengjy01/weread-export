/**
 * weread-export — flomo export integration.
 *
 * weread_flomo sends a book's highlights/thoughts to flomo (浮墨笔记).
 * It reuses the credentials already configured for the dsh-flomo plugin
 * (~/.dsh/dsh-flomo.json, mode 0600): webhookUrl wins over apiKey. The
 * flomo tag is fully customizable — the tool's `tag` parameter, or the
 * store's defaultFlomoTag (defaults to 微信读书).
 */
/** Config file location shared with dsh-flomo (machine-wide, mode 0600). */
export declare const FLOMO_CONFIG_FILE: string;
/** Persisted flomo credential shape (read-only from weread's side). */
export interface FlomoCredentials {
    apiKey: string;
    webhookUrl: string;
}
/** Whether flomo credentials exist on this machine. */
export declare function flomoConfigured(): Promise<boolean>;
/** Load and resolve the flomo send URL (null when not configured). */
export declare function resolveFlomoUrl(): Promise<string | null>;
/** One send outcome (never throws for HTTP/parse outcomes). */
export interface FlomoSendResult {
    ok: boolean;
    message: string;
    code?: number;
}
/**
 * POST one memo to the flomo logging API. Resolves { ok, message, code? } —
 * rejects only for transport-level failures.
 */
export declare function postMemo(url: string, content: string): Promise<FlomoSendResult>;
/** Append normalized #tags to a memo body. */
export declare function buildTaggedContent(content: string, tags: string): string;
