import Card from "@/components/Card";
import Stat from "@/components/Stat";
import type { SchoolOverview } from "@/lib/school-admin-types";

export function SchoolHealthMetricsCard({ overview }: { overview: SchoolOverview }) {
  return (
    <Card title="运营健康指标" tag="覆盖率">
      <div className="grid grid-3">
        <Stat label="教师覆盖率" value={`${overview.teacherCoverageRate}%`} helper={`${overview.classesWithoutTeacherCount} 个班级待绑定`} />
        <Stat label="作业覆盖率" value={`${overview.assignmentCoverageRate}%`} helper={`${overview.classesWithoutAssignmentsCount} 个班级未开始`} />
        <Stat label="课表覆盖率" value={`${overview.scheduleCoverageRate}%`} helper={`${overview.classesWithoutSchedulesCount} 个班级待排课`} />
        <Stat label="平均班级人数" value={String(overview.averageStudentsPerClass)} helper={`${overview.classesWithoutStudentsCount} 个空班级`} />
        <Stat label="平均班级作业" value={String(overview.averageAssignmentsPerClass)} helper="按当前班级均值" />
        <Stat label="平均每班课时" value={String(overview.averageLessonsPerWeek)} helper="按周估算" />
        <Stat label="未绑定教师班级" value={String(overview.classesWithoutTeacherCount)} helper="组织风险" />
        <Stat label="未排课班级" value={String(overview.classesWithoutSchedulesCount)} helper="直接影响学生主页" />
        <Stat label="空班级数" value={String(overview.classesWithoutStudentsCount)} helper="需要补员" />
      </div>
    </Card>
  );
}
