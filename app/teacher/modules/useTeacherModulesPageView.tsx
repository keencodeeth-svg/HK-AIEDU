"use client";

import type { ComponentProps } from "react";
import { formatLoadedTime } from "@/lib/client-request";
import ModulesClassSelectorCard from "./_components/ModulesClassSelectorCard";
import ModulesCreateCard from "./_components/ModulesCreateCard";
import ModulesListCard from "./_components/ModulesListCard";
import ModulesResourcesCard from "./_components/ModulesResourcesCard";
import { useTeacherModulesPage } from "./useTeacherModulesPage";

export function useTeacherModulesPageView() {
  const page = useTeacherModulesPage();

  const classSelectorCardProps: ComponentProps<typeof ModulesClassSelectorCard> = {
    classes: page.classes,
    classId: page.classId,
    onClassChange: page.setClassId
  };

  const createCardProps: ComponentProps<typeof ModulesCreateCard> = {
    modules: page.modules,
    moduleTitle: page.moduleTitle,
    moduleDesc: page.moduleDesc,
    parentId: page.parentId,
    orderIndex: page.orderIndex,
    error: page.error,
    message: page.message,
    onSubmit: page.handleCreateModule,
    onModuleTitleChange: page.setModuleTitle,
    onModuleDescChange: page.setModuleDesc,
    onParentIdChange: page.setParentId,
    onOrderIndexChange: page.setOrderIndex
  };

  const listCardProps: ComponentProps<typeof ModulesListCard> = {
    modules: page.modules,
    moving: page.moving,
    onSwapOrder: page.swapOrder
  };

  const resourcesCardProps: ComponentProps<typeof ModulesResourcesCard> = {
    modules: page.modules,
    moduleId: page.moduleId,
    resourceType: page.resourceType,
    resourceTitle: page.resourceTitle,
    resourceUrl: page.resourceUrl,
    resources: page.resources,
    onModuleChange: page.setModuleId,
    onSubmit: page.handleAddResource,
    onResourceTitleChange: page.setResourceTitle,
    onResourceTypeChange: page.setResourceType,
    onResourceFileChange: page.setResourceFile,
    onResourceUrlChange: page.setResourceUrl,
    onDeleteResource: page.handleDeleteResource
  };

  return {
    authRequired: page.authRequired,
    pageError: page.pageError,
    pageLoading: page.loading && !page.pageReady && !page.authRequired,
    classesNotice: page.classesNotice,
    modulesNotice: page.modulesNotice,
    resourcesNotice: page.resourcesNotice,
    error: page.error,
    message: page.message,
    loading: page.loading,
    reload: page.reload,
    lastLoadedAtLabel: page.lastLoadedAt ? formatLoadedTime(page.lastLoadedAt) : null,
    classSelectorCardProps,
    createCardProps,
    listCardProps,
    resourcesCardProps
  };
}
