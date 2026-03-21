import { useEffect, type MutableRefObject } from "react";

type LoadBootstrap = (mode?: "initial" | "refresh") => Promise<void>;
type LoadClassScopedData = (
  targetClassId: string,
  days: number,
  preferredStudentId?: string
) => Promise<void>;
type LoadFavorites = (targetStudentId: string, silent?: boolean) => Promise<string | null>;

type TeacherAnalysisPageEffectsOptions = {
  didInitRef: MutableRefObject<boolean>;
  previousClassIdRef: MutableRefObject<string>;
  skipNextClassEffectRef: MutableRefObject<string | null>;
  skipNextStudentEffectRef: MutableRefObject<string | null>;
  studentIdRef: MutableRefObject<string>;
  classId: string;
  studentId: string;
  causalityDays: number;
  reportClassId?: string;
  clearFavoritesSnapshot: () => void;
  clearReportState: () => void;
  resetScopedData: () => void;
  loadBootstrap: LoadBootstrap;
  loadClassScopedData: LoadClassScopedData;
  loadFavorites: LoadFavorites;
};

export function useTeacherAnalysisPageEffects({
  didInitRef,
  previousClassIdRef,
  skipNextClassEffectRef,
  skipNextStudentEffectRef,
  studentIdRef,
  classId,
  studentId,
  causalityDays,
  reportClassId,
  clearFavoritesSnapshot,
  clearReportState,
  resetScopedData,
  loadBootstrap,
  loadClassScopedData,
  loadFavorites
}: TeacherAnalysisPageEffectsOptions) {
  useEffect(() => {
    if (didInitRef.current) {
      return;
    }
    didInitRef.current = true;
    void loadBootstrap();
  }, [didInitRef, loadBootstrap]);

  useEffect(() => {
    if (!didInitRef.current) {
      return;
    }
    if (!classId) {
      previousClassIdRef.current = "";
      return;
    }

    const classChanged = previousClassIdRef.current !== classId;
    previousClassIdRef.current = classId;
    if (skipNextClassEffectRef.current === classId) {
      skipNextClassEffectRef.current = null;
      return;
    }
    if (classChanged) {
      resetScopedData();
    }
    void loadClassScopedData(classId, causalityDays, studentIdRef.current);
  }, [
    causalityDays,
    classId,
    didInitRef,
    loadClassScopedData,
    previousClassIdRef,
    resetScopedData,
    skipNextClassEffectRef,
    studentIdRef
  ]);

  useEffect(() => {
    if (!studentId) {
      clearFavoritesSnapshot();
      return;
    }
    if (skipNextStudentEffectRef.current === studentId) {
      skipNextStudentEffectRef.current = null;
      return;
    }
    void loadFavorites(studentId);
  }, [clearFavoritesSnapshot, loadFavorites, skipNextStudentEffectRef, studentId]);

  useEffect(() => {
    if (reportClassId && classId && reportClassId !== classId) {
      clearReportState();
    }
  }, [classId, clearReportState, reportClassId]);
}
