import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 20, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

export const IconHome = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
    <path d="M10 21v-6h4v6" />
  </svg>
);

export const IconClipboard = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
    <path d="M9 10h6M9 14h6M9 18h3" />
  </svg>
);

export const IconAlert = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3 2.5 20h19L12 3Z" />
    <path d="M12 10v4" />
    <path d="M12 17.2v.01" />
  </svg>
);

export const IconCheckSquare = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <path d="m8 12 3 3 5-6" />
  </svg>
);

export const IconUser = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
  </svg>
);

export const IconUsers = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5" />
    <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.7c2 .8 3 2.4 3 4.3" />
  </svg>
);

export const IconBell = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M18 9a6 6 0 1 0-12 0c0 6-2.5 7-2.5 7h17S18 15 18 9" />
    <path d="M10 20a2.2 2.2 0 0 0 4 0" />
  </svg>
);

export const IconPlus = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconCamera = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13.5" r="3.5" />
  </svg>
);

export const IconLogout = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
  </svg>
);

export const IconChart = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 3v18h18" />
    <path d="M8 17v-6M13 17V7M18 17v-4" />
  </svg>
);

export const IconTv = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="2" y="5" width="20" height="13" rx="2" />
    <path d="M8 21h8" />
  </svg>
);

export const IconBuilding = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="4" y="3" width="16" height="18" rx="1.5" />
    <path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3" />
  </svg>
);

export const IconCalendar = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M8 3v4M16 3v4M3 10h18" />
  </svg>
);

export const IconDownload = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3v12" />
    <path d="m7 10 5 5 5-5" />
    <path d="M4 21h16" />
  </svg>
);

export const IconTrophy = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
    <path d="M8 5H5a3 3 0 0 0 3 5M16 5h3a3 3 0 0 1-3 5" />
    <path d="M12 13v4M8 21h8M10 17h4v4h-4z" />
  </svg>
);

export const IconShield = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3 5 6v5c0 5 3 8.5 7 10 4-1.5 7-5 7-10V6l-7-3Z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

export const IconSearch = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

export const IconChevronRight = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export const IconChevronDown = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const IconX = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const IconClock = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export const IconChecklist = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m3.5 6 1.5 1.5L8 4.5" />
    <path d="m3.5 12.5 1.5 1.5L8 11" />
    <path d="m3.5 19 1.5 1.5L8 17.5" />
    <path d="M11 6.5h10M11 13h10M11 19.5h10" />
  </svg>
);

export const IconBook = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v18H6.5A2.5 2.5 0 0 1 4 18.5v-13Z" />
    <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v18h5.5a2.5 2.5 0 0 0 2.5-2.5v-13Z" />
    <path d="M12 3v18" />
  </svg>
);
