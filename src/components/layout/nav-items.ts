import type { Role } from "@/generated/prisma/enums";

export type NavItem = {
  href: string;
  label: string;
  icon:
    | "home"
    | "clipboard"
    | "alert"
    | "check"
    | "user"
    | "chart"
    | "trophy"
    | "checklist"
    | "tv"
    | "building"
    | "book"
    | "sparkles";
  roles?: Role[]; // undefined = semua role
  mobile?: boolean; // tampil di bottom nav HP
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Beranda", icon: "home", mobile: true },
  { href: "/temuan", label: "Temuan", icon: "clipboard", mobile: true },
  { href: "/audit", label: "Audit 5S", icon: "checklist", mobile: true },
  {
    href: "/tugas-saya",
    label: "Tugas Saya",
    icon: "check",
    roles: ["PIC_AREA", "SUPERVISOR", "ADMIN"],
  },
  {
    href: "/verifikasi",
    label: "Verifikasi",
    icon: "alert",
    roles: ["SUPERVISOR", "ADMIN"],
  },
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: "chart",
    roles: ["SUPERVISOR", "ADMIN"],
  },
  { href: "/leaderboard", label: "Peringkat", icon: "trophy" },
  { href: "/galeri", label: "Safety & 5S Live Wall", icon: "tv" },
  { href: "/panduan", label: "Panduan", icon: "book" },
  { href: "/asisten-ai", label: "AI Safety", icon: "sparkles" },
  { href: "/admin", label: "Admin", icon: "building", roles: ["ADMIN"] },
  { href: "/profil", label: "Profil", icon: "user", mobile: true },
];

export function navForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((i) => !i.roles || i.roles.includes(role));
}
