"use client";

import Card from "@/components/Card";
import Stat from "@/components/Stat";

type SchoolSchedulesOverviewCardProps = {
  classCount: number;
  activeClasses: number;
  classesWithoutScheduleCount: number;
  totalSessions: number;
  filteredSessionsCount: number;
  averageLessonsPerWeek: number;
  attentionClassCount: number;
};

export function SchoolSchedulesOverviewCard({
  classCount,
  activeClasses,
  classesWithoutScheduleCount,
  totalSessions,
  filteredSessionsCount,
  averageLessonsPerWeek,
  attentionClassCount
}: SchoolSchedulesOverviewCardProps) {
  return (
    <Card title="排课运营概览" tag="统计">
      <div className="grid grid-3">
        <Stat label="班级总数" value={String(classCount)} helper="学校范围" />
        <Stat label="已排课班级" value={String(activeClasses)} helper="至少有 1 个节次" />
        <Stat label="未排课班级" value={String(classesWithoutScheduleCount)} helper="优先补齐" />
        <Stat label="总节次" value={String(totalSessions)} helper={`当前筛选 ${filteredSessionsCount} 个`} />
        <Stat label="平均每班课时" value={String(averageLessonsPerWeek)} helper="按周估算" />
        <Stat label="需关注班级" value={String(attentionClassCount)} helper="优先排首课" />
      </div>
    </Card>
  );
}
