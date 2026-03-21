"use client";

import {
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction
} from "react";
import { pushAppToast } from "@/components/AppToastHub";
import {
  isAuthError,
  requestJson
} from "@/lib/client-request";
import type { FavoriteItem } from "./types";
import {
  applyStudentFavoriteSave,
  buildStudentFavoriteSavePayload,
  copyTextToClipboard,
  getStudentFavoriteRemoveRequestMessage,
  getStudentFavoriteSaveRequestMessage,
  removeStudentFavorite
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type StudentFavoritesActionsOptions = {
  hasFavoritesSnapshotRef: MutableRefObject<boolean>;
  draftTags: string;
  draftNote: string;
  editingQuestionId: string;
  handleAuthRequired: () => void;
  closeEditor: () => void;
  setFavorites: Setter<FavoriteItem[]>;
  setAuthRequired: Setter<boolean>;
  setPageError: Setter<string | null>;
  setActionError: Setter<string | null>;
  setActionMessage: Setter<string | null>;
  setSavingQuestionId: Setter<string>;
  setRemovingQuestionId: Setter<string>;
  setLastLoadedAt: Setter<string | null>;
};

export function useStudentFavoritesActions({
  hasFavoritesSnapshotRef,
  draftTags,
  draftNote,
  editingQuestionId,
  handleAuthRequired,
  closeEditor,
  setFavorites,
  setAuthRequired,
  setPageError,
  setActionError,
  setActionMessage,
  setSavingQuestionId,
  setRemovingQuestionId,
  setLastLoadedAt
}: StudentFavoritesActionsOptions) {
  const handleSave = useCallback(async (item: FavoriteItem) => {
    setSavingQuestionId(item.questionId);
    setActionError(null);
    setActionMessage(null);

    try {
      const { tags, note } = buildStudentFavoriteSavePayload(draftTags, draftNote);
      await requestJson(`/api/favorites/${item.questionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags, note })
      });

      const updatedAt = new Date().toISOString();
      setFavorites((prev) => applyStudentFavoriteSave(prev, item.questionId, tags, note, updatedAt));
      hasFavoritesSnapshotRef.current = true;
      setAuthRequired(false);
      setPageError(null);
      setLastLoadedAt(updatedAt);
      setActionMessage(tags.length || note ? "收藏信息已更新，复习时更容易快速定位。" : "已清空标签和备注。");
      pushAppToast("收藏信息已保存");
      closeEditor();
    } catch (error) {
      if (isAuthError(error)) {
        handleAuthRequired();
        return;
      }
      const message = getStudentFavoriteSaveRequestMessage(error, "保存收藏信息失败");
      setActionError(message);
      pushAppToast(message, "error");
    } finally {
      setSavingQuestionId("");
    }
  }, [
    closeEditor,
    draftNote,
    draftTags,
    handleAuthRequired,
    hasFavoritesSnapshotRef,
    setActionError,
    setActionMessage,
    setAuthRequired,
    setFavorites,
    setLastLoadedAt,
    setPageError,
    setSavingQuestionId
  ]);

  const handleRemove = useCallback(async (item: FavoriteItem) => {
    setRemovingQuestionId(item.questionId);
    setActionError(null);
    setActionMessage(null);

    try {
      await requestJson(`/api/favorites/${item.questionId}`, { method: "DELETE" });
      setFavorites((prev) => removeStudentFavorite(prev, item.questionId));
      hasFavoritesSnapshotRef.current = true;
      setAuthRequired(false);
      setPageError(null);
      setLastLoadedAt(new Date().toISOString());
      if (editingQuestionId === item.questionId) {
        closeEditor();
      }
      setActionMessage("已从收藏夹移除这道题。");
      pushAppToast("已取消收藏");
    } catch (error) {
      if (isAuthError(error)) {
        handleAuthRequired();
        return;
      }
      const message = getStudentFavoriteRemoveRequestMessage(error, "取消收藏失败");
      setActionError(message);
      pushAppToast(message, "error");
    } finally {
      setRemovingQuestionId("");
    }
  }, [
    closeEditor,
    editingQuestionId,
    handleAuthRequired,
    hasFavoritesSnapshotRef,
    setActionError,
    setActionMessage,
    setAuthRequired,
    setFavorites,
    setLastLoadedAt,
    setPageError,
    setRemovingQuestionId
  ]);

  const handleCopyQuestion = useCallback(async (item: FavoriteItem) => {
    const stem = item.question?.stem?.trim() ?? "";
    if (!stem) {
      pushAppToast("当前题目内容为空", "error");
      return;
    }
    try {
      await copyTextToClipboard(stem);
      pushAppToast("已复制题目");
    } catch {
      pushAppToast("复制失败，请稍后重试", "error");
    }
  }, []);

  return {
    handleSave,
    handleRemove,
    handleCopyQuestion
  };
}
