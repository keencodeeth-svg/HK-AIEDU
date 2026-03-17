import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";
import type {
  AssignmentDetail,
  AssignmentLessonLink,
  AssignmentReviewPayload,
  AssignmentStageCopy,
  SubmitResult
} from "./types";

export async function readJsonSafe(response: Response): Promise<any> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

type BuildAssignmentStageCopyArgs = {
  data: AssignmentDetail;
  result: SubmitResult | null;
  review: AssignmentReviewPayload | null;
  alreadyCompleted: boolean;
  isUpload: boolean;
  isEssay: boolean;
  uploadsCount: number;
  maxUploads: number;
  hasUploads: boolean;
  hasText: boolean;
  answeredCount: number;
};

export function buildAssignmentStageCopy({
  data,
  result,
  review,
  alreadyCompleted,
  isUpload,
  isEssay,
  uploadsCount,
  maxUploads,
  hasUploads,
  hasText,
  answeredCount
}: BuildAssignmentStageCopyArgs): AssignmentStageCopy {
  if (result) {
    return {
      title: isUpload || isEssay ? "提交成功，等待老师批改" : "提交成功，先看结果再订正",
      description: review?.review || review?.rubrics?.length || review?.aiReview || (review?.questions?.length && !isUpload && !isEssay)
        ? "系统已自动定位到下方反馈区，你可以直接查看得分、解析和老师点评。"
        : "作业已经提交完成，老师批改后会在本页继续显示反馈。"
    };
  }

  if (alreadyCompleted) {
    return {
      title: review ? "已完成，可直接查看反馈" : "已提交，等待老师反馈",
      description: review
        ? "这份作业已经完成，下方保留了老师点评与 AI 复盘，不需要重复作答。"
        : "这份作业已经提交成功，当前不需要再次上传或作答。"
    };
  }

  if (isUpload) {
    return hasUploads
      ? {
          title: `已上传 ${uploadsCount}/${maxUploads} 份文件，可以提交`,
          description: "确认文件完整后直接提交即可；如果传错了，可以先删除再补传。"
        }
      : {
          title: "先上传作业文件",
          description: "这份作业需要先上传图片或 PDF，上传完成后才能提交。"
        };
  }

  if (isEssay) {
    return hasUploads || hasText
      ? {
          title: "内容已准备好，可以提交",
          description: hasUploads
            ? "你已经上传了作业图片，也可以继续补充作文正文或备注。"
            : "你已经填写了文字内容，如有手写稿可继续上传图片补充。"
        }
      : {
          title: "先输入作文内容或上传图片",
          description: "作文类作业支持纯文字提交，也支持补充图片；两者有其一即可提交。"
        };
  }

  if (answeredCount === 0) {
    return {
      title: "先完成题目作答",
      description: "建议先把整份作业做完，再统一提交查看得分与解析。"
    };
  }

  if (answeredCount < data.questions.length) {
    return {
      title: `已完成 ${answeredCount}/${data.questions.length} 题`,
      description: "还差几题没选答案，补齐后提交能一次看到完整结果和错因解析。"
    };
  }

  return {
    title: "答案已完成，可以提交",
    description: "提交后会立即生成成绩与解析，下方还会同步老师点评和 AI 复盘。"
  };
}

export function formatLessonLinkSchedule(lessonLink: AssignmentLessonLink) {
  const parts = [lessonLink.lessonDate];
  if (lessonLink.startTime && lessonLink.endTime) {
    parts.push(`${lessonLink.startTime}-${lessonLink.endTime}`);
  }
  if (lessonLink.slotLabel) {
    parts.push(lessonLink.slotLabel);
  }
  if (lessonLink.room) {
    parts.push(lessonLink.room);
  }
  return parts.join(" · ");
}

export function getStudentAssignmentDetailRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim();
  const lower = requestMessage.toLowerCase();

  if (status === 401 || status === 403) {
    return "学生登录状态已失效，请重新登录后继续查看作业。";
  }
  if (status === 404 && lower === "not found") {
    return "作业不存在，或你当前账号无权查看这份作业。";
  }
  if (lower === "answers must be an object" || /^answers\.[^.]+ must be a string$/.test(lower)) {
    return "答题内容格式无效，请刷新页面后重试。";
  }
  if (requestMessage === "请先上传作业文件") {
    return "请先上传至少 1 份作业文件后再提交。";
  }
  if (requestMessage === "请填写作文内容或上传作业图片") {
    return "请先填写作文内容，或至少上传 1 份作业图片后再提交。";
  }
  if (requestMessage === "该作业不支持上传") {
    return "当前作业不支持上传文件，请直接在页面内完成作答。";
  }
  if (/^最多上传 \d+ 份文件$/.test(requestMessage)) {
    return requestMessage;
  }
  if (/^不支持的文件类型：/.test(requestMessage)) {
    return "仅支持上传 PNG、JPG、WEBP 或 PDF 文件。";
  }
  if (/^单个文件不能超过 \d+MB$/.test(requestMessage)) {
    return "单个文件大小不能超过 3MB。";
  }
  if (lower === "missing uploadid") {
    return "未找到要删除的上传文件，请刷新列表后重试。";
  }

  return getRequestErrorMessage(error, fallback);
}

export function getStudentAssignmentReviewRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  if (status === 401 || status === 403) {
    return "学生登录状态已失效，请重新登录后继续查看老师反馈。";
  }

  return getStudentAssignmentDetailRequestMessage(error, fallback);
}

export function getStudentAssignmentUploadRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  if (status === 401 || status === 403) {
    return "学生登录状态已失效，请重新登录后继续上传作业。";
  }

  return getStudentAssignmentDetailRequestMessage(error, fallback);
}

export function isMissingStudentAssignmentDetailError(error: unknown) {
  return (getRequestStatus(error) ?? 0) === 404 && getRequestErrorMessage(error, "").trim().toLowerCase() === "not found";
}
