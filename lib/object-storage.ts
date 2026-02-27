import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

export type StoredObjectRef = {
  provider: "local";
  key: string;
  size: number;
};

type PutBase64ObjectInput = {
  namespace: string;
  base64: string;
  keyHint?: string;
};

function getObjectStorageRoot() {
  const configured = process.env.OBJECT_STORAGE_ROOT?.trim();
  if (configured) {
    return configured;
  }
  return path.join(process.cwd(), ".runtime-data", "objects");
}

function sanitizeKeySegment(value: string) {
  return value
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function buildObjectKey(input: { namespace: string; keyHint?: string }) {
  const date = new Date().toISOString().slice(0, 10);
  const random = crypto.randomBytes(10).toString("hex");
  const hint = sanitizeKeySegment(input.keyHint ?? "file");
  const namespace = sanitizeKeySegment(input.namespace || "default") || "default";
  return `${namespace}/${date}/${random}-${hint || "file"}`;
}

function toAbsoluteObjectPath(key: string) {
  return path.join(getObjectStorageRoot(), key);
}

export async function putBase64Object(input: PutBase64ObjectInput): Promise<StoredObjectRef> {
  const key = buildObjectKey({ namespace: input.namespace, keyHint: input.keyHint });
  const filePath = toAbsoluteObjectPath(key);
  const data = Buffer.from(input.base64, "base64");

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, data);

  return {
    provider: "local",
    key,
    size: data.length
  };
}

export async function getBase64Object(key: string) {
  if (!key.trim()) return null;
  const filePath = toAbsoluteObjectPath(key);
  try {
    const buffer = await fs.readFile(filePath);
    return buffer.toString("base64");
  } catch (error) {
    const fsError = error as NodeJS.ErrnoException;
    if (fsError.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function deleteObject(key?: string | null) {
  if (!key?.trim()) return;
  const filePath = toAbsoluteObjectPath(key);
  try {
    await fs.unlink(filePath);
  } catch (error) {
    const fsError = error as NodeJS.ErrnoException;
    if (fsError.code !== "ENOENT") {
      throw error;
    }
  }
}
