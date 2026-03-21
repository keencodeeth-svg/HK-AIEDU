import { useEffect } from "react";

type StudentPortraitPageEffectsOptions = {
  loadPortrait: (mode?: "initial" | "refresh") => Promise<void>;
};

export function useStudentPortraitPageEffects({
  loadPortrait
}: StudentPortraitPageEffectsOptions) {
  useEffect(() => {
    void loadPortrait("initial");
  }, [loadPortrait]);
}
