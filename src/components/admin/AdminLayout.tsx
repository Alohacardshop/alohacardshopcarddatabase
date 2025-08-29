import { useState } from 'react';
import { NavLink, useLocation, Outlet } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Settings,
  Database,
  RefreshCw,
  Activity,
  FileSearch,
  Search,
  TestTube,
  Shield,
  Home
} from 'lucide-react';

const adminMenuItems = [
  { title: 'Overview', url: '/admin', icon: Activity },
  { title: 'Environment', url: '/admin/environment', icon: Settings },
  { title: 'Database', url: '/admin/database', icon: Database },
  { title: 'Sync Control', url: '/admin/sync', icon: RefreshCw },
  { title: 'Job Monitor', url: '/admin/jobs', icon: FileSearch },
  { title: 'Data Browser', url: '/admin/data', icon: Search },
  { title: 'API Testing', url: '/admin/api-test', icon: TestTube },
];

function AdminSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path: string) => currentPath === path;
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? "bg-primary text-primary-foreground font-medium" : "hover:bg-accent hover:text-accent-foreground";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            {state === "expanded" && "TCG Admin"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/" className="hover:bg-accent hover:text-accent-foreground">
                    <Home className="h-4 w-4" />
                    {state === "expanded" && <span>Back to App</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {adminMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      end={item.url === '/admin'}
                      className={getNavCls}
                    >
                      <item.icon className="h-4 w-4" />
                      {state === "expanded" && <span>{item.title}</span>}
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

export function AdminLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar />
        
        <div className="flex-1 flex flex-col">
          <header className="h-16 border-b bg-card flex items-center px-6">
            <SidebarTrigger />
            <div className="ml-4">
              <h1 className="text-2xl font-bold text-foreground">TCG Database Admin</h1>
              <p className="text-sm text-muted-foreground">Comprehensive management interface</p>
            </div>
          </header>
          
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}