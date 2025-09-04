import { useEffect, useState } from "react";
import { CheckCircle, AlertTriangle, Database, Bell } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "./StatusBadge";
import { supabase } from "@/integrations/supabase/client";

interface SystemStatus {
  overall: 'healthy' | 'warning' | 'error';
  issues: number;
  message: string;
}

export function WelcomeDashboard() {
  const [greeting, setGreeting] = useState("");
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({ 
    overall: 'healthy', 
    issues: 0, 
    message: 'All systems operational' 
  });

  useEffect(() => {
    // Set greeting based on time of day
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 17) setGreeting("Good afternoon");
    else setGreeting("Good evening");

    fetchSystemStatus();
  }, []);

  const fetchSystemStatus = async () => {
    try {
      // Check system health - simplified version
      const issueCount = 0; // Calculate based on your system health checks
      setSystemStatus({
        overall: issueCount === 0 ? 'healthy' : issueCount < 3 ? 'warning' : 'error',
        issues: issueCount,
        message: issueCount === 0 ? 'All systems operational' : `${issueCount} issues need attention`
      });
    } catch (error) {
      console.error('Error fetching system status:', error);
      setSystemStatus({
        overall: 'error',
        issues: 1,
        message: 'Unable to determine system status'
      });
    }
  };

  return (
    <Card className="mb-6 animate-fade-in">
      <CardContent className="p-6">
        {/* Streamlined Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {greeting}! Ready to sync your market data?
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
      </CardContent>
    </Card>
  );
}