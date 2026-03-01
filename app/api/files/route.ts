import { getCurrentUser } from "@/lib/auth";
import { getClassesByStudent, getClassesByTeacher } from "@/lib/classes";
import { getStudentContext } from "@/lib/user-context";
import { createCourseFile, getCourseFilesByClassIds } from "@/lib/course-files";
import { badRequest, notFound, unauthorized } from "@/lib/api/http";
import { parseJson, parseSearchParams, v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

const MAX_SIZE_MB = 5;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

const filesQuerySchema = v.object<{ classId?: string }>(
  {
    classId: v.optional(v.string({ minLength: 1 }))
  },
  { allowUnknown: true }
);

const createLinkBodySchema = v.object<{
  classId?: string;
  folder?: string;
  title?: string;
  resourceType?: "link" | "file";
  linkUrl?: string;
}>(
  {
    classId: v.optional(v.string({ allowEmpty: true, trim: false })),
    folder: v.optional(v.string({ allowEmpty: true, trim: false })),
    title: v.optional(v.string({ allowEmpty: true, trim: false })),
    resourceType: v.optional(v.enum(["link", "file"] as const)),
    linkUrl: v.optional(v.string({ allowEmpty: true, trim: false }))
  },
  { allowUnknown: false }
);

async function getAccessibleClassIds(role: string, userId: string) {
  if (role === "teacher") {
    const classes = await getClassesByTeacher(userId);
    return classes.map((item) => item.id);
  }
  if (role === "student") {
    const classes = await getClassesByStudent(userId);
    return classes.map((item) => item.id);
  }
  if (role === "parent") {
    const student = await getStudentContext();
    if (!student) return [];
    const classes = await getClassesByStudent(student.id);
    return classes.map((item) => item.id);
  }
  return [];
}

export const GET = createLearningRoute({
  cache: "private-short",
  handler: async ({ request }) => {
    const user = await getCurrentUser();
    if (!user) {
      unauthorized();
    }

    const query = parseSearchParams(request, filesQuerySchema);
    const classId = query.classId;
    const accessible = await getAccessibleClassIds(user.role, user.id);
    if (!accessible.length) {
      return { data: [] };
    }

    const classIds = classId && accessible.includes(classId) ? [classId] : accessible;
    // File list is always limited to caller-accessible classes.
    const data = await getCourseFilesByClassIds(classIds);
    return { data };
  }
});

export const POST = createLearningRoute({
  cache: "private-realtime",
  handler: async ({ request }) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "teacher") {
      unauthorized();
    }

    const contentType = request.headers.get("content-type") ?? "";
    const accessible = await getAccessibleClassIds(user.role, user.id);

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const classId = String(formData.get("classId") ?? "");
      const folder = String(formData.get("folder") ?? "");
      const title = String(formData.get("title") ?? "");
      if (!classId) {
        badRequest("missing classId");
      }
      if (!accessible.includes(classId)) {
        notFound("class not found");
      }

      const files = formData.getAll("files");
      const picked = files.length ? files : [formData.get("file")].filter(Boolean);
      if (!picked.length) {
        badRequest("missing file");
      }

      const saved = [];
      for (const entry of picked) {
        if (!(entry instanceof File)) continue;
        if (!ALLOWED_TYPES.includes(entry.type)) {
          badRequest(`不支持的文件类型：${entry.type}`);
        }
        const sizeMb = entry.size / (1024 * 1024);
        if (sizeMb > MAX_SIZE_MB) {
          badRequest(`单个文件不能超过 ${MAX_SIZE_MB}MB`);
        }
        const buffer = Buffer.from(await entry.arrayBuffer());
        const base64 = buffer.toString("base64");
        const record = await createCourseFile({
          classId,
          folder: folder || undefined,
          title: title || entry.name,
          resourceType: "file",
          fileName: entry.name,
          mimeType: entry.type,
          size: entry.size,
          contentBase64: base64,
          uploadedBy: user.id
        });
        saved.push(record);
      }
      // Multipart upload path supports batch file uploads in one request.
      return { data: saved };
    }

    const body = await parseJson(request, createLinkBodySchema);
    const classId = body.classId?.trim();
    const title = body.title?.trim();
    if (!classId || !title) {
      badRequest("missing fields");
    }
    if (!accessible.includes(classId)) {
      notFound("class not found");
    }
    if (body.resourceType === "link" && !body.linkUrl?.trim()) {
      badRequest("missing link");
    }

    const record = await createCourseFile({
      classId,
      folder: body.folder,
      title,
      resourceType: body.resourceType === "link" ? "link" : "file",
      linkUrl: body.linkUrl,
      uploadedBy: user.id
    });
    return { data: record };
  }
});
