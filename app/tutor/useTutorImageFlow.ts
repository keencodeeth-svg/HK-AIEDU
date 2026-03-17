"use client";

import type { ChangeEvent, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type { TutorLaunchIntent } from "@/lib/tutor-launch";
import { requestJson } from "@/lib/client-request";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_COUNT,
  MAX_IMAGE_SIZE_MB
} from "./config";
import type {
  TutorAnswerMode,
  TutorAskResponse
} from "./types";
import {
  type ActiveAction,
  type CropSelection,
  type DragState,
  type PreviewItem,
  buildSelection,
  cropImageFile,
  getPointerPercent,
  hasCrop,
  readImageFromFile
} from "./utils";

type UseTutorImageFlowParams = {
  activeAction: ActiveAction;
  question: string;
  subject: string;
  grade: string;
  onLaunchIntentChange: (intent: TutorLaunchIntent | null) => void;
  onActionMessageChange: (message: string | null) => void;
  onError: (message: string | null) => void;
};

export function useTutorImageFlow({
  activeAction,
  question,
  subject,
  grade,
  onLaunchIntentChange,
  onActionMessageChange,
  onError
}: UseTutorImageFlowParams) {
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [cropSelections, setCropSelections] = useState<Array<CropSelection | null>>([]);
  const [dragState, setDragState] = useState<DragState>(null);
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);

  const selectedCropCount = useMemo(() => cropSelections.filter((selection) => hasCrop(selection)).length, [cropSelections]);

  useEffect(() => {
    let disposed = false;
    let createdUrls: string[] = [];

    async function buildPreviewItems() {
      if (!selectedImages.length) {
        setPreviewItems([]);
        return;
      }

      const nextItems = await Promise.all(
        selectedImages.map(async (file) => {
          const image = await readImageFromFile(file);
          const url = URL.createObjectURL(file);
          createdUrls.push(url);
          return {
            url,
            width: Math.max(1, image.naturalWidth || 1200),
            height: Math.max(1, image.naturalHeight || 900)
          };
        })
      );

      if (disposed) {
        createdUrls.forEach((url) => URL.revokeObjectURL(url));
        return;
      }

      setPreviewItems(nextItems);
    }

    void buildPreviewItems();

    return () => {
      disposed = true;
      createdUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [selectedImages]);

  function updateCropSelection(index: number, selection: CropSelection | null) {
    setCropSelections((prev) => {
      const next = [...prev];
      next[index] = selection;
      return next;
    });
  }

  function handleCropPointerDown(index: number, event: ReactPointerEvent<HTMLDivElement>) {
    if (activeAction) {
      return;
    }

    const point = getPointerPercent(event);
    updateCropSelection(index, { x: point.x, y: point.y, width: 0, height: 0 });
    setDragState({ index, startX: point.x, startY: point.y });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleCropPointerMove(index: number, event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragState || dragState.index !== index) {
      return;
    }

    const point = getPointerPercent(event);
    updateCropSelection(index, buildSelection(dragState.startX, dragState.startY, point.x, point.y));
  }

  function finishCropPointer(index: number, event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragState || dragState.index !== index) {
      return;
    }

    const point = getPointerPercent(event);
    const nextSelection = buildSelection(dragState.startX, dragState.startY, point.x, point.y);
    updateCropSelection(index, hasCrop(nextSelection) ? nextSelection : null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragState(null);
  }

  function handleImageSelect(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) {
      return;
    }

    const invalidType = files.find((file) => !ALLOWED_IMAGE_TYPES.includes(file.type));
    if (invalidType) {
      onError("请上传 PNG、JPG 或 WebP 图片");
      return;
    }

    const oversize = files.find((file) => file.size / (1024 * 1024) > MAX_IMAGE_SIZE_MB);
    if (oversize) {
      onError(`单张图片不能超过 ${MAX_IMAGE_SIZE_MB}MB`);
      return;
    }

    const slotsLeft = Math.max(0, MAX_IMAGE_COUNT - selectedImages.length);
    const acceptedFiles = files.slice(0, slotsLeft);
    if (!acceptedFiles.length) {
      onError(`最多上传 ${MAX_IMAGE_COUNT} 张图片`);
      return;
    }

    onLaunchIntentChange("image");
    onActionMessageChange(`已添加 ${acceptedFiles.length} 张题图，可直接开始识题${question.trim() ? "，当前文字会作为补充说明。" : "。"}`);
    setSelectedImages((prev) => [...prev, ...acceptedFiles]);
    setCropSelections((prev) => [...prev, ...acceptedFiles.map(() => null)]);

    if (files.length > slotsLeft) {
      onError(`最多上传 ${MAX_IMAGE_COUNT} 张图片，已为你保留前 ${MAX_IMAGE_COUNT} 张。`);
      return;
    }

    onError(null);
  }

  function clearCropSelection(index: number) {
    updateCropSelection(index, null);
  }

  function removeSelectedImage(index: number) {
    setSelectedImages((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
    setCropSelections((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
    setDragState((prev) => {
      if (!prev) {
        return prev;
      }
      if (prev.index === index) {
        return null;
      }
      if (prev.index > index) {
        return {
          ...prev,
          index: prev.index - 1
        };
      }
      return prev;
    });
    onError(null);
  }

  function clearSelectedImages() {
    setSelectedImages([]);
    setCropSelections([]);
    setDragState(null);
    onError(null);
  }

  async function requestImageAssist(answerMode: TutorAnswerMode) {
    const processedImages = await Promise.all(
      selectedImages.map((file, index) => cropImageFile(file, cropSelections[index]))
    );

    const formData = new FormData();
    formData.set("subject", subject);
    formData.set("grade", grade);
    formData.set("answerMode", answerMode);
    if (question.trim()) {
      formData.set("question", question.trim());
    }
    processedImages.forEach((file) => {
      formData.append("images", file);
    });

    const payload = await requestJson<TutorAskResponse>("/api/ai/solve-from-image", {
      method: "POST",
      body: formData
    });

    return {
      data: (payload.data ?? payload) as TutorAskResponse,
      processedImages
    };
  }

  return {
    selectedImages,
    cropSelections,
    previewItems,
    selectedCropCount,
    clearCropSelection,
    removeSelectedImage,
    clearSelectedImages,
    handleImageSelect,
    handleCropPointerDown,
    handleCropPointerMove,
    finishCropPointer,
    requestImageAssist
  };
}
