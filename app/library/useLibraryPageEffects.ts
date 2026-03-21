import { useEffect } from "react";
import type { LibraryContentFilter } from "./types";

type LibraryPageEffectsOptions = {
  contentFilter: LibraryContentFilter;
  keyword: string;
  page: number;
  pageSize: number;
  subjectFilter: string;
  userRole?: string;
  loadUser: () => Promise<boolean>;
  loadItems: (options?: { noticePrefix?: string }) => Promise<boolean>;
  loadTeacherClasses: (userRole?: string) => Promise<void>;
};

export function useLibraryPageEffects({
  contentFilter,
  keyword,
  page,
  pageSize,
  subjectFilter,
  userRole,
  loadUser,
  loadItems,
  loadTeacherClasses
}: LibraryPageEffectsOptions) {
  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  useEffect(() => {
    void loadItems();
  }, [contentFilter, keyword, loadItems, page, pageSize, subjectFilter]);

  useEffect(() => {
    void loadTeacherClasses(userRole);
  }, [loadTeacherClasses, userRole]);
}
