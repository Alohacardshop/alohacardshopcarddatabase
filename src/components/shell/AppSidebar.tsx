import { NavLink, useLocation } from "react-router-dom";
import { 
  BarChart3, 
  Database, 
  Calendar, 
  Settings, 
  Users, 
  FileText,
  TrendingUp,
  Shield
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const menuItems = [
  {
    title: "Overview",
    url: "/admin",
    icon: BarChart3,
    exact: true
  },
  {
    title: "Pricing Monitor",
    url: "/admin/pricing",
    icon: TrendingUp
  },
  {
    title: "Scheduled Jobs",
    url: "/admin/scheduled-jobs",
    icon: Calendar
  },
  {
    title: "Database",
    url: "/admin/database",
    icon: Database
  },
  {
    title: "Users",
    url: "/admin/users",
    icon: Users
  },
  {
    title: "API Testing",
    url: "/admin/api-testing",
    icon: Shield
  },
  {
    title: "Logs",
    url: "/admin/logs",
    icon: FileText
  },
  {
    title: "Settings",
    url: "/admin/settings",
    icon: Settings
  }
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();

  const isActive = (path: string, exact: boolean = false) => {
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const getNavClassName = (path: string, exact: boolean = false) => {
    const active = isActive(path, exact);
    return active 
      ? "bg-accent text-accent-foreground font-medium" 
      : "hover:bg-accent/50";
  };

  const isCollapsed = state === "collapsed";

  return (
    <Sidebar className={isCollapsed ? "w-14" : "w-72"} collapsible="icon">
      <SidebarContent className="pt-6">
        <SidebarGroup>
          <SidebarGroupLabel className={isCollapsed ? "sr-only" : ""}>
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      className={getNavClassName(item.url, item.exact)}
                      title={isCollapsed ? item.title : undefined}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}