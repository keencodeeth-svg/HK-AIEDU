import { useEffect } from "react";

type Load = (mode?: "initial" | "refresh") => Promise<void>;

type TeacherAssignmentDetailPageEffectsOptions = {
  load: Load;
};

export function useTeacherAssignmentDetailPageEffects({
  load
}: TeacherAssignmentDetailPageEffectsOptions) {
  useEffect(() => {
    void load("initial");
  }, [load]);
}
