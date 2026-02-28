import { addAssignmentUpload, deleteAssignmentUpload, getAssignmentUploads } from "@/lib/assignment-uploads";
import { badRequest } from "@/lib/api/http";
import { requireStudentAssignment } from "@/lib/guard";
import { v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

export const dynamic = "force-dynamic";

const MAX_SIZE_MB = 3;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

const assignmentParamsSchema = v.object<{ id: string }>(
  {
    id: v.string({ minLength: 1 })
  },
  { allowUnknown: true }
);

export const GET = createLearningRoute({
  role: "student",
  params: assignmentParamsSchema,
  cache: "private-short",
  handler: async ({ params }) => {
    const { student, assignment } = await requireStudentAssignment(params.id);
    if (assignment.submissionType !== "upload" && assignment.submissionType !== "essay") {
      badRequest("该作业不支持上传");
    }

    const uploads = await getAssignmentUploads(assignment.id, student.id);
    return { data: uploads };
  }
});

export const POST = createLearningRoute({
  role: "student",
  params: assignmentParamsSchema,
  cache: "private-realtime",
  handler: async ({ request, params }) => {
    const { student, assignment } = await requireStudentAssignment(params.id);
    if (assignment.submissionType !== "upload" && assignment.submissionType !== "essay") {
      badRequest("该作业不支持上传");
    }

    const formData = await request.formData();
    const files = formData.getAll("files");
    const picked = files.length ? files : [formData.get("file")].filter(Boolean);
    const uploaded = await getAssignmentUploads(assignment.id, student.id);
    const maxUploads = assignment.maxUploads ?? 3;
    if (uploaded.length + picked.length > maxUploads) {
      badRequest(`最多上传 ${maxUploads} 份文件`);
    }

    const saved = [];
    for (const entry of picked) {
      if (!(entry instanceof File)) {
        continue;
      }
      if (!ALLOWED_TYPES.includes(entry.type)) {
        badRequest(`不支持的文件类型：${entry.type}`);
      }
      const sizeMb = entry.size / (1024 * 1024);
      if (sizeMb > MAX_SIZE_MB) {
        badRequest(`单个文件不能超过 ${MAX_SIZE_MB}MB`);
      }
      const buffer = Buffer.from(await entry.arrayBuffer());
      const base64 = buffer.toString("base64");
      const record = await addAssignmentUpload({
        assignmentId: assignment.id,
        studentId: student.id,
        fileName: entry.name,
        mimeType: entry.type,
        size: entry.size,
        contentBase64: base64
      });
      if (record) saved.push(record);
    }

    return { data: saved };
  }
});

export const DELETE = createLearningRoute({
  role: "student",
  params: assignmentParamsSchema,
  cache: "private-realtime",
  handler: async ({ request, params }) => {
    const { student, assignment } = await requireStudentAssignment(params.id);

    const { searchParams } = new URL(request.url);
    const uploadId = searchParams.get("uploadId");
    if (!uploadId) {
      badRequest("missing uploadId");
    }

    if (assignment.submissionType !== "upload" && assignment.submissionType !== "essay") {
      badRequest("该作业不支持上传");
    }

    const removed = await deleteAssignmentUpload(uploadId, student.id);
    return { removed };
  }
});
