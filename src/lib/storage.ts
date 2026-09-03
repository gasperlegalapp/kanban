import fs from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "@/db";

export type StoredFile = { data: Buffer; contentType: string };

export interface FileStorage {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<StoredFile | null>;
  remove(key: string): Promise<void>;
}

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "attachments";

/** Files on the local disk under ./.uploads (development). */
class LocalStorage implements FileStorage {
  private root = process.env.UPLOADS_DIR ?? path.join(projectRoot(), ".uploads");
  private resolve(key: string) {
    const p = path.join(this.root, key);
    if (!p.startsWith(this.root)) throw new Error("Invalid storage key");
    return p;
  }
  async put(key: string, data: Buffer, contentType: string) {
    const p = this.resolve(key);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, data);
    await fs.writeFile(p + ".meta", contentType);
  }
  async get(key: string) {
    const p = this.resolve(key);
    try {
      const [data, contentType] = await Promise.all([fs.readFile(p), fs.readFile(p + ".meta", "utf8").catch(() => "application/octet-stream")]);
      return { data, contentType };
    } catch {
      return null;
    }
  }
  async remove(key: string) {
    const p = this.resolve(key);
    await fs.rm(p, { force: true });
    await fs.rm(p + ".meta", { force: true });
  }
}

/** Supabase Storage bucket (production). The bucket is created on first use. */
class SupabaseStorage implements FileStorage {
  private ready: Promise<void> | null = null;
  private async client() {
    const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
    const c = createSupabaseAdminClient();
    if (!this.ready) {
      this.ready = (async () => {
        const { data } = await c.storage.getBucket(BUCKET);
        if (!data) await c.storage.createBucket(BUCKET, { public: false });
      })();
    }
    await this.ready;
    return c;
  }
  async put(key: string, data: Buffer, contentType: string) {
    const c = await this.client();
    const { error } = await c.storage.from(BUCKET).upload(key, data, { contentType, upsert: true });
    if (error) throw new Error(`Upload failed: ${error.message}`);
  }
  async get(key: string) {
    const c = await this.client();
    const { data, error } = await c.storage.from(BUCKET).download(key);
    if (error || !data) return null;
    return { data: Buffer.from(await data.arrayBuffer()), contentType: data.type || "application/octet-stream" };
  }
  async remove(key: string) {
    const c = await this.client();
    await c.storage.from(BUCKET).remove([key]);
  }
}

let instance: FileStorage | null = null;

export function getStorage(): FileStorage {
  if (!instance) {
    instance =
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? new SupabaseStorage() : new LocalStorage();
  }
  return instance;
}

export function safeFileName(name: string): string {
  return name.replace(/[^\w.\-() ]+/g, "_").slice(0, 120) || "file";
}
