export type RoleLaunchCard = {
  id: string;
  title: string;
  subtitle: string;
  tag: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  highlights: string[];
};

export type FirstDayStep = {
  title: string;
  description: string;
};

export type FirstDayFlow = {
  id: string;
  roleLabel: string;
  tag: string;
  href: string;
  steps: FirstDayStep[];
};

export type CapabilityBlock = {
  title: string;
  description: string;
  icon: "rocket" | "chart" | "board" | "brain";
  href: string;
};

export type ProductStatusMetric = {
  label: string;
  value: string;
  helper: string;
};

export type FirstLookItem = {
  title: string;
  description: string;
};

export type Differentiator = {
  title: string;
  description: string;
};
