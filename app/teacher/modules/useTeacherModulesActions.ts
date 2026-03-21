"use client";

import { useCallback, type Dispatch, type FormEventHandler, type MutableRefObject, type SetStateAction } from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type {
  ModuleItem,
  ModuleResourceFileLike,
  ModuleResourceType
} from "./types";
import {
  buildTeacherModulesResourcePayload,
  getTeacherModulesRequestMessage,
  getTeacherModulesResourceValidationMessage,
  isMissingTeacherModulesClassError,
  isMissingTeacherModulesModuleError,
  readFileAsBase64,
  resolveTeacherModulesSwapPair
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type LoadOptions = {
  clearExisting?: boolean;
  preserveOnError?: boolean;
};

type LoadModules = (nextClassId?: string, options?: LoadOptions) => Promise<void>;
type LoadResources = (nextModuleId?: string, options?: LoadOptions) => Promise<void>;

type TeacherModulesActionsOptions = {
  moduleTitle: string;
  moduleDesc: string;
  parentId: string;
  orderIndex: number;
  resourceType: ModuleResourceType;
  resourceTitle: string;
  resourceUrl: string;
  resourceFile: ModuleResourceFileLike | null;
  modules: ModuleItem[];
  moving: boolean;
  classIdRef: MutableRefObject<string>;
  moduleIdRef: MutableRefObject<string>;
  handleAuthRequired: () => void;
  resetResourceForm: () => void;
  loadModules: LoadModules;
  loadResources: LoadResources;
  removeMissingClass: (staleClassId: string) => void;
  removeMissingModule: (staleModuleId: string) => void;
  applyClassId: (nextClassId: string) => void;
  applyModuleId: (nextModuleId: string) => void;
  setModuleTitle: Setter<string>;
  setModuleDesc: Setter<string>;
  setParentId: Setter<string>;
  setOrderIndex: Setter<number>;
  setMessage: Setter<string | null>;
  setError: Setter<string | null>;
  setMoving: Setter<boolean>;
};

export function useTeacherModulesActions({
  moduleTitle,
  moduleDesc,
  parentId,
  orderIndex,
  resourceType,
  resourceTitle,
  resourceUrl,
  resourceFile,
  modules,
  moving,
  classIdRef,
  moduleIdRef,
  handleAuthRequired,
  resetResourceForm,
  loadModules,
  loadResources,
  removeMissingClass,
  removeMissingModule,
  applyClassId,
  applyModuleId,
  setModuleTitle,
  setModuleDesc,
  setParentId,
  setOrderIndex,
  setMessage,
  setError,
  setMoving
}: TeacherModulesActionsOptions) {
  const handleClassChange = useCallback((nextClassId: string) => {
    applyClassId(nextClassId);
    setMessage(null);
    setError(null);
  }, [applyClassId, setError, setMessage]);

  const handleModuleChange = useCallback((nextModuleId: string) => {
    applyModuleId(nextModuleId);
    setMessage(null);
    setError(null);
  }, [applyModuleId, setError, setMessage]);

  const handleCreateModule = useCallback<FormEventHandler<HTMLFormElement>>(async (event) => {
    event.preventDefault();
    setMessage(null);
    setError(null);
    const activeClassId = classIdRef.current;

    try {
      await requestJson("/api/teacher/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: activeClassId,
          title: moduleTitle,
          description: moduleDesc,
          parentId: parentId || undefined,
          orderIndex
        })
      });

      setMessage("模块创建成功");
      setModuleTitle("");
      setModuleDesc("");
      setParentId("");
      setOrderIndex(0);
      await loadModules(activeClassId, {
        preserveOnError: true
      });
    } catch (error) {
      if (isAuthError(error)) {
        handleAuthRequired();
        return;
      }
      if (isMissingTeacherModulesClassError(error)) {
        removeMissingClass(activeClassId);
      }
      setError(getTeacherModulesRequestMessage(error, "创建失败"));
    }
  }, [
    classIdRef,
    handleAuthRequired,
    loadModules,
    moduleDesc,
    moduleTitle,
    orderIndex,
    parentId,
    removeMissingClass,
    setError,
    setMessage,
    setModuleDesc,
    setModuleTitle,
    setOrderIndex,
    setParentId
  ]);

  const handleAddResource = useCallback<FormEventHandler<HTMLFormElement>>(async (event) => {
    event.preventDefault();
    setMessage(null);
    setError(null);

    const activeModuleId = moduleIdRef.current;
    const activeClassId = classIdRef.current;
    if (!activeModuleId) {
      return;
    }

    const validationMessage = getTeacherModulesResourceValidationMessage({
      title: resourceTitle,
      resourceType,
      resourceUrl,
      resourceFile
    });
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    try {
      const contentBase64 =
        resourceType === "file" && resourceFile
          ? await readFileAsBase64(resourceFile as File)
          : undefined;
      const payload = buildTeacherModulesResourcePayload({
        title: resourceTitle,
        resourceType,
        resourceUrl,
        resourceFile,
        contentBase64
      });

      await requestJson(`/api/teacher/modules/${activeModuleId}/resources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      setMessage("资源已添加");
      resetResourceForm();
      await loadResources(activeModuleId, {
        preserveOnError: true
      });
    } catch (error) {
      if (isAuthError(error)) {
        handleAuthRequired();
        return;
      }
      if (isMissingTeacherModulesClassError(error)) {
        removeMissingClass(activeClassId);
      } else if (isMissingTeacherModulesModuleError(error)) {
        removeMissingModule(activeModuleId);
        await loadModules(activeClassId, {
          clearExisting: true
        });
      }
      setError(getTeacherModulesRequestMessage(error, "上传失败"));
    }
  }, [
    classIdRef,
    handleAuthRequired,
    loadModules,
    loadResources,
    moduleIdRef,
    removeMissingClass,
    removeMissingModule,
    resetResourceForm,
    resourceFile,
    resourceTitle,
    resourceType,
    resourceUrl,
    setError,
    setMessage
  ]);

  const handleDeleteResource = useCallback(async (resourceId: string) => {
    const activeModuleId = moduleIdRef.current;
    const activeClassId = classIdRef.current;
    if (!activeModuleId) {
      return;
    }

    setMessage(null);
    setError(null);
    try {
      await requestJson(`/api/teacher/modules/${activeModuleId}/resources`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId })
      });
      setMessage("资源已删除");
      await loadResources(activeModuleId, {
        preserveOnError: true
      });
    } catch (error) {
      if (isAuthError(error)) {
        handleAuthRequired();
        return;
      }
      if (isMissingTeacherModulesClassError(error)) {
        removeMissingClass(activeClassId);
      } else if (isMissingTeacherModulesModuleError(error)) {
        removeMissingModule(activeModuleId);
        await loadModules(activeClassId, {
          clearExisting: true
        });
      }
      setError(getTeacherModulesRequestMessage(error, "删除失败"));
    }
  }, [
    classIdRef,
    handleAuthRequired,
    loadModules,
    loadResources,
    moduleIdRef,
    removeMissingClass,
    removeMissingModule,
    setError,
    setMessage
  ]);

  const swapOrder = useCallback(async (index: number, direction: "up" | "down") => {
    if (moving) {
      return;
    }

    const pair = resolveTeacherModulesSwapPair(modules, index, direction);
    if (!pair) {
      return;
    }

    const activeClassId = classIdRef.current;
    setMoving(true);
    setMessage(null);
    setError(null);

    try {
      await requestJson(`/api/teacher/modules/${pair.current.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIndex: pair.target.orderIndex })
      });
      await requestJson(`/api/teacher/modules/${pair.target.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIndex: pair.current.orderIndex })
      });

      setMessage("模块顺序已更新");
      await loadModules(activeClassId, {
        preserveOnError: true
      });
    } catch (error) {
      if (isAuthError(error)) {
        handleAuthRequired();
        return;
      }
      if (isMissingTeacherModulesClassError(error)) {
        removeMissingClass(activeClassId);
      } else if (isMissingTeacherModulesModuleError(error)) {
        await loadModules(activeClassId, {
          clearExisting: true
        });
      } else {
        await loadModules(activeClassId, {
          preserveOnError: true
        });
      }
      setError(getTeacherModulesRequestMessage(error, "调整排序失败"));
    } finally {
      setMoving(false);
    }
  }, [
    classIdRef,
    handleAuthRequired,
    loadModules,
    modules,
    moving,
    removeMissingClass,
    setError,
    setMessage,
    setMoving
  ]);

  return {
    handleClassChange,
    handleModuleChange,
    handleCreateModule,
    handleAddResource,
    handleDeleteResource,
    swapOrder
  };
}
