import { useEffect } from "react";
import type { TeacherNotificationLoadStatus } from "./types";

type TeacherNotificationRulesPageEffectsOptions = {
  load: (mode?: "initial" | "refresh") => Promise<TeacherNotificationLoadStatus>;
};

export function useTeacherNotificationRulesPageEffects({
  load
}: TeacherNotificationRulesPageEffectsOptions) {
  useEffect(() => {
    void load();
  }, [load]);
}
