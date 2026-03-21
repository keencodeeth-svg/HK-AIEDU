"use client";

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type { ClassItem, ModuleItem, ModuleResourceItem } from "./types";
import {
  getTeacherModulesRequestMessage,
  isMissingTeacherModulesClassError,
  isMissingTeacherModulesModuleError,
  resolveTeacherModulesClassId,
  resolveTeacherModulesModuleId
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type LoadOptions = {
  clearExisting?: boolean;
  preserveOnError?: boolean;
};

type TeacherClassesResponse = {
  data?: ClassItem[];
};

type TeacherModulesResponse = {
  data?: ModuleItem[];
};

type TeacherModuleResourcesResponse = {
  data?: ModuleResourceItem[];
};

type TeacherModulesLoadersOptions = {
  pageReady: boolean;
  classIdRef: MutableRefObject<string>;
  moduleIdRef: MutableRefObject<string>;
  modulesRef: MutableRefObject<ModuleItem[]>;
  resourcesRef: MutableRefObject<ModuleResourceItem[]>;
  classRequestIdRef: MutableRefObject<number>;
  moduleRequestIdRef: MutableRefObject<number>;
  resourceRequestIdRef: MutableRefObject<number>;
  lastSuccessfulModulesClassIdRef: MutableRefObject<string>;
  lastSuccessfulResourcesModuleIdRef: MutableRefObject<string>;
  syncClasses: (nextClasses: ClassItem[]) => void;
  syncModules: (nextModules: ModuleItem[]) => void;
  syncResources: (nextResources: ModuleResourceItem[]) => void;
  resetModuleSelection: (nextModuleId?: string) => void;
  clearResourcesSnapshot: () => void;
  clearModulesSnapshot: () => void;
  resetClassSelection: (nextClassId?: string) => void;
  handleAuthRequired: () => void;
  removeMissingClass: (staleClassId: string) => void;
  removeMissingModule: (staleModuleId: string) => void;
  setAuthRequired: Setter<boolean>;
  setLoading: Setter<boolean>;
  setPageReady: Setter<boolean>;
  setPageError: Setter<string | null>;
  setClassesNotice: Setter<string | null>;
  setModulesNotice: Setter<string | null>;
  setResourcesNotice: Setter<string | null>;
  setLastLoadedAt: Setter<string | null>;
};

export function useTeacherModulesLoaders({
  pageReady,
  classIdRef,
  moduleIdRef,
  modulesRef,
  resourcesRef,
  classRequestIdRef,
  moduleRequestIdRef,
  resourceRequestIdRef,
  lastSuccessfulModulesClassIdRef,
  lastSuccessfulResourcesModuleIdRef,
  syncClasses,
  syncModules,
  syncResources,
  resetModuleSelection,
  clearResourcesSnapshot,
  clearModulesSnapshot,
  resetClassSelection,
  handleAuthRequired,
  removeMissingClass,
  removeMissingModule,
  setAuthRequired,
  setLoading,
  setPageReady,
  setPageError,
  setClassesNotice,
  setModulesNotice,
  setResourcesNotice,
  setLastLoadedAt
}: TeacherModulesLoadersOptions) {
  const loadResources = useCallback(async (
    nextModuleId?: string,
    options: LoadOptions = {}
  ) => {
    const target = nextModuleId ?? moduleIdRef.current;
    const requestId = resourceRequestIdRef.current + 1;
    resourceRequestIdRef.current = requestId;

    if (!target) {
      resetModuleSelection("");
      return;
    }

    if (options.clearExisting) {
      syncResources([]);
    }

    try {
      const payload = await requestJson<TeacherModuleResourcesResponse>(
        `/api/teacher/modules/${target}/resources`
      );
      if (requestId !== resourceRequestIdRef.current) {
        return;
      }

      syncResources(payload.data ?? []);
      setResourcesNotice(null);
      lastSuccessfulResourcesModuleIdRef.current = target;
      setLastLoadedAt(new Date().toISOString());
    } catch (error) {
      if (requestId !== resourceRequestIdRef.current) {
        return;
      }
      if (isAuthError(error)) {
        handleAuthRequired();
        return;
      }

      const nextMessage = getTeacherModulesRequestMessage(error, "模块资源加载失败");
      const moduleMissing = isMissingTeacherModulesModuleError(error);
      const preserveOnError =
        !moduleMissing &&
        options.preserveOnError === true &&
        lastSuccessfulResourcesModuleIdRef.current === target &&
        resourcesRef.current.length > 0;

      if (moduleMissing) {
        removeMissingModule(target);
      } else if (!preserveOnError) {
        clearResourcesSnapshot();
      }

      setResourcesNotice(
        preserveOnError
          ? `模块资源刷新失败，已保留最近一次结果：${nextMessage}`
          : nextMessage
      );
    }
  }, [
    clearResourcesSnapshot,
    handleAuthRequired,
    lastSuccessfulResourcesModuleIdRef,
    moduleIdRef,
    removeMissingModule,
    resetModuleSelection,
    resourceRequestIdRef,
    resourcesRef,
    setLastLoadedAt,
    setResourcesNotice,
    syncResources
  ]);

  const loadModules = useCallback(async (
    nextClassId?: string,
    options: LoadOptions = {}
  ) => {
    const target = nextClassId ?? classIdRef.current;
    const requestId = moduleRequestIdRef.current + 1;
    moduleRequestIdRef.current = requestId;

    if (!target) {
      clearModulesSnapshot();
      return;
    }

    if (options.clearExisting) {
      clearModulesSnapshot();
    }

    try {
      const payload = await requestJson<TeacherModulesResponse>(
        `/api/teacher/modules?classId=${encodeURIComponent(target)}`
      );
      if (requestId !== moduleRequestIdRef.current) {
        return;
      }

      const list = payload.data ?? [];
      syncModules(list);
      setModulesNotice(null);
      lastSuccessfulModulesClassIdRef.current = target;
      setLastLoadedAt(new Date().toISOString());

      const currentModuleId = moduleIdRef.current;
      const nextSelectedModuleId = resolveTeacherModulesModuleId(currentModuleId, list);

      if (!nextSelectedModuleId) {
        resetModuleSelection("");
        return;
      }

      if (nextSelectedModuleId !== currentModuleId) {
        resetModuleSelection(nextSelectedModuleId);
        return;
      }

      void loadResources(nextSelectedModuleId, {
        preserveOnError: true
      });
    } catch (error) {
      if (requestId !== moduleRequestIdRef.current) {
        return;
      }
      if (isAuthError(error)) {
        handleAuthRequired();
        return;
      }

      const nextMessage = getTeacherModulesRequestMessage(error, "模块加载失败");
      const classMissing = isMissingTeacherModulesClassError(error);
      const preserveOnError =
        !classMissing &&
        options.preserveOnError === true &&
        lastSuccessfulModulesClassIdRef.current === target &&
        modulesRef.current.length > 0;

      if (classMissing) {
        removeMissingClass(target);
      } else if (!preserveOnError) {
        clearModulesSnapshot();
      }

      setModulesNotice(
        preserveOnError
          ? `模块列表刷新失败，已保留最近一次结果：${nextMessage}`
          : nextMessage
      );
    }
  }, [
    classIdRef,
    clearModulesSnapshot,
    handleAuthRequired,
    lastSuccessfulModulesClassIdRef,
    loadResources,
    moduleIdRef,
    moduleRequestIdRef,
    modulesRef,
    removeMissingClass,
    resetModuleSelection,
    setLastLoadedAt,
    setModulesNotice,
    syncModules
  ]);

  const loadClasses = useCallback(async () => {
    const requestId = classRequestIdRef.current + 1;
    classRequestIdRef.current = requestId;
    setAuthRequired(false);
    setLoading(true);
    if (!pageReady) {
      setPageError(null);
    }

    try {
      const payload = await requestJson<TeacherClassesResponse>("/api/teacher/classes");
      if (requestId !== classRequestIdRef.current) {
        return;
      }

      const list = payload.data ?? [];
      syncClasses(list);
      setClassesNotice(null);
      setPageError(null);
      setPageReady(true);
      setLastLoadedAt(new Date().toISOString());

      const currentClassId = classIdRef.current;
      const nextSelectedClassId = resolveTeacherModulesClassId(currentClassId, list);

      if (!nextSelectedClassId) {
        resetClassSelection("");
        return;
      }

      const classChanged = nextSelectedClassId !== currentClassId;
      if (classChanged) {
        resetClassSelection(nextSelectedClassId);
      } else {
        classIdRef.current = nextSelectedClassId;
      }

      if (!classChanged) {
        void loadModules(nextSelectedClassId, {
          preserveOnError: true
        });
      }
    } catch (error) {
      if (requestId !== classRequestIdRef.current) {
        return;
      }
      if (isAuthError(error)) {
        handleAuthRequired();
        return;
      }

      const nextMessage = getTeacherModulesRequestMessage(error, "班级加载失败");
      if (!pageReady) {
        syncClasses([]);
        resetClassSelection("");
        setPageError(nextMessage);
        return;
      }

      setClassesNotice(`班级刷新失败，已保留最近一次结果：${nextMessage}`);
    } finally {
      if (requestId === classRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [
    classIdRef,
    classRequestIdRef,
    handleAuthRequired,
    loadModules,
    pageReady,
    resetClassSelection,
    setAuthRequired,
    setClassesNotice,
    setLastLoadedAt,
    setLoading,
    setPageError,
    setPageReady,
    syncClasses
  ]);

  return {
    loadClasses,
    loadModules,
    loadResources
  };
}
