import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@supabase/supabase-js';
import {
  TestTube,
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  Activity,
  Clock,
  Zap,
  Copy,
  RotateCcw
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

interface APITestResult {
  success: boolean;
  status: number;
  statusText: string;
  data: any;
  error?: string;
  duration: number;
  timestamp: string;
}

interface RateLimitStatus {
  requests: number;
  maxRequests: number;
  windowRemaining: number;
  requestsRemaining: number;
}

export function APITesting() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedEndpoint, setSelectedEndpoint] = useState('games');
  const [gameSlug, setGameSlug] = useState('mtg');
  const [setCode, setSetCode] = useState('');
  const [cardQuery, setCardQuery] = useState('Lightning Bolt');
  const [customEndpoint, setCustomEndpoint] = useState('');
  const [testResult, setTestResult] = useState<APITestResult | null>(null);
  const [rateLimitStatus, setRateLimitStatus] = useState<RateLimitStatus | null>(null);

  const endpoints = [
    { value: 'games', label: 'Get Games', description: 'Fetch all available games' },
    { value: 'sets', label: 'Get Sets', description: 'Fetch sets for a specific game' },
    { value: 'cards', label: 'Get Cards', description: 'Fetch cards for a specific set' },
    { value: 'search', label: 'Search Cards', description: 'Search cards by name' },
    { value: 'health', label: 'Health Check', description: 'Check API health status' },
    { value: 'custom', label: 'Custom Endpoint', description: 'Test a custom API endpoint' }
  ];

  useEffect(() => {
    fetchRateLimitStatus();
  }, []);

  const fetchRateLimitStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('health-check');
      
      if (error) return;

      if (data.services?.justtcg_api?.rate_limit) {
        setRateLimitStatus(data.services.justtcg_api.rate_limit);
      }
    } catch (error) {
      console.error('Failed to fetch rate limit status:', error);
    }
  };

  const testEndpoint = async () => {
    setLoading(true);
    const startTime = Date.now();
    
    try {
      let result: APITestResult;

      switch (selectedEndpoint) {
        case 'games':
          result = await testGamesEndpoint();
          break;
        case 'sets':
          result = await testSetsEndpoint();
          break;
        case 'cards':
          result = await testCardsEndpoint();
          break;
        case 'search':
          result = await testSearchEndpoint();
          break;
        case 'health':
          result = await testHealthEndpoint();
          break;
        case 'custom':
          result = await testCustomEndpoint();
          break;
        default:
          throw new Error('Unknown endpoint');
      }

      result.duration = Date.now() - startTime;
      result.timestamp = new Date().toISOString();
      
      setTestResult(result);
      
      // Refresh rate limit status
      await fetchRateLimitStatus();

      toast({
        title: result.success ? 'Test Successful' : 'Test Failed',
        description: `${selectedEndpoint} endpoint test completed in ${result.duration}ms`,
        variant: result.success ? 'default' : 'destructive'
      });
    } catch (error) {
      const result: APITestResult = {
        success: false,
        status: 0,
        statusText: 'Error',
        data: null,
        error: error.message,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
      
      setTestResult(result);
      
      toast({
        title: 'Test Failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const testGamesEndpoint = async (): Promise<APITestResult> => {
    const response = await fetch('https://api.justtcg.com/v1/games', {
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_JUSTTCG_API_KEY || 'test-key'}`
      }
    });

    return {
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      data: response.ok ? await response.json() : await response.text(),
      duration: 0,
      timestamp: ''
    };
  };

  const testSetsEndpoint = async (): Promise<APITestResult> => {
    if (!gameSlug) throw new Error('Game slug is required');

    const response = await fetch(`https://api.justtcg.com/v1/games/${gameSlug}/sets?limit=10`, {
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_JUSTTCG_API_KEY || 'test-key'}`
      }
    });

    return {
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      data: response.ok ? await response.json() : await response.text(),
      duration: 0,
      timestamp: ''
    };
  };

  const testCardsEndpoint = async (): Promise<APITestResult> => {
    if (!gameSlug || !setCode) throw new Error('Game slug and set code are required');

    const response = await fetch(`https://api.justtcg.com/v1/games/${gameSlug}/sets/${setCode}/cards?limit=10`, {
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_JUSTTCG_API_KEY || 'test-key'}`
      }
    });

    return {
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      data: response.ok ? await response.json() : await response.text(),
      duration: 0,
      timestamp: ''
    };
  };

  const testSearchEndpoint = async (): Promise<APITestResult> => {
    if (!cardQuery) throw new Error('Search query is required');

    const params = new URLSearchParams({
      q: cardQuery,
      limit: '10'
    });

    const response = await fetch(`https://api.justtcg.com/v1/cards/search?${params}`, {
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_JUSTTCG_API_KEY || 'test-key'}`
      }
    });

    return {
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      data: response.ok ? await response.json() : await response.text(),
      duration: 0,
      timestamp: ''
    };
  };

  const testHealthEndpoint = async (): Promise<APITestResult> => {
    const { data, error } = await supabase.functions.invoke('health-check');

    return {
      success: !error,
      status: error ? 500 : 200,
      statusText: error ? 'Error' : 'OK',
      data: error ? { error: error.message } : data,
      error: error?.message,
      duration: 0,
      timestamp: ''
    };
  };

  const testCustomEndpoint = async (): Promise<APITestResult> => {
    if (!customEndpoint) throw new Error('Custom endpoint URL is required');

    const response = await fetch(customEndpoint, {
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_JUSTTCG_API_KEY || 'test-key'}`
      }
    });

    return {
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      data: response.ok ? await response.json() : await response.text(),
      duration: 0,
      timestamp: ''
    };
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: 'Response copied to clipboard'
    });
  };

  const resetTest = () => {
    setTestResult(null);
    setGameSlug('mtg');
    setSetCode('');
    setCardQuery('Lightning Bolt');
    setCustomEndpoint('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">API Testing Tools</h1>
        <p className="text-muted-foreground">Test JustTCG API endpoints and monitor performance</p>
      </div>

      {/* Rate Limit Status */}
      {rateLimitStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Rate Limit Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {rateLimitStatus.requests}
                </div>
                <div className="text-sm text-muted-foreground">Requests Used</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-secondary">
                  {rateLimitStatus.requestsRemaining}
                </div>
                <div className="text-sm text-muted-foreground">Remaining</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-accent">
                  {rateLimitStatus.maxRequests}
                </div>
                <div className="text-sm text-muted-foreground">Max/Window</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-muted-foreground">
                  {Math.round(rateLimitStatus.windowRemaining / 1000)}s
                </div>
                <div className="text-sm text-muted-foreground">Reset Time</div>
              </div>
            </div>

            <div className="mt-4">
              <div className="bg-secondary rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ 
                    width: `${(rateLimitStatus.requests / rateLimitStatus.maxRequests) * 100}%` 
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            API Endpoint Testing
          </CardTitle>
          <CardDescription>
            Configure and test various JustTCG API endpoints
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="endpoint">Endpoint</Label>
              <Select value={selectedEndpoint} onValueChange={setSelectedEndpoint}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {endpoints.map((endpoint) => (
                    <SelectItem key={endpoint.value} value={endpoint.value}>
                      {endpoint.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {endpoints.find(e => e.value === selectedEndpoint)?.description}
              </p>
            </div>

            {selectedEndpoint === 'custom' && (
              <div className="space-y-2">
                <Label htmlFor="custom-endpoint">Custom URL</Label>
                <Input
                  id="custom-endpoint"
                  value={customEndpoint}
                  onChange={(e) => setCustomEndpoint(e.target.value)}
                  placeholder="https://api.justtcg.com/v1/..."
                />
              </div>
            )}
          </div>

          {/* Endpoint-specific parameters */}
          {(selectedEndpoint === 'sets' || selectedEndpoint === 'cards') && (
            <div className="space-y-2">
              <Label htmlFor="game-slug">Game Slug</Label>
              <Input
                id="game-slug"
                value={gameSlug}
                onChange={(e) => setGameSlug(e.target.value)}
                placeholder="mtg, pokemon, yugioh"
              />
            </div>
          )}

          {selectedEndpoint === 'cards' && (
            <div className="space-y-2">
              <Label htmlFor="set-code">Set Code</Label>
              <Input
                id="set-code"
                value={setCode}
                onChange={(e) => setSetCode(e.target.value)}
                placeholder="e.g., LEA, BOS, etc."
              />
            </div>
          )}

          {selectedEndpoint === 'search' && (
            <div className="space-y-2">
              <Label htmlFor="search-query">Search Query</Label>
              <Input
                id="search-query"
                value={cardQuery}
                onChange={(e) => setCardQuery(e.target.value)}
                placeholder="Card name to search for"
              />
            </div>
          )}

          <Separator />

          <div className="flex gap-2">
            <Button onClick={testEndpoint} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Run Test
            </Button>
            <Button variant="outline" onClick={resetTest}>
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
            <Button variant="outline" onClick={fetchRateLimitStatus}>
              <Activity className="h-4 w-4" />
              Refresh Status
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Test Results */}
      {testResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {testResult.success ? 
                <CheckCircle className="h-5 w-5 text-green-500" /> : 
                <XCircle className="h-5 w-5 text-red-500" />
              }
              Test Results
            </CardTitle>
            <CardDescription>
              <div className="flex items-center gap-4 text-sm">
                <Badge variant={testResult.success ? 'default' : 'destructive'}>
                  {testResult.status} {testResult.statusText}
                </Badge>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {testResult.duration}ms
                </div>
                <div className="flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  {new Date(testResult.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {testResult.error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                  <p className="text-destructive font-medium">Error:</p>
                  <p className="text-destructive text-sm">{testResult.error}</p>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Response Data</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(JSON.stringify(testResult.data, null, 2))}
                  >
                    <Copy className="h-3 w-3" />
                    Copy
                  </Button>
                </div>
                <Textarea
                  value={JSON.stringify(testResult.data, null, 2)}
                  readOnly
                  className="font-mono text-xs min-h-64"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}