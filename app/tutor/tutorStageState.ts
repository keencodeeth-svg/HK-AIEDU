import type { TutorFlowStep } from "./_components/TutorStageOverview";
import type { TutorLaunchIntent } from "@/lib/tutor-launch";
import type { TutorAnswer } from "./types";
import type {
  ActiveAction,
  ResultOrigin,
  TutorLearningMode
} from "./utils";

type TutorStageCopy = {
  title: string;
  description: string;
};

type BuildTutorStageStateParams = {
  loading: boolean;
  activeAction: ActiveAction;
  answer: TutorAnswer | null;
  shareSuccess: { threadId: string; targetName: string; reused: boolean } | null;
  studyResult: boolean;
  resultOrigin: ResultOrigin;
  editableQuestion: string;
  selectedImagesCount: number;
  selectedCropCount: number;
  question: string;
  learningMode: TutorLearningMode;
  canLoadVariants: boolean;
  launchIntent: TutorLaunchIntent | null;
};

export function buildTutorStageState({
  loading,
  activeAction,
  answer,
  shareSuccess,
  studyResult,
  resultOrigin,
  editableQuestion,
  selectedImagesCount,
  selectedCropCount,
  question,
  learningMode,
  canLoadVariants,
  launchIntent
}: BuildTutorStageStateParams): {
  stageCopy: TutorStageCopy;
  tutorFlowSteps: TutorFlowStep[];
} {
  const stageCopy = (() => {
    if (loading && activeAction === "study_image") {
      return {
        title: "正在识题并进入学习模式",
        description: "系统会先识别题目，再生成提示、追问和知识检查，不会直接摊开答案。"
      };
    }

    if (loading && activeAction === "study") {
      return {
        title: studyResult ? "正在更新学习模式" : "正在启动学习模式",
        description: studyResult
          ? "系统正在根据你的思路校准下一轮追问和提示。"
          : "系统会先生成提示与知识检查，再决定何时揭晓完整讲解。"
      };
    }

    if (loading && activeAction === "image") {
      return {
        title: "正在识题与生成讲解",
        description: "系统正在处理你上传的题图，稍等片刻就会自动滚动到下方结果区。"
      };
    }

    if (loading && activeAction === "text") {
      return {
        title: "正在分析题目",
        description: "系统正在根据你的文字问题生成答案与讲解，请稍等。"
      };
    }

    if (loading && activeAction === "refine") {
      return {
        title: "正在按编辑后的题目重新求解",
        description: "新结果生成后会自动滚动到下方讲解区，方便直接对比。"
      };
    }

    if (answer) {
      if (shareSuccess) {
        return {
          title: `结果已发送给 ${shareSuccess.targetName}`,
          description: "你可以继续留在当前页修改题目、再次求解，或前往站内信继续沟通。"
        };
      }

      if (studyResult) {
        if (answer.answer.trim()) {
          return {
            title: "学习模式已揭晓完整讲解",
            description: "现在先对照答案复盘，再试着不用看讲解复述一遍关键转折。"
          };
        }

        if (answer.feedback) {
          return {
            title: "已根据你的思路做校准",
            description: "继续完成下方知识检查；如果还是卡住，再按需揭晓完整讲解。"
          };
        }

        return {
          title: resultOrigin === "image" ? "题图已进入学习模式" : "学习模式已开始，先说思路再看答案",
          description: answer.nextPrompt ?? "先回答下方追问，系统会根据你的思路继续推进。"
        };
      }

      if (resultOrigin === "image") {
        return {
          title: "识题完成，先核对题干再决定下一步",
          description: editableQuestion.trim()
            ? "下方已展示识别后的题目和讲解；如果识别有误，直接改题干再重新求解会更稳。"
            : "下方已生成讲解，建议先核对识别结果，再决定是否重算或分享给老师 / 家长。"
        };
      }

      if (resultOrigin === "refine") {
        return {
          title: "已按编辑后的题目重算",
          description: "现在可以直接对比新旧理解差异，再决定是否复制、分享或继续追问。"
        };
      }

      return {
        title: "文字求解完成",
        description: "下方已生成答案与讲解；如果题目变化了，可以继续改题后重算。"
      };
    }

    if (selectedImagesCount > 0) {
      return {
        title:
          learningMode === "study"
            ? question.trim()
              ? "图片已准备好，可以进入学习模式"
              : "题图已准备好，建议补充一句说明后进入学习模式"
            : question.trim()
              ? "图片已准备好，可以开始识题"
              : "题图已准备好，建议补充一句说明",
        description: question.trim()
          ? `当前已选择 ${selectedImagesCount} 张题图${selectedCropCount ? `，其中 ${selectedCropCount} 张已框选题目区域` : ""}，${
              learningMode === "study" ? "可直接开始学习模式。" : "可直接开始识题。"
            }`
          : `当前已选择 ${selectedImagesCount} 张题图${selectedCropCount ? `，其中 ${selectedCropCount} 张已框选题目区域` : ""}；${
              learningMode === "study" ? "补充一句文字说明，通常更利于进入学习模式。" : "补充一句文字说明，通常能提升准确性。"
            }`
      };
    }

    if (question.trim()) {
      return {
        title: learningMode === "study" ? "文字问题已准备好，可以开始学习模式" : "文字问题已准备好，可以直接求解",
        description:
          learningMode === "study"
            ? "系统会先提示和追问，再让你决定是否查看完整讲解；如果是图形题，也可以补上传图片。"
            : "如果题干已经足够完整，直接文字提问最快；如果是图形题，也可以补上传图片。"
      };
    }

    if (launchIntent === "image") {
      return {
        title: "先上传题目图片",
        description: "支持一题多图，适合长题干、图形题和题干选项分开拍摄的场景。"
      };
    }

    return {
      title: "先输入题目或上传图片",
      description: "文字提问适合直接求解，拍照识题更适合图形题、手写题和长题干。"
    };
  })();

  const tutorFlowSteps: TutorFlowStep[] = [
    {
      id: "capture",
      step: "01",
      title: selectedImagesCount
        ? `整理题目（已选 ${selectedImagesCount} 张图）`
        : question.trim()
          ? "整理题目（文字已就绪）"
          : "整理题目",
      description: selectedImagesCount
        ? selectedCropCount
          ? `其中 ${selectedCropCount} 张已经框选题目区域，识题会更稳。`
          : "题图已经准备好，必要时再补一句文字说明。"
        : question.trim()
          ? "题目已经足够开始求解；如果是图形题，可以再补上传图片。"
          : "先输入题目或上传图片，别一开始就纠结答案模式。",
      state: answer ? "done" : selectedImagesCount || question.trim() ? "active" : "idle"
    },
    {
      id: "solve",
      step: "02",
      title: learningMode === "study" ? "AI 先带你思考" : "AI 生成讲解",
      description:
        learningMode === "study"
          ? answer
            ? answer.answer.trim()
              ? "提示、追问和完整讲解都已经给到，可以开始复盘。"
              : "当前还在学习模式里，先完成提示与追问，再决定是否揭晓答案。"
            : "学习模式会先提示和追问，不会一上来直接把答案摊开。"
          : answer
            ? "当前讲解已经生成，可以直接核对、重算或继续追问。"
            : "直接讲解适合快速核对；如果想边学边做，切换到学习模式。",
      state: loading ? "active" : answer ? "done" : "idle"
    },
    {
      id: "extend",
      step: "03",
      title: canLoadVariants ? "巩固、分享、继续追问" : "结果出来后继续推进",
      description: canLoadVariants
        ? "结果区支持做变式训练、分享给老师 / 家长、复制答案或回到历史继续追问。"
        : "结果生成后，优先做变式巩固或把关键结论分享给需要协同的人。",
      state: answer ? "active" : "idle"
    }
  ];

  return {
    stageCopy,
    tutorFlowSteps
  };
}
