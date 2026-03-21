import { useEffect, type Dispatch, type SetStateAction } from "react";
import { trackEvent } from "@/lib/analytics-client";
import type { WeeklyReportResponse } from "./types";
import { isErrorResponse } from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type ReportPageEffectsOptions = {
  loadPage: () => Promise<void>;
  report: WeeklyReportResponse | null;
  trackedReportView: boolean;
  setTrackedReportView: Setter<boolean>;
  subjectFilter: string;
  resolvedSubjectFilter: string;
  setSubjectFilter: Setter<string>;
  chapterFilter: string;
  resolvedChapterFilter: string;
  setChapterFilter: Setter<string>;
};

export function useReportPageEffects({
  loadPage,
  report,
  trackedReportView,
  setTrackedReportView,
  subjectFilter,
  resolvedSubjectFilter,
  setSubjectFilter,
  chapterFilter,
  resolvedChapterFilter,
  setChapterFilter
}: ReportPageEffectsOptions) {
  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  useEffect(() => {
    if (!report || isErrorResponse(report) || trackedReportView) {
      return;
    }

    trackEvent({
      eventName: "report_weekly_view",
      page: "/report",
      props: {
        hasError: false,
        total: report.stats.total,
        accuracy: report.stats.accuracy
      }
    });
    setTrackedReportView(true);
  }, [report, setTrackedReportView, trackedReportView]);

  useEffect(() => {
    if (resolvedSubjectFilter !== subjectFilter) {
      setSubjectFilter(resolvedSubjectFilter);
    }
  }, [resolvedSubjectFilter, setSubjectFilter, subjectFilter]);

  useEffect(() => {
    if (resolvedChapterFilter !== chapterFilter) {
      setChapterFilter(resolvedChapterFilter);
    }
  }, [chapterFilter, resolvedChapterFilter, setChapterFilter]);
}
