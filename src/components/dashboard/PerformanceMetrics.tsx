import { useState, useEffect } from "react";
import { Activity, Clock, TrendingUp, Zap, CheckCircle, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CircularProgress } from "./CircularProgress";
import { SparklineChart } from "./SparklineChart";

interface PerformanceData {
  responseTime: number;
  syncSpeed: number;
  timeRemaining?: number;
  successRate: number;
  successTrend: number[];
  apiLatency: number[];
  throughput: number;
  queueSize: number;
}

interface PerformanceMetricsProps {
  data?: PerformanceData;
  isLive?: boolean;
  className?: string;
}

export function PerformanceMetrics({ 
  data,
  isLive = false,
  className = "" 
}: PerformanceMetricsProps) {
  const [liveData, setLiveData] = useState<PerformanceData>(
    data || {
      responseTime: 0,
      syncSpeed: 0,
      successRate: 0,
      successTrend: [],
      apiLatency: [],
      throughput: 0,
      queueSize: 0
    }
  );

  const [animatedValues, setAnimatedValues] = useState({
    responseTime: 0,
    syncSpeed: 0,
    successRate: 0,
    throughput: 0
  });

  // Simulate live data updates
  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(() => {
      setLiveData(prev => ({
        ...prev,
        responseTime: Math.floor(Math.random() * 100) + 50,
        syncSpeed: Math.floor(Math.random() * 100) + 300,
        successRate: 95 + Math.random() * 4,
        throughput: Math.floor(Math.random() * 50) + 100,
        queueSize: Math.floor(Math.random() * 20),
        apiLatency: [...prev.apiLatency.slice(-9), Math.floor(Math.random() * 50) + 30],
        successTrend: [...prev.successTrend.slice(-9), 95 + Math.random() * 4]
      }));
    }, 2000);

    return () => clearInterval(interval);
  }, [isLive]);

  // Animate number changes
  useEffect(() => {
    const animateValue = (start: number, end: number, duration: number = 1000) => {
      const startTime = Date.now();
      
      const updateValue = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function for smooth animation
        const eased = 1 - Math.pow(1 - progress, 3);
        return Math.round(start + (end - start) * eased);
      };

      return updateValue;
    };

    const animations = [
      { key: 'responseTime', target: liveData.responseTime },
      { key: 'syncSpeed', target: liveData.syncSpeed },
      { key: 'successRate', target: liveData.successRate },
      { key: 'throughput', target: liveData.throughput }
    ];

    const animationInterval = setInterval(() => {
      const newValues: any = {};
      let allComplete = true;

      animations.forEach(({ key, target }) => {
        const current = animatedValues[key as keyof typeof animatedValues];
        if (current !== target) {
          const diff = target - current;
          const step = Math.sign(diff) * Math.max(1, Math.abs(diff) * 0.1);
          newValues[key] = current + step;
          allComplete = false;
        } else {
          newValues[key] = target;
        }
      });

      setAnimatedValues(prev => ({ ...prev, ...newValues }));

      if (allComplete) {
        clearInterval(animationInterval);
      }
    }, 50);

    return () => clearInterval(animationInterval);
  }, [liveData, animatedValues]);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(Math.round(num));
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${Math.round(remainingSeconds)}s`;
  };

  const getLatencyStatus = (ms: number) => {
    if (ms < 100) return 'success';
    if (ms < 300) return 'warning';
    return 'danger';
  };

  const getSuccessRateStatus = (rate: number) => {
    if (rate >= 98) return 'success';
    if (rate >= 95) return 'warning';
    return 'danger';
  };

  return (
    <div className={`grid gap-4 md:grid-cols-2 lg:grid-cols-4 ${className}`}>
      {/* API Response Time */}
      <Card className="relative overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            API Response Time
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-2xl font-bold transition-all duration-500">
                {animatedValues.responseTime}ms
              </span>
              <Badge 
                variant={getLatencyStatus(liveData.responseTime) === 'success' ? 'default' : 'destructive'}
                className="ml-2"
              >
                {getLatencyStatus(liveData.responseTime) === 'success' ? 'Good' : 'Slow'}
              </Badge>
            </div>
            <Clock className={`w-6 h-6 ${
              getLatencyStatus(liveData.responseTime) === 'success' ? 'text-success' : 'text-warning'
            }`} />
          </div>
          
          {liveData.apiLatency.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">24h trend</span>
              <SparklineChart 
                data={liveData.apiLatency}
                width={60}
                height={16}
                strokeWidth={1.5}
              />
            </div>
          )}
        </CardContent>
        
        {isLive && (
          <div className="absolute top-2 right-2">
            <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
          </div>
        )}
      </Card>

      {/* Sync Speed */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Sync Speed
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-2xl font-bold transition-all duration-500">
                {formatNumber(animatedValues.syncSpeed)}
              </span>
              <span className="text-sm text-muted-foreground ml-1">cards/min</span>
            </div>
            <Zap className="w-6 h-6 text-info" />
          </div>
          
          {liveData.timeRemaining && (
            <div className="text-xs text-muted-foreground">
              Est. remaining: {formatDuration(liveData.timeRemaining)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Success Rate */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Success Rate
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold transition-all duration-500">
                {animatedValues.successRate.toFixed(1)}%
              </span>
              <TrendingUp className="w-4 h-4 text-success" />
            </div>
            <CheckCircle className={`w-6 h-6 ${
              getSuccessRateStatus(liveData.successRate) === 'success' ? 'text-success' : 'text-warning'
            }`} />
          </div>
          
          <Progress 
            value={liveData.successRate} 
            className="h-2 mb-2"
          />
          
          {liveData.successTrend.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Trend</span>
              <SparklineChart 
                data={liveData.successTrend}
                width={60}
                height={16}
                strokeWidth={1.5}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Throughput */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Throughput
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-2xl font-bold transition-all duration-500">
                {formatNumber(animatedValues.throughput)}
              </span>
              <span className="text-sm text-muted-foreground ml-1">req/min</span>
            </div>
            <Activity className="w-6 h-6 text-primary" />
          </div>
          
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Queue size</span>
              <span className="font-medium">{liveData.queueSize}</span>
            </div>
            
            {liveData.queueSize > 0 && (
              <Progress value={(liveData.queueSize / 100) * 100} className="h-1" />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}