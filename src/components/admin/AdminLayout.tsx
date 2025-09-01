import { useLocation, Outlet } from 'react-router-dom';
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
  Home,
  Code
} from 'lucide-react';
import { AdminTopNavigation } from './AdminTopNavigation';
import { NavLink } from 'react-router-dom';


function AdminSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? "bg-primary text-primary-foreground font-medium" : "hover:bg-accent hover:text-accent-foreground";

  // Group admin items for better organization
  const navigationGroups = [
    {
      label: "Navigation",
      items: [
        { title: 'Back to App', url: '/', icon: Home },
      ]
    },
    {
      label: "Dashboard",
      items: [
        { title: 'Overview', url: '/admin', icon: Activity },
      ]
    },
    {
      label: "Configuration", 
      items: [
        { title: 'Environment', url: '/admin/environment', icon: Settings },
        { title: 'Database', url: '/admin/database', icon: Database },
      ]
    },
    {
      label: "Operations",
      items: [
        { title: 'Sync Control', url: '/admin/sync', icon: RefreshCw },
        { title: 'Job Monitor', url: '/admin/jobs', icon: FileSearch },
      ]
    },
    {
      label: "Development",
      items: [
        { title: 'Data Browser', url: '/admin/data', icon: Search },
        { title: 'API Testing', url: '/admin/api-test', icon: TestTube },
        { title: 'Developers', url: '/admin/developers', icon: Code },
      ]
    }
  ];

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarContent className="gap-0">
        {/* Header */}
        <div className="border-b p-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {state === "expanded" && (
              <div>
                <h2 className="font-semibold text-sm">TCG Admin</h2>
                <p className="text-xs text-muted-foreground">Management Portal</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Groups */}
        <div className="flex-1 overflow-auto py-2">
          {navigationGroups.map((group, groupIndex) => (
            <SidebarGroup key={group.label} className={groupIndex > 0 ? "mt-4" : ""}>
              {state === "expanded" && (
                <SidebarGroupLabel className="text-xs font-medium text-muted-foreground px-3">
                  {group.label}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
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
          ))}
        </div>
      </SidebarContent>
    </Sidebar>
  );
}

export function AdminLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar />
        
        <div className="flex-1 flex flex-col min-w-0">
          <AdminTopNavigation />
          
          <main className="flex-1 p-4 sm:p-6 overflow-auto bg-muted/30">
            <div className="max-w-screen-2xl mx-auto">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}