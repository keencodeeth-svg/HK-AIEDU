import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import Stat from "@/components/Stat";
import type { SchoolOverview } from "@/lib/school-admin-types";

export function SchoolDashboardOverviewCard({ overview }: { overview: SchoolOverview }) {
  return (
    <Card title="组织与执行概览" tag="运营">
      <div className="feature-card">
        <EduIcon name="chart" />
        <p>当前学校 ID：{overview.schoolId}</p>
      </div>
      <div className="grid grid-3" style={{ marginTop: 12 }}>
        <Stat label="教师数" value={String(overview.teacherCount)} helper="学校范围" />
        <Stat label="学生数" value={String(overview.studentCount)} helper="学校范围" />
        <Stat label="家长数" value={String(overview.parentCount)} helper="家校协同" />
        <Stat label="班级数" value={String(overview.classCount)} helper="组织单元" />
        <Stat label="作业数" value={String(overview.assignmentCount)} helper="教学执行" />
        <Stat label="高负载班级" value={String(overview.overloadedClassCount)} helper="人数偏高" />
      </div>
    </Card>
  );
}
