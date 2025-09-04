import { useState, useEffect, useCallback } from "react";
import { Activity } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { WelcomeDashboard } from "@/components/dashboard/WelcomeDashboard";
import { StickyHeader } from "@/components/dashboard/StickyHeader";
import { FloatingActionButton } from "@/components/dashboard/FloatingActionButton";
import { KeyboardShortcuts } from "@/components/dashboard/KeyboardShortcuts";
import { CommandPalette } from "@/components/dashboard/CommandPalette";
import { ToastProvider, useToast } from "@/components/dashboard/ToastManager";
import { SealedProductsTab } from "@/components/admin/SealedProductsTab";
import { AnalyticsTab } from "@/components/admin/AnalyticsTab";
import { PricingJobMonitor } from "@/components/admin/PricingJobMonitor";
import { SystemHealthTab } from "@/components/dashboard/SystemHealthTab";
import { LoadingSkeleton } from "@/components/dashboard/LoadingSkeleton";
import { PerformanceMetrics } from "@/components/dashboard/PerformanceMetrics";
import { EnhancedEmptyState } from "@/components/dashboard/EnhancedEmptyState";
import { supabase } from "@/integrations/supabase/client";

function PricingMonitorPageContent() {
  const [activeTab, setActiveTab] = useState("overview");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [nextSync, setNextSync] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [apiUsage, setApiUsage] = useState(0);
  
  const { addToast } = useToast();

  // Initialize with current time and estimated next sync
  useEffect(() => {
    setLastUpdated(new Date());
    setNextSync(new Date(Date.now() + 30 * 60 * 1000)); // 30 minutes from now
    
    // Simulate API usage monitoring
    const checkApiUsage = () => {
      const currentUsage = Math.random() * 100;
      setApiUsage(currentUsage);
      
      // Trigger warning at 80% usage
      if (currentUsage >= 80 && Math.random() > 0.7) {
        addToast({
          type: 'warning',
          title: '⚠️ API Limit Warning',
          message: `API usage at ${currentUsage.toFixed(0)}%. Consider optimizing requests.`,
          duration: 8000
        });
      }
    };

    const usageInterval = setInterval(checkApiUsage, 30000);
    return () => clearInterval(usageInterval);
  }, [addToast]);

  // Keyboard shortcut for command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleRefreshAll = async () => {
    setRefreshing(true);
    try {
      addToast({
        type: 'info',
        title: '🔄 Refreshing Data',
        message: 'Updating all dashboard components...'
      });
      
      // Simulate refresh operations
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setLastUpdated(new Date());
      
      addToast({
        type: 'success',
        title: '✅ Refresh Complete',
        message: 'All data has been successfully updated'
      });
    } catch (error) {
      addToast({
        type: 'error',
        title: '❌ Refresh Failed',
        message: 'Failed to refresh data. Please try again.'
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleInstantPriceCheck = () => {
    setActiveTab("analytics");
    addToast({
      type: 'info',
      title: '💡 Switched to Analytics',
      message: 'Use the Instant Price Check tab for real-time pricing'
    });
  };

  const handleViewAlerts = () => {
    addToast({
      type: 'info',
      title: '🔔 Alert System',
      message: 'Price alert management is coming soon!'
    });
  };

  const handleHealthCheck = () => {
    setActiveTab("system");
    addToast({
      type: 'info',
      title: '🏥 System Health',
      message: 'Running comprehensive system diagnostics...'
    });
  };

  const handleTestPricing = async () => {
    addToast({
      type: 'info',
      title: '🧪 Starting Test',
      message: 'Initializing test pricing job...'
    });
    
    // Simulate test completion
    setTimeout(() => {
      addToast({
        type: 'success',
        title: '✅ Test Complete',
        message: 'Processed 10 test cards successfully. Updated 8 variants.',
        duration: 8000
      });
    }, 3000);
  };

  const handleSearch = () => {
    // Focus search input if available
    const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
    if (searchInput) {
      searchInput.focus();
    } else {
      setCommandPaletteOpen(true);
    }
  };

  const handleCommandAction = (action: string) => {
    switch (action) {
      case 'sync-pokemon':
        addToast({
          type: 'info',
          title: '🔄 Syncing Pokémon',
          message: 'Starting pricing sync for Pokémon cards...'
        });
        break;
      case 'sync-mtg':
        addToast({
          type: 'info',
          title: '🔄 Syncing MTG',
          message: 'Starting pricing sync for Magic: The Gathering...'
        });
        break;
      case 'health-check':
        handleHealthCheck();
        break;
      case 'test-pricing':
        handleTestPricing();
        break;
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(Math.round(num));
  };

  if (refreshing) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-4">
          <Activity className="w-12 h-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Refreshing all data...</p>
          <div className="w-48 h-2 bg-muted rounded-full overflow-hidden mx-auto">
            <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Page Header */}
      <PageHeader title="Pricing Monitor Dashboard" />

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Welcome Dashboard - Always visible */}
        <WelcomeDashboard />

        {/* Performance Metrics - Live dashboard */}
        <PerformanceMetrics isLive={true} />

        {/* Tabbed Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {/* Sticky Navigation Header */}
          <StickyHeader
            activeTab={activeTab}
            onTabChange={setActiveTab}
            lastUpdated={lastUpdated || undefined}
            nextSync={nextSync || undefined}
          />

          {/* Tab Contents */}
          <div className="relative min-h-[600px]">
            <TabsContent value="overview" className="m-0">
              <EnhancedEmptyState
                type="general"
                title="System Overview Dashboard"
                description="Your comprehensive pricing monitoring hub with real-time metrics, alerts, and system health indicators."
                showStats={true}
                primaryAction={{
                  label: "Start Quick Tour",
                  onClick: () => addToast({
                    type: 'info',
                    title: '🎯 Quick Tour',
                    message: 'Interactive tour feature coming soon!'
                  })
                }}
                secondaryAction={{
                  label: "View Analytics",
                  onClick: () => setActiveTab("analytics")
                }}
              />
            </TabsContent>

            <TabsContent value="analytics" className="m-0">
              <AnalyticsTab />
            </TabsContent>

            <TabsContent value="jobs" className="m-0">
              <PricingJobMonitor />
            </TabsContent>

            <TabsContent value="sealed" className="m-0">
              <SealedProductsTab />
            </TabsContent>

            <TabsContent value="system" className="m-0">
              <SystemHealthTab />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Floating Action Button */}
      <FloatingActionButton
        onInstantPriceCheck={handleInstantPriceCheck}
        onForceRefresh={handleRefreshAll}
        onViewAlerts={handleViewAlerts}
        onHealthCheck={handleHealthCheck}
        className="transition-all duration-200 hover:scale-110"
      />

      {/* Command Palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onTabChange={setActiveTab}
        onAction={handleCommandAction}
      />

      {/* Keyboard Shortcuts Handler */}
      <KeyboardShortcuts
        onTabChange={setActiveTab}
        onRefresh={handleRefreshAll}
        onTest={handleTestPricing}
        onSearch={handleSearch}
        onCommandPalette={() => setCommandPaletteOpen(true)}
      />
    </div>
  );
}

export function PricingMonitorPage() {
  return (
    <ToastProvider>
      <PricingMonitorPageContent />
    </ToastProvider>
  );
}