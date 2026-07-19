import {
  IconHome,
  IconClipboard,
  IconAlert,
  IconCheckSquare,
  IconUser,
  IconChart,
  IconTrophy,
  IconChecklist,
  IconTv,
  IconBuilding,
} from "@/components/icons";
import type { NavItem } from "./nav-items";

const MAP = {
  home: IconHome,
  clipboard: IconClipboard,
  alert: IconAlert,
  check: IconCheckSquare,
  user: IconUser,
  chart: IconChart,
  trophy: IconTrophy,
  checklist: IconChecklist,
  tv: IconTv,
  building: IconBuilding,
} as const;

export function NavIcon({
  icon,
  size = 22,
}: {
  icon: NavItem["icon"];
  size?: number;
}) {
  const Cmp = MAP[icon];
  return <Cmp size={size} />;
}
