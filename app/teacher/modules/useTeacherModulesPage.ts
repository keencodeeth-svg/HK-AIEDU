"use client";

import { useCallback } from "react";
import { useTeacherModulesActions } from "./useTeacherModulesActions";
import { useTeacherModulesLoaders } from "./useTeacherModulesLoaders";
import { useTeacherModulesPageEffects } from "./useTeacherModulesPageEffects";
import { useTeacherModulesPageState } from "./useTeacherModulesPageState";

export function useTeacherModulesPage() {
  const pageState = useTeacherModulesPageState();

  const { loadClasses, loadModules, loadResources } = useTeacherModulesLoaders({
    pageReady: pageState.pageReady,
    classIdRef: pageState.classIdRef,
    moduleIdRef: pageState.moduleIdRef,
    modulesRef: pageState.modulesRef,
    resourcesRef: pageState.resourcesRef,
    classRequestIdRef: pageState.classRequestIdRef,
    moduleRequestIdRef: pageState.moduleRequestIdRef,
    resourceRequestIdRef: pageState.resourceRequestIdRef,
    lastSuccessfulModulesClassIdRef: pageState.lastSuccessfulModulesClassIdRef,
    lastSuccessfulResourcesModuleIdRef: pageState.lastSuccessfulResourcesModuleIdRef,
    syncClasses: pageState.syncClasses,
    syncModules: pageState.syncModules,
    syncResources: pageState.syncResources,
    resetModuleSelection: pageState.resetModuleSelection,
    clearResourcesSnapshot: pageState.clearResourcesSnapshot,
    clearModulesSnapshot: pageState.clearModulesSnapshot,
    resetClassSelection: pageState.resetClassSelection,
    handleAuthRequired: pageState.handleAuthRequired,
    removeMissingClass: pageState.removeMissingClass,
    removeMissingModule: pageState.removeMissingModule,
    setAuthRequired: pageState.setAuthRequired,
    setLoading: pageState.setLoading,
    setPageReady: pageState.setPageReady,
    setPageError: pageState.setPageError,
    setClassesNotice: pageState.setClassesNotice,
    setModulesNotice: pageState.setModulesNotice,
    setResourcesNotice: pageState.setResourcesNotice,
    setLastLoadedAt: pageState.setLastLoadedAt
  });

  useTeacherModulesPageEffects({
    initialLoadStartedRef: pageState.initialLoadStartedRef,
    pageReady: pageState.pageReady,
    classId: pageState.classId,
    moduleId: pageState.moduleId,
    clearResourcesSnapshot: pageState.clearResourcesSnapshot,
    loadClasses,
    loadModules,
    loadResources
  });

  const actions = useTeacherModulesActions({
    moduleTitle: pageState.moduleTitle,
    moduleDesc: pageState.moduleDesc,
    parentId: pageState.parentId,
    orderIndex: pageState.orderIndex,
    resourceType: pageState.resourceType,
    resourceTitle: pageState.resourceTitle,
    resourceUrl: pageState.resourceUrl,
    resourceFile: pageState.resourceFile,
    modules: pageState.modules,
    moving: pageState.moving,
    classIdRef: pageState.classIdRef,
    moduleIdRef: pageState.moduleIdRef,
    handleAuthRequired: pageState.handleAuthRequired,
    resetResourceForm: pageState.resetResourceForm,
    loadModules,
    loadResources,
    removeMissingClass: pageState.removeMissingClass,
    removeMissingModule: pageState.removeMissingModule,
    applyClassId: pageState.applyClassId,
    applyModuleId: pageState.applyModuleId,
    setModuleTitle: pageState.setModuleTitle,
    setModuleDesc: pageState.setModuleDesc,
    setParentId: pageState.setParentId,
    setOrderIndex: pageState.setOrderIndex,
    setMessage: pageState.setMessage,
    setError: pageState.setError,
    setMoving: pageState.setMoving
  });

  const reload = useCallback(() => {
    void loadClasses();
  }, [loadClasses]);

  return {
    classes: pageState.classes,
    classId: pageState.classId,
    modules: pageState.modules,
    moduleId: pageState.moduleId,
    resources: pageState.resources,
    moduleTitle: pageState.moduleTitle,
    moduleDesc: pageState.moduleDesc,
    parentId: pageState.parentId,
    orderIndex: pageState.orderIndex,
    resourceType: pageState.resourceType,
    resourceTitle: pageState.resourceTitle,
    resourceUrl: pageState.resourceUrl,
    message: pageState.message,
    error: pageState.error,
    moving: pageState.moving,
    authRequired: pageState.authRequired,
    loading: pageState.loading,
    pageReady: pageState.pageReady,
    pageError: pageState.pageError,
    classesNotice: pageState.classesNotice,
    modulesNotice: pageState.modulesNotice,
    resourcesNotice: pageState.resourcesNotice,
    lastLoadedAt: pageState.lastLoadedAt,
    setClassId: actions.handleClassChange,
    setModuleId: actions.handleModuleChange,
    setModuleTitle: pageState.setModuleTitle,
    setModuleDesc: pageState.setModuleDesc,
    setParentId: pageState.setParentId,
    setOrderIndex: pageState.setOrderIndex,
    setResourceType: pageState.setResourceType,
    setResourceTitle: pageState.setResourceTitle,
    setResourceUrl: pageState.setResourceUrl,
    setResourceFile: pageState.setResourceFile,
    handleCreateModule: actions.handleCreateModule,
    handleAddResource: actions.handleAddResource,
    handleDeleteResource: actions.handleDeleteResource,
    swapOrder: actions.swapOrder,
    reload
  };
}
