import { getCurrentUser } from "@/lib/auth";
import { getDashboardOverview } from "@/lib/dashboard-overview";
import DashboardAlertsCard from "./_components/DashboardAlertsCard";
import DashboardGuestState from "./_components/DashboardGuestState";
import DashboardHeroCard from "./_components/DashboardHeroCard";
import DashboardPageHeader from "./_components/DashboardPageHeader";
import DashboardQuickActionsCard from "./_components/DashboardQuickActionsCard";
import DashboardTimelineCard from "./_components/DashboardTimelineCard";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    return <DashboardGuestState />;
  }

  const overview = await getDashboardOverview(user);

  return (
    <div className="grid" style={{ gap: 18 }}>
      <DashboardPageHeader roleLabel={overview.roleLabel} />

      <DashboardHeroCard overview={overview} />

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <DashboardAlertsCard alerts={overview.alerts} />
        <DashboardQuickActionsCard quickActions={overview.quickActions} />
      </div>

      <DashboardTimelineCard timeline={overview.timeline} />
    </div>
  );
}
