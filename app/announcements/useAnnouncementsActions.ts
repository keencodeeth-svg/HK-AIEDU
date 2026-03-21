"use client";

import {
  useCallback,
  type Dispatch,
  type FormEvent,
  type SetStateAction
} from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type {
  AnnouncementLoadStatus,
  AnnouncementSubmitResponse
} from "./types";
import {
  buildAnnouncementSubmitPayload,
  getAnnouncementSubmitRequestMessage,
  getAnnouncementSubmitSuccessMessage,
  isMissingAnnouncementClassError
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type AnnouncementsActionsOptions = {
  classId: string;
  title: string;
  content: string;
  clearSubmitNotice: () => void;
  handleAuthRequired: () => void;
  loadAnnouncements: () => Promise<AnnouncementLoadStatus>;
  loadTeacherClasses: () => Promise<AnnouncementLoadStatus>;
  setTitle: Setter<string>;
  setContent: Setter<string>;
  setSubmitting: Setter<boolean>;
  setMessage: Setter<string | null>;
  setSubmitError: Setter<string | null>;
  setAuthRequired: Setter<boolean>;
};

export function useAnnouncementsActions({
  classId,
  title,
  content,
  clearSubmitNotice,
  handleAuthRequired,
  loadAnnouncements,
  loadTeacherClasses,
  setTitle,
  setContent,
  setSubmitting,
  setMessage,
  setSubmitError,
  setAuthRequired
}: AnnouncementsActionsOptions) {
  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    clearSubmitNotice();

    try {
      await requestJson<AnnouncementSubmitResponse>("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildAnnouncementSubmitPayload(classId, title, content))
      });
      setTitle("");
      setContent("");

      const loadStatus = await loadAnnouncements();
      if (loadStatus === "auth") {
        return;
      }
      setMessage(getAnnouncementSubmitSuccessMessage(loadStatus));
    } catch (error) {
      if (isAuthError(error)) {
        handleAuthRequired();
      } else {
        setAuthRequired(false);
        if (isMissingAnnouncementClassError(error)) {
          const classStatus = await loadTeacherClasses();
          if (classStatus === "auth") {
            return;
          }
        }
        setSubmitError(getAnnouncementSubmitRequestMessage(error, "发布失败"));
      }
    } finally {
      setSubmitting(false);
    }
  }, [
    classId,
    clearSubmitNotice,
    content,
    handleAuthRequired,
    loadAnnouncements,
    loadTeacherClasses,
    setAuthRequired,
    setContent,
    setMessage,
    setSubmitError,
    setSubmitting,
    setTitle,
    title
  ]);

  return {
    handleSubmit
  };
}
