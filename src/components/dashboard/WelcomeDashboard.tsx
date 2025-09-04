import { useEffect, useState } from "react";
import { CheckCircle, AlertTriangle, TrendingUp, Activity, Database, Bell } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "./StatusBadge";
import { supabase } from "@/integrations/supabase/client";

interface SystemStatus {
  overall: 'healthy' | 'warning' | 'error';
  issues: number;
  message: string;
}

interface QuickStats {
  cardsSynced: number;
  activeAlerts: number;
  apiUsage: number;
}

interface TopMover {
  name: string;
  change: number;
  image_url?: string;
}

export function WelcomeDashboard() {
  const [greeting, setGreeting] = useState("");
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({ 
    overall: 'healthy', 
    issues: 0, 
    message: 'All systems operational' 
  });
  const [quickStats, setQuickStats] = useState<QuickStats>({
    cardsSynced: 0,
    activeAlerts: 0,
    apiUsage: 0
  });
  const [topMovers, setTopMovers] = useState<TopMover[]>([]);

  useEffect(() => {
    // Set greeting based on time of day
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 17) setGreeting("Good afternoon");
    else setGreeting("Good evening");

    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch quick stats
      const today = new Date().toISOString().split('T')[0];
      
      // Cards synced today
      const { data: cardsData } = await supabase
        .from('cards')
        .select('*', { count: 'exact', head: true })
        .gte('updated_at', today);

      // Active alerts  
      const { data: alertsData } = await supabase
        .from('price_alerts')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // API usage today
      const { data: apiData } = await supabase
        .from('pricing_api_usage')
        .select('*', { count: 'exact', head: true })
        .gte('recorded_at', today);

      // Top price movers
      const { data: movementsData } = await supabase
        .from('price_history')
        .select(`
          percentage_change,
          cards!inner (name, image_url),
          sealed_products (name, image_url)
        `)
        .gte('recorded_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('percentage_change', { ascending: false })
        .limit(3);

      setQuickStats({
        cardsSynced: cardsData?.length || 0,
        activeAlerts: alertsData?.length || 0,
        apiUsage: Math.min(((apiData?.length || 0) / 10000) * 100, 100) // Assume 10k daily limit
      });

      if (movementsData) {
        const movers = movementsData.map(item => ({
          name: item.cards?.name || item.sealed_products?.name || 'Unknown',
          change: item.percentage_change,
          image_url: item.cards?.image_url || item.sealed_products?.image_url
        }));
        setTopMovers(movers);
      }

      // Determine system status
      const issueCount = 0; // Calculate based on your system health checks
      setSystemStatus({
        overall: issueCount === 0 ? 'healthy' : issueCount < 3 ? 'warning' : 'error',
        issues: issueCount,
        message: issueCount === 0 ? 'All systems operational' : `${issueCount} issues need attention`
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  return (
    <Card className="mb-6 animate-fade-in">
      <CardContent className="p-6">
        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {greeting}! Here's your market summary:
            </h1>
            <div className="flex items-center gap-2">
              <StatusBadge 
                status={systemStatus.overall}
                icon={systemStatus.overall === 'healthy' ? CheckCircle : AlertTriangle}
              />
              <span className="text-sm text-muted-foreground">{systemStatus.message}</span>
            </div>
          </div>
          
          {/* System Status Indicator */}
          <div className="mt-4 md:mt-0">
            <Badge variant={systemStatus.overall === 'healthy' ? 'default' : 'destructive'}>
              {systemStatus.overall === 'healthy' ? 'System Healthy' : `${systemStatus.issues} Issues`}
            </Badge>
          </div>
        </div>

        {/* Top 3 Price Movers */}
        {topMovers.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Top Price Movers (24h)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {topMovers.map((mover, index) => (
                <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  {mover.image_url ? (
                    <img 
                      src={mover.image_url} 
                      alt={mover.name}
                      className="w-8 h-8 rounded object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                      <Activity className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{mover.name}</p>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-success" />
                      <span className="text-xs text-success font-medium">+{mover.change.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-success-muted">
            <div>
              <p className="text-sm text-muted-foreground">Cards synced today</p>
              <p className="text-2xl font-bold text-success">{formatNumber(quickStats.cardsSynced)}</p>
            </div>
            <Database className="w-8 h-8 text-success" />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-info-muted">
            <div>
              <p className="text-sm text-muted-foreground">Active alerts</p>
              <p className="text-2xl font-bold text-info">{formatNumber(quickStats.activeAlerts)}</p>
            </div>
            <Bell className="w-8 h-8 text-info" />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-warning-muted">
            <div>
              <p className="text-sm text-muted-foreground">API usage</p>
              <p className="text-2xl font-bold text-warning">{quickStats.apiUsage.toFixed(0)}%</p>
            </div>
            <Activity className="w-8 h-8 text-warning" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}