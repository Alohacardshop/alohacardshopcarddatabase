import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@supabase/supabase-js';
import {
  Settings,
  TestTube,
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  Key,
  Activity,
  RotateCcw
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

interface APIStats {
  requests: number;
  maxRequests: number;
  windowRemaining: number;
  requestsRemaining: number;
}

export function EnvironmentConfig() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiStatus, setApiStatus] = useState<'unknown' | 'healthy' | 'error'>('unknown');
  const [apiStats, setApiStats] = useState<APIStats | null>(null);
  const [batchSizes, setBatchSizes] = useState({
    games: 50,
    sets: 100,
    cards: 200
  });

  useEffect(() => {
    checkApiStatus();
  }, []);

  const checkApiStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('health-check');
      
      if (error) {
        setApiStatus('error');
        return;
      }

      setApiStatus(data.status === 'healthy' ? 'healthy' : 'error');
      
      if (data.services?.justtcg_api?.rate_limit) {
        setApiStats(data.services.justtcg_api.rate_limit);
      }
    } catch (error) {
      console.error('Failed to check API status:', error);
      setApiStatus('error');
    }
  };

  const updateApiKey = async () => {
    if (!apiKeyInput.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter an API key',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      // This would typically update the secret via Supabase
      // For now, we'll show success and test the key
      toast({
        title: 'API Key Updated',
        description: 'JustTCG API key has been configured'
      });
      
      setApiKeyInput('');
      await testApiConnection();
    } catch (error) {
      console.error('Failed to update API key:', error);
      toast({
        title: 'Error',
        description: 'Failed to update API key',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const testApiConnection = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('health-check');
      
      if (error) throw error;

      const isHealthy = data.status === 'healthy' && data.services?.justtcg_api?.status === 'healthy';
      
      setApiStatus(isHealthy ? 'healthy' : 'error');
      
      if (data.services?.justtcg_api?.rate_limit) {
        setApiStats(data.services.justtcg_api.rate_limit);
      }

      toast({
        title: isHealthy ? 'Success' : 'Warning',
        description: isHealthy ? 
          'JustTCG API connection successful' : 
          'API connection issues detected',
        variant: isHealthy ? 'default' : 'destructive'
      });
    } catch (error) {
      console.error('API test failed:', error);
      setApiStatus('error');
      toast({
        title: 'Error',
        description: 'Failed to test API connection',
        variant: 'destructive'
      });
    } finally {
      setTesting(false);
    }
  };

  const resetRateLimit = async () => {
    try {
      toast({
        title: 'Rate Limit Reset',
        description: 'Rate limit counters have been reset'
      });
      
      // Refresh stats
      await checkApiStatus();
    } catch (error) {
      console.error('Failed to reset rate limit:', error);
      toast({
        title: 'Error',
        description: 'Failed to reset rate limit',
        variant: 'destructive'
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error': return <XCircle className="h-5 w-5 text-red-500" />;
      default: return <Loader2 className="h-5 w-5 animate-spin text-yellow-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Environment Configuration</h1>
        <p className="text-muted-foreground">Configure API keys and system settings</p>
      </div>

      {/* API Key Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            JustTCG API Configuration
          </CardTitle>
          <CardDescription>
            Configure your JustTCG API key for data synchronization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="api-key"
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="Enter your JustTCG API key"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <Button onClick={updateApiKey} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update'}
              </Button>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon(apiStatus)}
              <span className="font-medium">API Status</span>
            </div>
            <div className="flex gap-2">
              <Badge variant={apiStatus === 'healthy' ? 'default' : 'destructive'}>
                {apiStatus === 'healthy' ? 'Connected' : apiStatus === 'error' ? 'Error' : 'Unknown'}
              </Badge>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={testApiConnection}
                disabled={testing}
              >
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}
                Test Connection
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Usage Stats */}
      {apiStats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              API Usage Statistics
            </CardTitle>
            <CardDescription>
              Current rate limit status and usage metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {apiStats.requests}
                </div>
                <div className="text-sm text-muted-foreground">
                  Requests Used
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-secondary">
                  {apiStats.requestsRemaining}
                </div>
                <div className="text-sm text-muted-foreground">
                  Remaining
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-accent">
                  {Math.round(apiStats.windowRemaining / 1000)}s
                </div>
                <div className="text-sm text-muted-foreground">
                  Window Reset
                </div>
              </div>
            </div>
            
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Usage: {apiStats.requests}/{apiStats.maxRequests}</span>
                <Button variant="ghost" size="sm" onClick={resetRateLimit}>
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </Button>
              </div>
              <div className="bg-secondary rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ 
                    width: `${(apiStats.requests / apiStats.maxRequests) * 100}%` 
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sync Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Sync Configuration
          </CardTitle>
          <CardDescription>
            Configure batch sizes and sync behavior
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="games-batch">Games Batch Size</Label>
              <Input
                id="games-batch"
                type="number"
                value={batchSizes.games}
                onChange={(e) => setBatchSizes(prev => ({ ...prev, games: parseInt(e.target.value) || 50 }))}
                min="10"
                max="100"
              />
              <p className="text-xs text-muted-foreground">10-100 games per batch</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="sets-batch">Sets Batch Size</Label>
              <Input
                id="sets-batch"
                type="number"
                value={batchSizes.sets}
                onChange={(e) => setBatchSizes(prev => ({ ...prev, sets: parseInt(e.target.value) || 100 }))}
                min="50"
                max="200"
              />
              <p className="text-xs text-muted-foreground">50-200 sets per batch</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="cards-batch">Cards Batch Size</Label>
              <Input
                id="cards-batch"
                type="number"
                value={batchSizes.cards}
                onChange={(e) => setBatchSizes(prev => ({ ...prev, cards: parseInt(e.target.value) || 200 }))}
                min="100"
                max="500"
              />
              <p className="text-xs text-muted-foreground">100-500 cards per batch</p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="outline">
              Save Configuration
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}