import { Outlet } from "react-router-dom";
import { AdminShell } from "./AdminShell";
import { useState } from "react";

export function AdminLayout() {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  return (
    <AdminShell onOpenCommandPalette={() => setCommandPaletteOpen(true)}>
      <Outlet context={{ commandPaletteOpen, setCommandPaletteOpen }} />
    </AdminShell>
  );
}