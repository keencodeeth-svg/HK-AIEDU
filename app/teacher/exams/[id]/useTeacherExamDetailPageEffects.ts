import { useEffect } from "react";

type LoadMode = "initial" | "refresh";

type TeacherExamDetailPageEffectsOptions = {
  load: (mode?: LoadMode) => Promise<void>;
};

export function useTeacherExamDetailPageEffects({
  load
}: TeacherExamDetailPageEffectsOptions) {
  useEffect(() => {
    void load();
  }, [load]);
}
