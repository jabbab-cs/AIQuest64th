// Local-disk object storage. Files live under STORAGE_DIR (default ./storage next to where the API starts).
// ponytail: single-machine storage; swap this file for S3/GCS if the API ever runs on more than one server.
import { createReadStream } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";

const root = resolve(process.env.STORAGE_DIR || "storage");

export class ObjectNotFoundError extends Error {
  constructor() { super("Object not found"); this.name = "ObjectNotFoundError"; }
}

function diskPath(key: string) {
  const path = resolve(root, key.replace(/^\/+/, ""));
  if (path !== root && !path.startsWith(root + sep)) throw new ObjectNotFoundError();
  return path;
}

// The same small surface the code used from the Google Cloud Storage client.
class LocalFile {
  constructor(private path: string) {}
  async exists(): Promise<[boolean]> { return [await stat(this.path).then(s => s.isFile(), () => false)]; }
  async download(): Promise<[Buffer]> {
    try { return [await readFile(this.path)]; } catch { throw new ObjectNotFoundError(); }
  }
  async save(bytes: Buffer, _options?: unknown) { await mkdir(dirname(this.path), { recursive: true }); await writeFile(this.path, bytes); }
  async delete(_options?: unknown) { await rm(this.path, { force: true }); }
  createReadStream() { return createReadStream(this.path); }
}

export const objectStorageClient = {
  bucket: (name: string) => ({ file: (key: string) => new LocalFile(diskPath(`${name}/${key}`)) }),
};

export class ObjectStorageService {
  // The browser PUTs the PDF to this URL (handled in routes/applications.ts); the object path is what the API stores.
  async getObjectEntityUploadURL() { return `/api/uploads/${randomUUID()}`; }
  normalizeObjectEntityPath(uploadURL: string) { return `/objects/uploads/${uploadURL.split("/").pop()}`; }
  async getObjectEntityFile(objectPath: string) {
    const match = objectPath.match(/^\/objects\/(uploads\/[0-9a-f-]{36})$/);
    if (!match) throw new ObjectNotFoundError();
    const file = new LocalFile(diskPath(`uploads/${match[1].slice("uploads/".length)}.pdf`));
    if (!(await file.exists())[0]) throw new ObjectNotFoundError();
    return file;
  }
  async saveUpload(id: string, bytes: Buffer) { await new LocalFile(diskPath(`uploads/${id}.pdf`)).save(bytes); }
}
