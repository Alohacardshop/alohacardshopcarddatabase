import { useState, useEffect } from "react";
import { CheckCircle, AlertTriangle, Database, Bell, Activity, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface EssentialMetricsProps {
  className?: string;
}

interface SystemStatus {
  status: 'operational' | 'warning' | 'error';
  message: string;
}

interface QuickStats {
  cardsSynced: number;
  activeAlerts: number;
  apiUsage: number;
  nextSyncIn: number; // seconds
}

export function EssentialMetrics({ className = "" }: EssentialMetricsProps) {
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    status: 'operational',
    message: 'All systems operational'
  });
  
  const [stats, setStats] = useState<QuickStats>({
    cardsSynced: 47892,
    activeAlerts: 3,
    apiUsage: 67,
    nextSyncIn: 1847 // ~30 minutes
  });

  // Simulate live updates
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => ({
        ...prev,
        apiUsage: Math.max(0, Math.min(100, prev.apiUsage + (Math.random() - 0.5) * 2)),
        nextSyncIn: Math.max(0, prev.nextSyncIn - 1),
        cardsSynced: prev.cardsSynced + Math.floor(Math.random() * 3)
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational':
        return <CheckCircle className="w-5 h-5 text-success" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-warning" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-destructive" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'operational':
        return <Badge className="bg-success text-success-foreground">All Systems Operational</Badge>;
      case 'warning':
        return <Badge variant="destructive">Issues Detected</Badge>;
      default:
        return <Badge variant="destructive">System Error</Badge>;
    }
  };

  const getUsageColor = (usage: number) => {
    if (usage < 70) return 'text-success';
    if (usage < 90) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <div className={`grid gap-4 md:grid-cols-2 lg:grid-cols-4 ${className}`}>
      {/* System Status */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            {getStatusIcon(systemStatus.status)}
            System Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xl font-semibold mb-1">{systemStatus.message}</p>
              <p className="text-sm text-muted-foreground">
                Last checked: {new Date().toLocaleTimeString()}
              </p>
            </div>
            {getStatusBadge(systemStatus.status)}
          </div>
        </CardContent>
      </Card>

      {/* Cards Synced Today */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Cards Synced Today
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-success">
                {stats.cardsSynced.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">
                +{Math.floor(Math.random() * 500) + 200} in last hour
              </p>
            </div>
            <Database className="w-6 h-6 text-success" />
          </div>
        </CardContent>
      </Card>

      {/* Active Alerts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Active Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-info">
                {stats.activeAlerts}
              </p>
              <p className="text-xs text-muted-foreground">
                2 price, 1 system
              </p>
            </div>
            <Bell className="w-6 h-6 text-info" />
          </div>
        </CardContent>
      </Card>

      {/* API Usage */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            API Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className={`text-2xl font-bold ${getUsageColor(stats.apiUsage)}`}>
                {stats.apiUsage}%
              </p>
              <p className="text-xs text-muted-foreground">
                {Math.floor((500 * stats.apiUsage) / 100)}/500 requests
              </p>
            </div>
            <Activity className={`w-6 h-6 ${getUsageColor(stats.apiUsage)}`} />
          </div>
          <Progress value={stats.apiUsage} className="h-1" />
        </CardContent>
      </Card>

      {/* Next Sync Countdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Next Sync
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-primary font-mono">
                {formatTime(stats.nextSyncIn)}
              </p>
              <p className="text-xs text-muted-foreground">
                Auto-sync scheduled
              </p>
            </div>
            <Clock className="w-6 h-6 text-primary" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}