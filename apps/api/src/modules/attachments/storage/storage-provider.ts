import type { Readable } from "node:stream";

/**
 * Abstraction over the bytes-store. Tier 1 ships `LocalStorageProvider`;
 * `S3StorageProvider` / `R2StorageProvider` slot in later without touching
 * any consumer because every attachment row carries its own `storageBackend`
 * + `storageKey` columns.
 */
export interface StorageProvider {
  /** Persist `body` under `key`. Throws on quota / IO failure. */
  put(
    key: string,
    body: Buffer,
    meta: { mimeType: string; size: number },
  ): Promise<void>;

  /** Open a read stream for `key`. */
  getStream(key: string): Promise<Readable>;

  /**
   * Issue a pre-signed download URL the browser can hit directly.
   * Returns `null` when the backend has no native signing (e.g. local FS) —
   * the caller falls back to streaming through the API.
   */
  signedUrl(key: string, ttlSeconds: number): Promise<string | null>;

  /** Best-effort delete. Idempotent. */
  delete(key: string): Promise<void>;

  /** Identifier persisted into `attachments.StorageBackend`. */
  readonly name: "local" | "s3" | "r2";
}
