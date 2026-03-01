export type JsonObject = Record<string, unknown>;

export function asJsonObject(value: unknown): JsonObject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as JsonObject;
}

export function asJsonArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function getJsonObjectField(source: JsonObject, key: string): JsonObject | null {
  return asJsonObject(source[key]);
}

export function getJsonArrayField(source: JsonObject, key: string): unknown[] {
  return asJsonArray(source[key]);
}

export function getJsonObjectArrayField(source: JsonObject, key: string) {
  return asJsonArray(source[key]).map((item) => asJsonObject(item)).filter((item): item is JsonObject => Boolean(item));
}

export function getStringField(source: JsonObject, key: string) {
  const raw = source[key];
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
  return "";
}

export function getStringArrayField(source: JsonObject, key: string, limit = 100) {
  return getJsonArrayField(source, key)
    .map((item) => (typeof item === "string" ? item.trim() : typeof item === "number" ? String(item) : ""))
    .filter(Boolean)
    .slice(0, limit);
}

export function getRoundedNumberField(source: JsonObject, key: string, fallback = 0) {
  const raw = source[key];
  const value = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(value)) return fallback;
  return Math.round(value);
}

export function clampScore(value: unknown, fallback = 0) {
  const normalized =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(normalized)) return fallback;
  return Math.max(0, Math.min(100, Math.round(normalized)));
}
