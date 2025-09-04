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
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center px-4">
        {/* Left section: Sidebar trigger + Breadcrumbs */}
        <div className="flex items-center gap-4 flex-1">
          <SidebarTrigger className="hover:bg-accent hover:text-accent-foreground" />
          
          <Separator orientation="vertical" className="h-6" />
          
          <Breadcrumb>
            <BreadcrumbList>
              {breadcrumbItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div key={item.url} className="flex items-center">
                    {index > 0 && <BreadcrumbSeparator />}
                    <BreadcrumbItem>
                      <BreadcrumbLink 
                        href={item.url}
                        className={`flex items-center gap-2 ${
                          index === breadcrumbItems.length - 1 
                            ? 'text-foreground font-medium' 
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Icon className="h-3 w-3" />
                        <span className="hidden sm:inline">{item.title}</span>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                  </div>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* Right section: Status + Admin badge + User menu */}
        <div className="flex items-center gap-3">
          {/* System Status */}
          <SystemStatusIndicator />
          
          <Separator orientation="vertical" className="h-6" />
          
          {/* Admin Mode Badge */}
          <Badge variant="default" className="text-xs font-medium">
            <Shield className="h-3 w-3 mr-1" />
            Admin
          </Badge>
          
          {/* User Menu */}
          <UserMenu />
        </div>
      </div>
    </header>
  );
};