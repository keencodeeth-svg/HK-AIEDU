import { useEffect, type MutableRefObject } from "react";

type LoadOptions = {
  clearExisting?: boolean;
  preserveOnError?: boolean;
};

type TeacherModulesPageEffectsOptions = {
  initialLoadStartedRef: MutableRefObject<boolean>;
  pageReady: boolean;
  classId: string;
  moduleId: string;
  clearResourcesSnapshot: () => void;
  loadClasses: () => Promise<void>;
  loadModules: (nextClassId?: string, options?: LoadOptions) => Promise<void>;
  loadResources: (nextModuleId?: string, options?: LoadOptions) => Promise<void>;
};

export function useTeacherModulesPageEffects({
  initialLoadStartedRef,
  pageReady,
  classId,
  moduleId,
  clearResourcesSnapshot,
  loadClasses,
  loadModules,
  loadResources
}: TeacherModulesPageEffectsOptions) {
  useEffect(() => {
    if (initialLoadStartedRef.current) {
      return;
    }
    initialLoadStartedRef.current = true;
    void loadClasses();
  }, [initialLoadStartedRef, loadClasses]);

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
}
