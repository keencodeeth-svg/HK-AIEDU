import { getCurrentUser } from "@/lib/auth";
import { getClassesByStudent, getClassesByTeacher } from "@/lib/classes";
import {
  listLearningLibraryItems,
  type LearningLibraryItem
} from "@/lib/learning-library";
import { unauthorized, withApi } from "@/lib/api/http";
import { parseSearchParams, v } from "@/lib/api/validation";

export const dynamic = "force-dynamic";

function useLightListMode() {
  if (process.env.LIBRARY_LIGHT_LIST === "false") return false;
  if (process.env.LIBRARY_LIGHT_LIST === "true") return true;
  return true;
}

function toLibraryListItem(item: LearningLibraryItem, lightList: boolean) {
  if (!lightList) return item;
  const { contentBase64, textContent, ...rest } = item;
  return rest;
}

const querySchema = v.object<{
  subject?: string;
  grade?: string;
  contentType?: string;
}>(
  {
    subject: v.optional(v.string({ minLength: 1 })),
    grade: v.optional(v.string({ minLength: 1 })),
    contentType: v.optional(v.string({ minLength: 1 }))
  },
  { allowUnknown: true }
);

export const GET = withApi(async (request) => {
  const lightList = useLightListMode();
  const user = await getCurrentUser();
  if (!user) {
    unauthorized();
  }

  const query = parseSearchParams(request, querySchema);
  const contentTypeInput = query.contentType?.trim();
  const contentType =
    contentTypeInput === "textbook" ||
    contentTypeInput === "courseware" ||
    contentTypeInput === "lesson_plan"
      ? contentTypeInput
      : undefined;
  const all = await listLearningLibraryItems({
    subject: query.subject?.trim() || undefined,
    grade: query.grade?.trim() || undefined,
    contentType
  });

  if (user.role === "admin") {
    return { data: all.map((item) => toLibraryListItem(item, lightList)) };
  }

  let classIds: string[] = [];
  if (user.role === "teacher") {
    classIds = (await getClassesByTeacher(user.id)).map((item) => item.id);
  } else if (user.role === "student") {
    classIds = (await getClassesByStudent(user.id)).map((item) => item.id);
  } else if (user.role === "parent" && user.studentId) {
    classIds = (await getClassesByStudent(user.studentId)).map((item) => item.id);
  }
  const classIdSet = new Set(classIds);

  const data = all.filter((item) => {
    if (item.status !== "published" && item.ownerId !== user.id) {
      return false;
    }
    if (item.accessScope === "global") {
      return true;
    }
    if (!item.classId) {
      return false;
    }
    if (user.role === "teacher" && item.ownerId === user.id) {
      return true;
    }
    return classIdSet.has(item.classId);
  });

  return { data: data.map((item) => toLibraryListItem(item, lightList)) };
});
