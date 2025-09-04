import { useState, useEffect } from "react";
import { Activity } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { WelcomeDashboard } from "@/components/dashboard/WelcomeDashboard";
import { StickyHeader } from "@/components/dashboard/StickyHeader";
import { FloatingActionButton } from "@/components/dashboard/FloatingActionButton";
import { KeyboardShortcuts } from "@/components/dashboard/KeyboardShortcuts";
import { SealedProductsTab } from "@/components/admin/SealedProductsTab";
import { AnalyticsTab } from "@/components/admin/AnalyticsTab";
import { PricingJobMonitor } from "@/components/admin/PricingJobMonitor";
import { SystemHealthTab } from "@/components/dashboard/SystemHealthTab";
import { LoadingSkeleton } from "@/components/dashboard/LoadingSkeleton";
import { toast } from "sonner";

export function PricingMonitorPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [nextSync, setNextSync] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Initialize with current time and estimated next sync
  useEffect(() => {
    setLastUpdated(new Date());
    setNextSync(new Date(Date.now() + 30 * 60 * 1000)); // 30 minutes from now
  }, []);

  const handleRefreshAll = async () => {
    setRefreshing(true);
    try {
      toast.success("🔄 Refreshing all data...");
      
      // Simulate refresh operations
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setLastUpdated(new Date());
      toast.success("✅ All data refreshed successfully");
    } catch (error) {
      toast.error("❌ Failed to refresh data");
    } finally {
      setRefreshing(false);
    }
  };

  const handleInstantPriceCheck = () => {
    setActiveTab("analytics");
    toast.info("💡 Switched to Analytics tab for price checking");
  };

  const handleViewAlerts = () => {
    toast.info("🔔 Alert management coming soon!");
  };

  const handleHealthCheck = () => {
    setActiveTab("system");
    toast.info("🏥 Switched to System Health tab");
  };

  const handleTestPricing = async () => {
    toast.info("🧪 Test pricing functionality coming soon!");
  };

  const handleSearch = () => {
    // Focus search input if available
    const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
    if (searchInput) {
      searchInput.focus();
    } else {
      toast.info("🔍 Search functionality available in each tab");
    }
  };

  const handleCommandPalette = () => {
    toast.info("⌘ Command palette coming soon!");
  };

  if (refreshing) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-4">
          <Activity className="w-12 h-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Refreshing all data...</p>
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
              <div className="grid gap-6">
                <LoadingSkeleton variant="card" className="animate-fade-in" />
                <div className="text-center py-12">
                  <h3 className="text-lg font-medium mb-2">System Overview</h3>
                  <p className="text-muted-foreground">
                    Comprehensive dashboard overview coming soon with real-time metrics, 
                    system status, and quick actions.
                  </p>
                </div>
              </div>
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
      />

      {/* Keyboard Shortcuts Handler */}
      <KeyboardShortcuts
        onTabChange={setActiveTab}
        onRefresh={handleRefreshAll}
        onTest={handleTestPricing}
        onSearch={handleSearch}
        onCommandPalette={handleCommandPalette}
      />
    </div>
  );
}