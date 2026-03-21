import { useCallback, useRef, useState } from "react";
import type {
  ClassItem,
  ModuleItem,
  ModuleResourceItem,
  ModuleResourceType
} from "./types";
import {
  removeTeacherModulesClassSnapshot,
  removeTeacherModulesModuleSnapshot,
  resolveTeacherModulesParentId
} from "./utils";

export function useTeacherModulesPageState() {
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

  const syncClasses = useCallback((nextClasses: ClassItem[]) => {
    classesRef.current = nextClasses;
    setClasses(nextClasses);
  }, []);

  const applyClassId = useCallback((nextClassId: string) => {
    classIdRef.current = nextClassId;
    setClassId(nextClassId);
  }, []);

  const syncModules = useCallback((nextModules: ModuleItem[]) => {
    modulesRef.current = nextModules;
    setModules(nextModules);
    setParentId((currentParentId) =>
      resolveTeacherModulesParentId(currentParentId, nextModules)
    );
  }, []);

  const applyModuleId = useCallback((nextModuleId: string) => {
    moduleIdRef.current = nextModuleId;
    setModuleId(nextModuleId);
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

  const resetModuleSelection = useCallback((nextModuleId = "") => {
    applyModuleId(nextModuleId);
    clearResourcesSnapshot();
    resetResourceForm();
  }, [applyModuleId, clearResourcesSnapshot, resetResourceForm]);

  const clearModulesSnapshot = useCallback(() => {
    syncModules([]);
    setModulesNotice(null);
    lastSuccessfulModulesClassIdRef.current = "";
    resetModuleSelection("");
  }, [resetModuleSelection, syncModules]);

  const resetClassSelection = useCallback((nextClassId = "") => {
    applyClassId(nextClassId);
    clearModulesSnapshot();
  }, [applyClassId, clearModulesSnapshot]);

  const removeMissingClass = useCallback((staleClassId: string) => {
    const nextState = removeTeacherModulesClassSnapshot(classesRef.current, staleClassId);
    syncClasses(nextState.classes);
    resetClassSelection(nextState.classId);
  }, [resetClassSelection, syncClasses]);

  const removeMissingModule = useCallback((staleModuleId: string) => {
    const nextState = removeTeacherModulesModuleSnapshot(modulesRef.current, staleModuleId);
    syncModules(nextState.modules);
    resetModuleSelection(nextState.moduleId);
  }, [resetModuleSelection, syncModules]);

  const handleAuthRequired = useCallback(() => {
    syncClasses([]);
    applyClassId("");
    clearModulesSnapshot();
    setClassesNotice(null);
    setMessage(null);
    setError(null);
    setPageReady(false);
    setPageError(null);
    setLastLoadedAt(null);
    setAuthRequired(true);
  }, [applyClassId, clearModulesSnapshot, syncClasses]);

  return {
    initialLoadStartedRef,
    classRequestIdRef,
    moduleRequestIdRef,
    resourceRequestIdRef,
    lastSuccessfulModulesClassIdRef,
    lastSuccessfulResourcesModuleIdRef,
    classesRef,
    classIdRef,
    modulesRef,
    moduleIdRef,
    resourcesRef,
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
    resourceFile,
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
    setModuleTitle,
    setModuleDesc,
    setParentId,
    setOrderIndex,
    setResourceType,
    setResourceTitle,
    setResourceUrl,
    setResourceFile,
    setMessage,
    setError,
    setMoving,
    setAuthRequired,
    setLoading,
    setPageReady,
    setPageError,
    setClassesNotice,
    setModulesNotice,
    setResourcesNotice,
    setLastLoadedAt,
    syncClasses,
    applyClassId,
    syncModules,
    applyModuleId,
    syncResources,
    resetResourceForm,
    clearResourcesSnapshot,
    resetModuleSelection,
    clearModulesSnapshot,
    resetClassSelection,
    removeMissingClass,
    removeMissingModule,
    handleAuthRequired
  };
}
