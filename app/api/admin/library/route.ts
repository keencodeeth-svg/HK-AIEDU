import { requireRole } from "@/lib/guard";
import {
  createLearningLibraryItem,
  hydrateLearningLibraryItemContent,
  listLearningLibraryItems
} from "@/lib/learning-library";
import { assertAdminStepUp } from "@/lib/admin-step-up";
import { badRequest, unauthorized } from "@/lib/api/http";
import { parseJson } from "@/lib/api/validation";
import { v } from "@/lib/api/validation";
import { createAdminRoute } from "@/lib/api/domains";

export const dynamic = "force-dynamic";

const bodySchema = v.object<{
  title?: string;
  description?: string;
  contentType?: string;
  subject?: string;
  grade?: string;
  sourceType?: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
  contentBase64?: string;
  linkUrl?: string;
  textContent?: string;
  knowledgePointIds?: string[];
}>(
  {
    title: v.optional(v.string({ minLength: 1 })),
    description: v.optional(v.string({ allowEmpty: true, trim: false })),
    contentType: v.optional(v.string({ minLength: 1 })),
    subject: v.optional(v.string({ minLength: 1 })),
    grade: v.optional(v.string({ minLength: 1 })),
    sourceType: v.optional(v.string({ minLength: 1 })),
    fileName: v.optional(v.string({ allowEmpty: true, trim: false })),
    mimeType: v.optional(v.string({ allowEmpty: true, trim: false })),
    size: v.optional(v.number({ integer: true, min: 0, coerce: true })),
    contentBase64: v.optional(v.string({ allowEmpty: true, trim: false })),
    linkUrl: v.optional(v.string({ allowEmpty: true, trim: false })),
    textContent: v.optional(v.string({ allowEmpty: true, trim: false })),
    knowledgePointIds: v.optional(v.array(v.string({ minLength: 1 })))
  },
  { allowUnknown: false }
);

function normalizeSourceType(value?: string) {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "file" || normalized === "link" || normalized === "text") {
    return normalized;
  }
  return "text";
}

function normalizeContentType(value?: string) {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "textbook" || normalized === "courseware" || normalized === "lesson_plan") {
    return normalized;
  }
  return "textbook";
}

function toPublicLibraryItem<T extends { contentStorageProvider?: string; contentStorageKey?: string }>(item: T) {
  const { contentStorageProvider, contentStorageKey, ...rest } = item;
  return rest;
}

export const GET = createAdminRoute({
  cache: "private-short",
  handler: async () => {
    const user = await requireRole("admin");
    if (!user) {
      unauthorized();
    }

    const data = await listLearningLibraryItems({
      accessScope: "global"
    });
    return { data: data.map((item) => toPublicLibraryItem(item)) };
  }
});

export const POST = createAdminRoute({
  cache: "private-realtime",
  handler: async ({ request }) => {
    const user = await requireRole("admin");
    if (!user) {
      unauthorized();
    }
    assertAdminStepUp(user);

    const body = await parseJson(request, bodySchema);
    const title = body.title?.trim();
    const subject = body.subject?.trim();
    const grade = body.grade?.trim();
    if (!title || !subject || !grade) {
      badRequest("missing fields");
    }

    const contentType = normalizeContentType(body.contentType?.trim());
    const sourceType = normalizeSourceType(body.sourceType?.trim());
    if (contentType === "textbook" && sourceType !== "file") {
      badRequest("textbook requires file source");
    }
    if (sourceType === "file" && !body.contentBase64?.trim()) {
      badRequest("file content required");
    }
    if (sourceType === "link" && !body.linkUrl?.trim()) {
      badRequest("link required");
    }
    if (sourceType === "text" && !body.textContent?.trim()) {
      badRequest("text content required");
    }

    const item = await createLearningLibraryItem({
      title,
      description: body.description?.trim() || undefined,
      contentType,
      subject,
      grade,
      ownerRole: "admin",
      ownerId: user.id,
      accessScope: "global",
      sourceType,
      fileName: body.fileName?.trim() || undefined,
      mimeType: body.mimeType?.trim() || undefined,
      size: body.size,
      contentBase64: body.contentBase64?.trim() || undefined,
      linkUrl: body.linkUrl?.trim() || undefined,
      textContent: body.textContent ?? undefined,
      knowledgePointIds: body.knowledgePointIds ?? [],
      generatedByAi: false,
      status: "published"
    });

    const hydrated = await hydrateLearningLibraryItemContent(item);
    return { data: toPublicLibraryItem(hydrated ?? item) };
  }
});
