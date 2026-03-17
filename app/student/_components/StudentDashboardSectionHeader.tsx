"use client";

type StudentDashboardSectionHeaderProps = {
  title: string;
  description: string;
  chip: string;
};

export default function StudentDashboardSectionHeader({
  title,
  description,
  chip
}: StudentDashboardSectionHeaderProps) {
  return (
    <div className="section-head">
      <div>
        <h2>{title}</h2>
        <div className="section-sub">{description}</div>
      </div>
      <span className="chip">{chip}</span>
    </div>
  );
}
