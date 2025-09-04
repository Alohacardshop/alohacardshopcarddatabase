import { useLocation } from 'react-router-dom';
import { SidebarTrigger } from '@/components/ui/sidebar';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { SystemStatusIndicator } from './SystemStatusIndicator';
import { UserMenu } from './UserMenu';
import {
  Activity,
  Settings,
  Database,
  RefreshCw,
  FileSearch,
  Search,
  TestTube,
  Code,
  Home,
  Shield,
  DollarSign
} from 'lucide-react';

const adminPages = {
  '/admin': { title: 'Overview', icon: Activity },
  '/admin/environment': { title: 'Environment', icon: Settings },
  '/admin/database': { title: 'Database', icon: Database },
  '/admin/sync': { title: 'Sync Control', icon: RefreshCw },
  '/admin/jobs': { title: 'Job Monitor', icon: FileSearch },
  '/admin/pricing': { title: 'Pricing Monitor', icon: DollarSign },
  '/admin/data': { title: 'Data Browser', icon: Search },
  '/admin/api-test': { title: 'API Testing', icon: TestTube },
  '/admin/developers': { title: 'Developers', icon: Code },
};

export const AdminTopNavigation = () => {
  const location = useLocation();
  const currentPath = location.pathname;
  const currentPage = adminPages[currentPath as keyof typeof adminPages];

  const getBreadcrumbItems = () => {
    const items = [
      { title: 'Home', url: '/', icon: Home },
      { title: 'Admin', url: '/admin', icon: Shield }
    ];
    
    if (currentPath !== '/admin' && currentPage) {
      items.push({ 
        title: currentPage.title, 
        url: currentPath,
        icon: currentPage.icon
      });
    }
    
    return items;
  };

  const breadcrumbItems = getBreadcrumbItems();

  return (
    <header className="w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 h-14">
      <div className="flex h-full max-w-screen-2xl items-center px-4 sm:px-6 lg:px-8">
        {/* Left section: Sidebar trigger + Breadcrumbs */}
        <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
          <SidebarTrigger className="hover:bg-accent hover:text-accent-foreground shrink-0" />
          
          <Separator orientation="vertical" className="h-6 hidden sm:block" />
          
          <Breadcrumb className="min-w-0">
            <BreadcrumbList>
              {breadcrumbItems.map((item, index) => {
                const Icon = item.icon;
                const isLast = index === breadcrumbItems.length - 1;
                
                return (
                  <div key={item.url} className="flex items-center min-w-0">
                    {index > 0 && <BreadcrumbSeparator className="shrink-0" />}
                    <BreadcrumbItem className="min-w-0">
                      <BreadcrumbLink 
                        href={item.url}
                        className={`flex items-center gap-1 sm:gap-2 min-w-0 ${
                          isLast
                            ? 'text-foreground font-medium' 
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Icon className="h-3 w-3 shrink-0" />
                        <span className="truncate hidden xs:inline text-sm">
                          {item.title}
                        </span>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                  </div>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* Right section: Status + Admin badge + User menu */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* System Status - hidden on mobile */}
          <div className="hidden sm:block">
            <SystemStatusIndicator />
          </div>
          
          <Separator orientation="vertical" className="h-6 hidden sm:block" />
          
          {/* Admin Mode Badge */}
          <Badge variant="default" className="text-xs font-medium">
            <Shield className="h-3 w-3 sm:mr-1" />
            <span className="hidden sm:inline">Admin</span>
          </Badge>
          
          {/* User Menu */}
          <UserMenu />
        </div>
      </div>
    </header>
  );
};