import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { AiQuestionForm, KnowledgePoint, QuestionForm, QuestionQuery } from "./types";
import { resolveAdminQuestionsFormSelections } from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type LoadQuestions = (options?: {
  query?: QuestionQuery;
  page?: number;
  pageSize?: number;
}) => Promise<void>;

type AdminQuestionsPageEffectsOptions = {
  queryRef: MutableRefObject<QuestionQuery>;
  pageRef: MutableRefObject<number>;
  pageSizeRef: MutableRefObject<number>;
  query: QuestionQuery;
  page: number;
  pageSize: number;
  form: QuestionForm;
  aiForm: AiQuestionForm;
  formKnowledgePoints: KnowledgePoint[];
  aiKnowledgePoints: KnowledgePoint[];
  chapterOptions: string[];
  setForm: Setter<QuestionForm>;
  setAiForm: Setter<AiQuestionForm>;
  loadKnowledgePoints: () => Promise<void>;
  loadQuestions: LoadQuestions;
};

export function useAdminQuestionsPageEffects({
  queryRef,
  pageRef,
  pageSizeRef,
  query,
  page,
  pageSize,
  form,
  aiForm,
  formKnowledgePoints,
  aiKnowledgePoints,
  chapterOptions,
  setForm,
  setAiForm,
  loadKnowledgePoints,
  loadQuestions
}: AdminQuestionsPageEffectsOptions) {
  useEffect(() => {
    queryRef.current = query;
  }, [query, queryRef]);

  useEffect(() => {
    pageRef.current = page;
  }, [page, pageRef]);

  useEffect(() => {
    pageSizeRef.current = pageSize;
  }, [pageSize, pageSizeRef]);

  useEffect(() => {
    void loadKnowledgePoints();
  }, [loadKnowledgePoints]);

  useEffect(() => {
    void loadQuestions({ query, page, pageSize });
  }, [loadQuestions, page, pageSize, query]);

  useEffect(() => {
    const { nextFormKnowledgePointId, nextAiKnowledgePointId, nextAiChapter } =
      resolveAdminQuestionsFormSelections({
        form,
        aiForm,
        formKnowledgePoints,
        aiKnowledgePoints,
        chapterOptions
      });

    if (nextFormKnowledgePointId !== form.knowledgePointId) {
      setForm((prev) => ({ ...prev, knowledgePointId: nextFormKnowledgePointId }));
    }

    if (
      nextAiKnowledgePointId !== aiForm.knowledgePointId ||
      nextAiChapter !== aiForm.chapter
    ) {
      setAiForm((prev) => ({
        ...prev,
        knowledgePointId: nextAiKnowledgePointId,
        chapter: nextAiChapter
      }));
    }
  }, [
    aiForm,
    aiKnowledgePoints,
    chapterOptions,
    form,
    formKnowledgePoints,
    setAiForm,
    setForm
  ]);
}
