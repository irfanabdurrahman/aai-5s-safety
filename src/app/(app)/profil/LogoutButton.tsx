"use client";

import { logout } from "@/actions/auth";
import { Button } from "@/components/ui/Button";
import { IconLogout } from "@/components/icons";

export function LogoutButton() {
  return (
    <form action={logout}>
      <Button type="submit" variant="outline" className="w-full text-danger">
        <IconLogout size={17} />
        Keluar
      </Button>
    </form>
  );
}
