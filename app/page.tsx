import { HomeDifferentiatorsSection } from "./_components/HomeDifferentiatorsSection";
import { HomeFirstDayFlowsSection } from "./_components/HomeFirstDayFlowsSection";
import { HomeHeroSection } from "./_components/HomeHeroSection";
import { HomeRoleLaunchSection } from "./_components/HomeRoleLaunchSection";
import {
  CAPABILITY_BLOCKS,
  DIFFERENTIATORS,
  FIRST_DAY_FLOWS,
  FIRST_LOOK_ITEMS,
  HERO_PILLS,
  PRODUCT_STATUS_METRICS,
  ROLE_LAUNCH_CARDS
} from "./home.data";

export default function Home() {
  return (
    <div className="grid" style={{ gap: 28 }}>
      <HomeHeroSection pills={HERO_PILLS} productStatusMetrics={PRODUCT_STATUS_METRICS} firstLookItems={FIRST_LOOK_ITEMS} />

      <HomeRoleLaunchSection roleLaunchCards={ROLE_LAUNCH_CARDS} />

      <HomeFirstDayFlowsSection firstDayFlows={FIRST_DAY_FLOWS} />

      <HomeDifferentiatorsSection differentiators={DIFFERENTIATORS} capabilityBlocks={CAPABILITY_BLOCKS} />
    </div>
  );
}
