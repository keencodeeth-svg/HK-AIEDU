"use client";

import { useCallback, useEffect, useRef, useState, type FormEventHandler } from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type {
  ClassItem,
  ModuleItem,
  ModuleResourceItem,
  ModuleResourcePayload,
  ModuleResourceType
} from "./types";
import {
  getTeacherModulesRequestMessage,
  isMissingTeacherModulesClassError,
  isMissingTeacherModulesModuleError,
  readFileAsBase64,
  resolveTeacherModulesClassId,
  resolveTeacherModulesModuleId
} from "./utils";

type TeacherClassesResponse = {
  data?: ClassItem[];
};

type TeacherModulesResponse = {
  data?: ModuleItem[];
};

type TeacherModuleResourcesResponse = {
  data?: ModuleResourceItem[];
};

export function useTeacherModulesPage() {
  const initialLoadStartedRef = useRef(false);
  const classRequestIdRef = useRef(0);
  const moduleRequestIdRef = useRef(0);
  const resourceRequestIdRef = useRef(0);
  const lastSuccessfulModulesClassIdRef = useRef("");
  const lastSuccessfulResourcesModuleIdRef = useRef("");
  const classesRef = useRef<ClassItem[]>([]);
  const classIdRef = useRef("");
  const modulesRef = useRef<ModuleItem[]>([]);
  const moduleIdRef = useRef("");
  const resourcesRef = useRef<ModuleResourceItem[]>([]);

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [classId, setClassId] = useState("");
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [moduleId, setModuleId] = useState("");
  const [resources, setResources] = useState<ModuleResourceItem[]>([]);
  const [moduleTitle, setModuleTitle] = useState("");
  const [moduleDesc, setModuleDesc] = useState("");
  const [parentId, setParentId] = useState("");
  const [orderIndex, setOrderIndex] = useState(0);
  const [resourceType, setResourceType] = useState<ModuleResourceType>("file");
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const [resourceFile, setResourceFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pageReady, setPageReady] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [classesNotice, setClassesNotice] = useState<string | null>(null);
  const [modulesNotice, setModulesNotice] = useState<string | null>(null);
  const [resourcesNotice, setResourcesNotice] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  useEffect(() => {
    classesRef.current = classes;
  }, [classes]);

  useEffect(() => {
    classIdRef.current = classId;
  }, [classId]);

  useEffect(() => {
    modulesRef.current = modules;
  }, [modules]);

  useEffect(() => {
    moduleIdRef.current = moduleId;
  }, [moduleId]);

  useEffect(() => {
    resourcesRef.current = resources;
  }, [resources]);

  const syncClasses = useCallback((nextClasses: ClassItem[]) => {
    classesRef.current = nextClasses;
    setClasses(nextClasses);
  }, []);

  const syncModules = useCallback((nextModules: ModuleItem[]) => {
    modulesRef.current = nextModules;
    setModules(nextModules);
    setParentId((currentParentId) =>
      nextModules.some((item) => item.id === currentParentId) ? currentParentId : ""
    );
  }, []);

  const syncResources = useCallback((nextResources: ModuleResourceItem[]) => {
    resourcesRef.current = nextResources;
    setResources(nextResources);
  }, []);

  const resetResourceForm = useCallback(() => {
    setResourceType("file");
    setResourceTitle("");
    setResourceUrl("");
    setResourceFile(null);
  }, []);

  const clearResourcesSnapshot = useCallback(() => {
    syncResources([]);
    setResourcesNotice(null);
    lastSuccessfulResourcesModuleIdRef.current = "";
  }, [syncResources]);

  const resetModuleSelection = useCallback(
    (nextModuleId = "") => {
      moduleIdRef.current = nextModuleId;
      setModuleId(nextModuleId);
      clearResourcesSnapshot();
      resetResourceForm();
    },
    [clearResourcesSnapshot, resetResourceForm]
  );

  const clearModulesSnapshot = useCallback(() => {
    syncModules([]);
    setModulesNotice(null);
    lastSuccessfulModulesClassIdRef.current = "";
    resetModuleSelection("");
  }, [resetModuleSelection, syncModules]);

  const resetClassSelection = useCallback(
    (nextClassId = "") => {
      classIdRef.current = nextClassId;
      setClassId(nextClassId);
      clearModulesSnapshot();
    },
    [clearModulesSnapshot]
  );

  const removeMissingClass = useCallback(
    (staleClassId: string) => {
      const nextClasses = classesRef.current.filter((item) => item.id !== staleClassId);
      syncClasses(nextClasses);
      resetClassSelection(resolveTeacherModulesClassId("", nextClasses));
    },
    [resetClassSelection, syncClasses]
  );

  const removeMissingModule = useCallback(
    (staleModuleId: string) => {
      const nextModules = modulesRef.current.filter((item) => item.id !== staleModuleId);
      syncModules(nextModules);
      resetModuleSelection(resolveTeacherModulesModuleId("", nextModules));
    },
    [resetModuleSelection, syncModules]
  );

  const handleAuthRequired = useCallback(() => {
    syncClasses([]);
    classIdRef.current = "";
    setClassId("");
    clearModulesSnapshot();
    setClassesNotice(null);
    setMessage(null);
    setError(null);
    setPageReady(false);
    setPageError(null);
    setLastLoadedAt(null);
    setAuthRequired(true);
  }, [clearModulesSnapshot, syncClasses]);

  const loadResources = useCallback(
    async (
      nextModuleId?: string,
      options: { clearExisting?: boolean; preserveOnError?: boolean } = {}
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
      } catch (nextError) {
        if (requestId !== resourceRequestIdRef.current) {
          return;
        }
        if (isAuthError(nextError)) {
          handleAuthRequired();
          return;
        }
        const nextMessage = getTeacherModulesRequestMessage(nextError, "模块资源加载失败");
        const moduleMissing = isMissingTeacherModulesModuleError(nextError);
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
    },
    [
      clearResourcesSnapshot,
      handleAuthRequired,
      removeMissingModule,
      resetModuleSelection,
      syncResources
    ]
  );

  const loadModules = useCallback(
    async (
      nextClassId?: string,
      options: { clearExisting?: boolean; preserveOnError?: boolean } = {}
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
      } catch (nextError) {
        if (requestId !== moduleRequestIdRef.current) {
          return;
        }
        if (isAuthError(nextError)) {
          handleAuthRequired();
          return;
        }
        const nextMessage = getTeacherModulesRequestMessage(nextError, "模块加载失败");
        const classMissing = isMissingTeacherModulesClassError(nextError);
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
    },
    [
      clearModulesSnapshot,
      handleAuthRequired,
      loadResources,
      removeMissingClass,
      resetModuleSelection,
      syncModules
    ]
  );

  const loadClasses = useCallback(
    async () => {
      const requestId = classRequestIdRef.current + 1;
      classRequestIdRef.current = requestId;
      setAuthRequired(false);
      setLoading(true);
      if (!pageReady) {
        setPageError(null);
      }

      try {
        const payload = await requestJson<TeacherClassesResponse>(
          "/api/teacher/classes"
        );
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
          setClassId(nextSelectedClassId);
        }

        if (!classChanged) {
          void loadModules(nextSelectedClassId, {
            preserveOnError: true
          });
        }
      } catch (nextError) {
        if (requestId !== classRequestIdRef.current) {
          return;
        }
        if (isAuthError(nextError)) {
          handleAuthRequired();
          return;
        }
        const nextMessage = getTeacherModulesRequestMessage(nextError, "班级加载失败");
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
    },
    [handleAuthRequired, loadModules, pageReady, resetClassSelection, syncClasses]
  );

  useEffect(() => {
    if (initialLoadStartedRef.current) {
      return;
    }
    initialLoadStartedRef.current = true;
    void loadClasses();
  }, [loadClasses]);

  useEffect(() => {
    if (!pageReady || !classId) {
      return;
    }
    void loadModules(classId, {
      clearExisting: true
    });
  }, [classId, loadModules, pageReady]);

  useEffect(() => {
    if (!pageReady) {
      return;
    }
    if (!moduleId) {
      clearResourcesSnapshot();
      return;
    }
    void loadResources(moduleId, {
      clearExisting: true
    });
  }, [clearResourcesSnapshot, loadResources, moduleId, pageReady]);

  const handleClassChange = useCallback((nextClassId: string) => {
    classIdRef.current = nextClassId;
    setClassId(nextClassId);
    setMessage(null);
    setError(null);
  }, []);

  const handleModuleChange = useCallback((nextModuleId: string) => {
    moduleIdRef.current = nextModuleId;
    setModuleId(nextModuleId);
    setMessage(null);
    setError(null);
  }, []);

  const handleCreateModule = useCallback<FormEventHandler<HTMLFormElement>>(
    async (event) => {
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
      } catch (nextError) {
        if (isAuthError(nextError)) {
          handleAuthRequired();
          return;
        }
        if (isMissingTeacherModulesClassError(nextError)) {
          removeMissingClass(activeClassId);
        }
        setError(getTeacherModulesRequestMessage(nextError, "创建失败"));
      }
    },
    [
      handleAuthRequired,
      loadModules,
      moduleDesc,
      moduleTitle,
      orderIndex,
      parentId,
      removeMissingClass
    ]
  );

  const handleAddResource = useCallback<FormEventHandler<HTMLFormElement>>(
    async (event) => {
      event.preventDefault();
      setMessage(null);
      setError(null);
      const activeModuleId = moduleIdRef.current;
      const activeClassId = classIdRef.current;
      if (!activeModuleId) return;
      if (!resourceTitle) {
        setError("请填写资源标题");
        return;
      }
      if (resourceType === "file" && !resourceFile) {
        setError("请选择文件");
        return;
      }
      if (resourceType === "link" && !resourceUrl) {
        setError("请输入资源链接");
        return;
      }

      let payload: ModuleResourcePayload = {
        title: resourceTitle,
        resourceType
      };

      if (resourceType === "link") {
        payload.linkUrl = resourceUrl;
      } else if (resourceFile) {
        payload = {
          ...payload,
          fileName: resourceFile.name,
          mimeType: resourceFile.type || "application/octet-stream",
          size: resourceFile.size,
          contentBase64: await readFileAsBase64(resourceFile)
        };
      }

      try {
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
      } catch (nextError) {
        if (isAuthError(nextError)) {
          handleAuthRequired();
          return;
        }
        if (isMissingTeacherModulesClassError(nextError)) {
          removeMissingClass(activeClassId);
        } else if (isMissingTeacherModulesModuleError(nextError)) {
          removeMissingModule(activeModuleId);
          await loadModules(activeClassId, {
            clearExisting: true
          });
        }
        setError(getTeacherModulesRequestMessage(nextError, "上传失败"));
      }
    },
    [
      handleAuthRequired,
      loadModules,
      loadResources,
      removeMissingClass,
      removeMissingModule,
      resetResourceForm,
      resourceFile,
      resourceTitle,
      resourceType,
      resourceUrl
    ]
  );

  const handleDeleteResource = useCallback(
    async (resourceId: string) => {
      const activeModuleId = moduleIdRef.current;
      const activeClassId = classIdRef.current;
      if (!activeModuleId) return;
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
      } catch (nextError) {
        if (isAuthError(nextError)) {
          handleAuthRequired();
          return;
        }
        if (isMissingTeacherModulesClassError(nextError)) {
          removeMissingClass(activeClassId);
        } else if (isMissingTeacherModulesModuleError(nextError)) {
          removeMissingModule(activeModuleId);
          await loadModules(activeClassId, {
            clearExisting: true
          });
        }
        setError(getTeacherModulesRequestMessage(nextError, "删除失败"));
      }
    },
    [
      handleAuthRequired,
      loadModules,
      loadResources,
      removeMissingClass,
      removeMissingModule
    ]
  );

  const swapOrder = useCallback(
    async (index: number, direction: "up" | "down") => {
      if (moving) return;
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= modules.length) return;
      const current = modules[index];
      const target = modules[nextIndex];
      const activeClassId = classIdRef.current;
      setMoving(true);
      setMessage(null);
      setError(null);
      try {
        await requestJson(`/api/teacher/modules/${current.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderIndex: target.orderIndex })
        });
        await requestJson(`/api/teacher/modules/${target.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderIndex: current.orderIndex })
        });
        setMessage("模块顺序已更新");
        await loadModules(activeClassId, {
          preserveOnError: true
        });
      } catch (nextError) {
        if (isAuthError(nextError)) {
          handleAuthRequired();
          return;
        }
        if (isMissingTeacherModulesClassError(nextError)) {
          removeMissingClass(activeClassId);
        } else if (isMissingTeacherModulesModuleError(nextError)) {
          await loadModules(activeClassId, {
            clearExisting: true
          });
        } else {
          await loadModules(activeClassId, {
            preserveOnError: true
          });
        }
        setError(getTeacherModulesRequestMessage(nextError, "调整排序失败"));
      } finally {
        setMoving(false);
      }
    },
    [handleAuthRequired, loadModules, modules, moving, removeMissingClass]
  );

  const reload = useCallback(() => {
    void loadClasses();
  }, [loadClasses]);

  return {
    classes,
    classId,
    modules,
    moduleId,
    resources,
    moduleTitle,
    moduleDesc,
    parentId,
    orderIndex,
    resourceType,
    resourceTitle,
    resourceUrl,
    message,
    error,
    moving,
    authRequired,
    loading,
    pageReady,
    pageError,
    classesNotice,
    modulesNotice,
    resourcesNotice,
    lastLoadedAt,
    setClassId: handleClassChange,
    setModuleId: handleModuleChange,
    setModuleTitle,
    setModuleDesc,
    setParentId,
    setOrderIndex,
    setResourceType,
    setResourceTitle,
    setResourceUrl,
    setResourceFile,
    handleCreateModule,
    handleAddResource,
    handleDeleteResource,
    swapOrder,
    reload
  };
}
