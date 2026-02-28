import { getClassesByTeacher } from "@/lib/classes";
import { createModule, getModulesByClass } from "@/lib/modules";
import { createLearningRoute } from "@/lib/api/domains";
import { requireRoleOrThrow, requireTeacherClass } from "@/lib/guard";
import { parseJson, parseSearchParams, v } from "@/lib/api/validation";

const modulesQuerySchema = v.object<{ classId?: string }>(
  {
    classId: v.optional(v.string({ minLength: 1 }))
  },
  { allowUnknown: true }
);

const createModuleBodySchema = v.object<{
  classId: string;
  title: string;
  description?: string;
  parentId?: string;
  orderIndex?: number;
}>(
  {
    classId: v.string({ minLength: 1 }),
    title: v.string({ minLength: 1 }),
    description: v.optional(v.string({ allowEmpty: true, trim: false })),
    parentId: v.optional(v.string({ minLength: 1 })),
    orderIndex: v.optional(v.number({ coerce: true, integer: true, min: 0 }))
  },
  { allowUnknown: false }
);

export const GET = createLearningRoute({
  cache: "private-short",
  handler: async ({ request }) => {
    const user = await requireRoleOrThrow("teacher");
    const query = parseSearchParams(request, modulesQuerySchema);
    const classId = query.classId ?? "";
    if (!classId) {
      const classes = await getClassesByTeacher(user.id);
      return { data: [], classes };
    }
    await requireTeacherClass(classId);
    const modules = await getModulesByClass(classId);
    return { data: modules };
  }
});

export const POST = createLearningRoute({
  cache: "private-realtime",
  handler: async ({ request }) => {
    await requireRoleOrThrow("teacher");
    const body = await parseJson(request, createModuleBodySchema);
    await requireTeacherClass(body.classId);
    const created = await createModule({
      classId: body.classId,
      title: body.title,
      description: body.description,
      parentId: body.parentId,
      orderIndex: body.orderIndex
    });
    return { data: created };
  }
});
