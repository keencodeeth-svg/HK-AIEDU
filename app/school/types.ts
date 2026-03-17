import type { SchoolClassRecord, SchoolOverview, SchoolUserRecord } from "@/lib/school-admin-types";

export type SchoolOverviewResponse = {
  data?: SchoolOverview | null;
};

export type SchoolClassesResponse = {
  data?: SchoolClassRecord[];
};

export type SchoolUsersResponse = {
  data?: SchoolUserRecord[];
};
