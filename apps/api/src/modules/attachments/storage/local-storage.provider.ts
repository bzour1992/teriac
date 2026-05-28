import { createReadStream, promises as fs } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Readable } from "node:stream";
import type { StorageProvider } from "./storage-provider";

export const STORAGE_PROVIDER = Symbol("STORAGE_PROVIDER");

/**
 * Filesystem-backed storage. Path layout:
 *
 *   <root>/<HCenterID>/<yyyy>/<mm>/<AttachmentID>.<ext>
 *
 * - The caller is expected to supply the full `key` (including HCenterID
 *   prefix); we never compute tenant scoping here so the provider stays
 *   un-aware of tenants.
 * - We resolve every key against the root with `path.resolve` and verify the
 *   result stays inside the root — defends against path traversal via a
 *   malicious entity name leaking into the key.
 * - `STORAGE_LOCAL_PATH` is required in the env. Defaults to
 *   `./.storage/attachments` for dev convenience.
 */
@Injectable()
export class LocalStorageProvider implements StorageProvider {
  readonly name = "local" as const;
  private readonly log = new Logger(LocalStorageProvider.name);
  private readonly root: string;

  constructor(@Inject(ConfigService) config: ConfigService) {
    const raw =
      config.get<string>("STORAGE_LOCAL_PATH") ?? "./.storage/attachments";
    this.root = resolve(raw);
  }

  async put(
    key: string,
    body: Buffer,
    _meta: { mimeType: string; size: number },
  ): Promise<void> {
    const full = this.absolutePath(key);
    await fs.mkdir(dirname(full), { recursive: true });
    await fs.writeFile(full, body);
  }

  async getStream(key: string): Promise<Readable> {
    const full = this.absolutePath(key);
    try {
      await fs.access(full);
    } catch {
      throw new NotFoundException(`Attachment file missing: ${key}`);
    }
    return createReadStream(full);
  }

  async signedUrl(_key: string, _ttlSeconds: number): Promise<string | null> {
    // Local storage has no native signing — caller streams through the API
    // instead. Returning null tells AttachmentsController to fall back.
    return null;
  }

  async delete(key: string): Promise<void> {
    const full = this.absolutePath(key);
    try {
      await fs.unlink(full);
    } catch (err) {
      // Idempotent — missing file isn't an error from the caller's POV, but
      // log it so we notice if deletes are silently failing in production.
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        this.log.warn(`Failed to delete ${key}: ${(err as Error).message}`);
      }
    }
  }

  /**
   * Resolve `key` against the root, guard against `..` escapes.
   * Throws if the resolved path leaves the root directory.
   */
  private absolutePath(key: string): string {
    const full = resolve(this.root, key);
    if (!full.startsWith(this.root + "/") && full !== this.root) {
      throw new Error(`Path traversal blocked: ${key}`);
    }
    return full;
  }
}

/** Helper consumers use to construct a key with consistent layout. */
export function buildStorageKey(
  hcenterId: string,
  attachmentId: string,
  originalFileName: string,
): string {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  // Preserve the file extension so a download with a missing
  // Content-Disposition still looks right when saved.
  const dotIdx = originalFileName.lastIndexOf(".");
  const ext =
    dotIdx > 0 && dotIdx < originalFileName.length - 1
      ? originalFileName.slice(dotIdx + 1).toLowerCase().replace(/[^a-z0-9]/g, "")
      : "";
  return join(hcenterId, yyyy, mm, ext ? `${attachmentId}.${ext}` : attachmentId);
}
