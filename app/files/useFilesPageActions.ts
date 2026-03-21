"use client";

import {
  useCallback,
  type Dispatch,
  type FormEvent,
  type MutableRefObject,
  type SetStateAction
} from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type {
  FileMutationResponse,
  FilesLoadResult
} from "./types";
import {
  getFilesSubmitRequestMessage,
  isMissingFilesClassError
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;
type FilesLoad = (selectedClassId: string, options?: {
  clearBeforeLoad?: boolean;
  clearError?: boolean;
  preserveSnapshot?: boolean;
}) => Promise<FilesLoadResult>;

type FilesPageActionsOptions = {
  classId: string;
  folder: string;
  title: string;
  linkUrl: string;
  resourceType: "file" | "link";
  fileInputRef: MutableRefObject<HTMLInputElement | null>;
  loadBootstrap: () => Promise<FilesLoadResult>;
  loadFiles: FilesLoad;
  clearFilesState: () => void;
  handleAuthRequired: () => void;
  setSubmitting: Setter<boolean>;
  setMessage: Setter<string | null>;
  setError: Setter<string | null>;
  setFolder: Setter<string>;
  setTitle: Setter<string>;
  setLinkUrl: Setter<string>;
};

function getFilesRefreshFeedback(resourceType: "file" | "link") {
  return resourceType === "link"
    ? "链接已添加，但资料列表刷新失败，请稍后重试。"
    : "文件已上传，但资料列表刷新失败，请稍后重试。";
}

export function useFilesPageActions({
  classId,
  folder,
  title,
  linkUrl,
  resourceType,
  fileInputRef,
  loadBootstrap,
  loadFiles,
  clearFilesState,
  handleAuthRequired,
  setSubmitting,
  setMessage,
  setError,
  setFolder,
  setTitle,
  setLinkUrl
}: FilesPageActionsOptions) {
  const handleUpload = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!classId) {
      setError("请先选择班级后再上传资料。");
      return;
    }

    const uploadMode = resourceType;
    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      if (uploadMode === "link") {
        await requestJson<FileMutationResponse>("/api/files", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ classId, folder, title, resourceType: "link", linkUrl })
        });
        setMessage("链接已添加");
        setTitle("");
        setLinkUrl("");
        setFolder("");
      } else {
        const formData = new FormData();
        formData.append("classId", classId);
        if (folder) {
          formData.append("folder", folder);
        }
        if (title) {
          formData.append("title", title);
        }

        const input = fileInputRef.current;
        if (!input?.files?.length) {
          setError("请选择文件");
          return;
        }
        Array.from(input.files).forEach((file) => formData.append("files", file));

        await requestJson<FileMutationResponse>("/api/files", { method: "POST", body: formData });
        setMessage("文件已上传");
        setTitle("");
        setFolder("");
        input.value = "";
      }

      const refreshResult = await loadFiles(classId, {
        clearError: false,
        preserveSnapshot: true
      });
      if (refreshResult.status === "error") {
        setMessage(getFilesRefreshFeedback(uploadMode));
      }
    } catch (nextError) {
      if (isAuthError(nextError)) {
        handleAuthRequired();
      } else {
        setError(
          getFilesSubmitRequestMessage(
            nextError,
            uploadMode === "link" ? "保存链接失败" : "上传失败",
            uploadMode
          )
        );
        if (isMissingFilesClassError(nextError)) {
          clearFilesState();
          await loadBootstrap();
        }
      }
    } finally {
      setSubmitting(false);
    }
  }, [
    classId,
    clearFilesState,
    fileInputRef,
    folder,
    handleAuthRequired,
    linkUrl,
    loadBootstrap,
    loadFiles,
    resourceType,
    setError,
    setFolder,
    setLinkUrl,
    setMessage,
    setSubmitting,
    setTitle,
    title
  ]);

  return {
    handleUpload
  };
}
