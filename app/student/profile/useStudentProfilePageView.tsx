"use client";

import type { ComponentProps } from "react";
import { STUDENT_PERSONA_MUTABLE_FIELDS } from "@/lib/student-persona-options";
import StudentProfileBasicInfoCard from "./_components/StudentProfileBasicInfoCard";
import StudentProfileClassroomPreferencesCard from "./_components/StudentProfileClassroomPreferencesCard";
import StudentProfileCompletenessCard from "./_components/StudentProfileCompletenessCard";
import StudentProfileObserverCodeCard from "./_components/StudentProfileObserverCodeCard";
import StudentProfileSupportNotesCard from "./_components/StudentProfileSupportNotesCard";
import { sanitizeHeightInput } from "./utils";
import { useStudentProfilePage } from "./useStudentProfilePage";

export function useStudentProfilePageView() {
  const page = useStudentProfilePage();

  const completenessCardProps: ComponentProps<typeof StudentProfileCompletenessCard> = {
    percentage: page.personaCompleteness.percentage,
    completedFields: page.personaCompleteness.completedFields,
    totalFields: STUDENT_PERSONA_MUTABLE_FIELDS.length,
    missingFields: page.personaCompleteness.missingFields
  };

  const basicInfoCardProps: ComponentProps<typeof StudentProfileBasicInfoCard> = {
    form: page.form,
    onGradeChange: (value) => {
      page.updateForm("grade", value);
    },
    onTargetChange: (value) => {
      page.updateForm("target", value);
    },
    onSchoolChange: (value) => {
      page.updateForm("school", value);
    },
    onToggleSubject: page.toggleSubject
  };

  const classroomPreferencesCardProps: ComponentProps<typeof StudentProfileClassroomPreferencesCard> = {
    form: page.form,
    onPreferredNameChange: (value) => {
      page.updateForm("preferredName", value);
    },
    onHeightCmChange: (value) => {
      page.updateForm("heightCm", sanitizeHeightInput(value));
    },
    onGenderChange: (value) => {
      page.updateForm("gender", value);
    },
    onEyesightLevelChange: (value) => {
      page.updateForm("eyesightLevel", value);
    },
    onSeatPreferenceChange: (value) => {
      page.updateForm("seatPreference", value);
    },
    onPersonalityChange: (value) => {
      page.updateForm("personality", value);
    },
    onFocusSupportChange: (value) => {
      page.updateForm("focusSupport", value);
    },
    onPeerSupportChange: (value) => {
      page.updateForm("peerSupport", value);
    }
  };

  const supportNotesCardProps: ComponentProps<typeof StudentProfileSupportNotesCard> = {
    strengths: page.form.strengths,
    supportNotes: page.form.supportNotes,
    error: page.error,
    message: page.message,
    saving: page.saving,
    onStrengthsChange: (value) => {
      page.updateForm("strengths", value);
    },
    onSupportNotesChange: (value) => {
      page.updateForm("supportNotes", value);
    }
  };

  const observerCodeCardProps: ComponentProps<typeof StudentProfileObserverCodeCard> = {
    observerCode: page.observerCode,
    observerCopied: page.observerCopied,
    observerMessage: page.observerMessage,
    observerError: page.observerError,
    loading: page.loadingObserverCode,
    regenerating: page.regeneratingObserverCode,
    onCopy: () => {
      void page.copyObserverCode();
    },
    onReload: () => {
      void page.refreshObserverCode();
    },
    onRegenerate: () => {
      void page.regenerateObserverCode();
    }
  };

  return {
    loading: page.loading,
    authRequired: page.authRequired,
    pageError: page.pageError,
    profileReady: page.profileReady,
    reload: () => {
      void page.reloadPage();
    },
    handleSave: page.handleSave,
    completenessCardProps,
    basicInfoCardProps,
    classroomPreferencesCardProps,
    supportNotesCardProps,
    observerCodeCardProps
  };
}
