import { Outlet } from "react-router-dom";
import { AdminShell } from "./AdminShell";

export function AdminLayout() {
  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}