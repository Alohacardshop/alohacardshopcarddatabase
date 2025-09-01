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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  Settings,
  Database,
  RefreshCw,
  Activity,
  FileSearch,
  Search,
  TestTube,
  Shield,
  Home,
  ChevronRight,
  Bell,
  User,
  Code
} from 'lucide-react';

const adminMenuItems = [
  { title: 'Overview', url: '/admin', icon: Activity },
  { title: 'Environment', url: '/admin/environment', icon: Settings },
  { title: 'Database', url: '/admin/database', icon: Database },
  { title: 'Sync Control', url: '/admin/sync', icon: RefreshCw },
  { title: 'Job Monitor', url: '/admin/jobs', icon: FileSearch },
  { title: 'Data Browser', url: '/admin/data', icon: Search },
  { title: 'API Testing', url: '/admin/api-test', icon: TestTube },
  { title: 'Developers', url: '/admin/developers', icon: Code },
];

function AdminTopNav() {
  const location = useLocation();
  const currentPath = location.pathname;
  
  const getCurrentPageTitle = () => {
    const currentItem = adminMenuItems.find(item => item.url === currentPath);
    return currentItem?.title || 'Admin';
  };

  const getBreadcrumbItems = () => {
    const pathSegments = currentPath.split('/').filter(Boolean);
    const items = [
      { title: 'Home', url: '/' },
      { title: 'Admin', url: '/admin' }
    ];
    
    if (currentPath !== '/admin') {
      const currentItem = adminMenuItems.find(item => item.url === currentPath);
      if (currentItem) {
        items.push({ title: currentItem.title, url: currentItem.url });
      }
    }
    
    return items;
  };

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4">
        <div className="mr-4 flex">
          <SidebarTrigger />
        </div>
        
        <div className="flex items-center space-x-4 flex-1">
          <Breadcrumb>
            <BreadcrumbList>
              {getBreadcrumbItems().map((item, index) => (
                <div key={item.url} className="flex items-center">
                  {index > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <NavLink 
                        to={item.url}
                        className={index === getBreadcrumbItems().length - 1 ? 'text-foreground font-medium' : 'text-muted-foreground'}
                      >
                        {item.title}
                      </NavLink>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                </div>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex items-center space-x-2">
          <Badge variant="secondary" className="text-xs">
            Admin Mode
          </Badge>
          
          <div className="flex items-center space-x-1">
            {adminMenuItems.map((item) => (
              <Button
                key={item.url}
                variant={currentPath === item.url ? "default" : "ghost"}
                size="sm"
                asChild
                className="h-8 px-2"
              >
                <NavLink to={item.url} end={item.url === '/admin'}>
                  <item.icon className="h-3 w-3 mr-1" />
                  <span className="hidden lg:inline">{item.title}</span>
                </NavLink>
              </Button>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}

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
          <AdminTopNav />
          
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}