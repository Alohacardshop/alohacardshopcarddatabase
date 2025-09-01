import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, Check, Activity, Code, Database } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const SUPABASE_URL = "https://dhyvufggodqkcjbrjhxk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoeXZ1Zmdnb2Rxa2NqYnJqaHhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1MDIyOTcsImV4cCI6MjA3MjA3ODI5N30.0GncadcSHVbthqyubXLiBflm44sFEz_izfF5uF-xEvs";

export const Developers = () => {
  const [copiedField, setCopiedField] = useState<string>("");
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ status: 'success' | 'error'; message: string } | null>(null);
  const { toast } = useToast();

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(""), 2000);
      toast({
        title: "Copied!",
        description: `${field} copied to clipboard`,
      });
    } catch (err) {
      toast({
        title: "Copy failed",
        description: "Please copy manually",
        variant: "destructive",
      });
    }
  };

  const testConnection = async () => {
    setIsTestingConnection(true);
    setTestResult(null);
    
    try {
      const startTime = Date.now();
      
      // Test database connection
      const { data, error } = await supabase
        .from('games')
        .select('id, name')
        .limit(1);
      
      const latency = Date.now() - startTime;
      
      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }
      
      // Test health check function
      const healthStartTime = Date.now();
      const healthResponse = await fetch(`${SUPABASE_URL}/functions/v1/health-check`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      });
      
      const healthLatency = Date.now() - healthStartTime;
      
      if (!healthResponse.ok) {
        throw new Error(`Health check failed: ${healthResponse.status}`);
      }
      
      const healthData = await healthResponse.json();
      
      setTestResult({
        status: 'success',
        message: `✅ Connection successful! DB: ${latency}ms | Health: ${healthLatency}ms | Games: ${data?.length || 0} found`
      });
      
      toast({
        title: "Connection Test Passed",
        description: `Database responding in ${latency}ms, Health check in ${healthLatency}ms`,
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setTestResult({
        status: 'error',
        message: `❌ Connection failed: ${errorMessage}`
      });
      
      toast({
        title: "Connection Test Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const CodeBlock = ({ children, className = "" }: { children: string; className?: string }) => (
    <pre className={`bg-muted p-4 rounded-lg overflow-x-auto text-sm ${className}`}>
      <code>{children}</code>
    </pre>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Developer Integration</h1>
          <p className="text-muted-foreground mt-2">
            Connect your applications to this TCG database service
          </p>
        </div>
        <Button 
          onClick={testConnection} 
          disabled={isTestingConnection}
          className="flex items-center gap-2"
        >
          <Activity className="h-4 w-4" />
          {isTestingConnection ? 'Testing...' : 'Test Connection'}
        </Button>
      </div>

      {testResult && (
        <Alert className={testResult.status === 'success' ? 'border-green-500 bg-green-50' : ''}>
          <AlertDescription>
            {testResult.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Connection Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Connection Details
          </CardTitle>
          <CardDescription>
            Your Supabase project credentials for connecting external applications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Supabase URL</label>
            <div className="flex items-center gap-2 mt-1">
              <code className="bg-muted px-2 py-1 rounded text-sm flex-1">{SUPABASE_URL}</code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(SUPABASE_URL, 'URL')}
              >
                {copiedField === 'URL' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          
          <div>
            <label className="text-sm font-medium text-foreground">Anonymous Key (Public)</label>
            <div className="flex items-center gap-2 mt-1">
              <code className="bg-muted px-2 py-1 rounded text-sm flex-1 truncate">{SUPABASE_ANON_KEY}</code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(SUPABASE_ANON_KEY, 'Anon Key')}
              >
                {copiedField === 'Anon Key' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Safe to use in frontend applications. Provides read-only access to public data.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Code Examples */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Integration Examples
          </CardTitle>
          <CardDescription>
            Ready-to-use code snippets for different platforms and languages
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="frontend" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="frontend">Frontend (JS/TS)</TabsTrigger>
              <TabsTrigger value="backend">Backend (Node.js)</TabsTrigger>
              <TabsTrigger value="rest">REST API</TabsTrigger>
              <TabsTrigger value="functions">Edge Functions</TabsTrigger>
            </TabsList>
            
            <TabsContent value="frontend" className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Installation</h4>
                <CodeBlock>{`npm install @supabase/supabase-js`}</CodeBlock>
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">Setup & Usage</h4>
                <CodeBlock>{`import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  '${SUPABASE_URL}',
  '${SUPABASE_ANON_KEY}'
)

// Fetch all games
const { data: games } = await supabase
  .from('games')
  .select('*')
  .eq('is_active', true)

// Search cards
const { data: cards } = await supabase
  .from('cards')
  .select('*, sets(name, game_id), games(name)')
  .ilike('name', '%pikachu%')
  .limit(10)

// Get card variants with prices
const { data: variants } = await supabase
  .from('variants')
  .select('*, cards(name, sets(name))')
  .eq('card_id', 'some-card-id')
  .eq('is_available', true)`}</CodeBlock>
              </div>
            </TabsContent>
            
            <TabsContent value="backend" className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Server-side with Service Role (Admin Access)</h4>
                <CodeBlock>{`import { createClient } from '@supabase/supabase-js'

// Use service role key for admin operations (keep secret!)
const supabaseAdmin = createClient(
  '${SUPABASE_URL}',
  'YOUR_SERVICE_ROLE_KEY_HERE', // Get from Supabase dashboard
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// Bypass RLS policies (admin access)
const { data: allData } = await supabaseAdmin
  .from('variants')
  .select('*')
  // No RLS restrictions with service role

// Example: Bulk operations
const { error } = await supabaseAdmin
  .from('cards')
  .insert([
    { name: 'New Card', set_id: 'uuid-here' },
    // ... more cards
  ])`}</CodeBlock>
              </div>
            </TabsContent>
            
            <TabsContent value="rest" className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Direct REST API Calls</h4>
                <CodeBlock>{`# Get all active games
curl -X GET '${SUPABASE_URL}/rest/v1/games?is_active=eq.true&select=*' \\
  -H "apikey: ${SUPABASE_ANON_KEY}" \\
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}"

# Search cards by name
curl -X GET '${SUPABASE_URL}/rest/v1/cards?name=ilike.*pikachu*&select=*,sets(name)' \\
  -H "apikey: ${SUPABASE_ANON_KEY}" \\
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}"

# Get card variants with pricing
curl -X GET '${SUPABASE_URL}/rest/v1/variants?is_available=eq.true&select=*,cards(name)' \\
  -H "apikey: ${SUPABASE_ANON_KEY}" \\
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}"

# Advanced: Use the search function
curl -X POST '${SUPABASE_URL}/rest/v1/rpc/search_cards' \\
  -H "apikey: ${SUPABASE_ANON_KEY}" \\
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{"search_query": "pikachu", "limit_count": 10}'`}</CodeBlock>
              </div>
            </TabsContent>
            
            <TabsContent value="functions" className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Edge Functions</h4>
                <CodeBlock>{`# Health Check
curl -X POST '${SUPABASE_URL}/functions/v1/health-check' \\
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \\
  -H "Content-Type: application/json"

# Discover new games
curl -X POST '${SUPABASE_URL}/functions/v1/discover-games' \\
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \\
  -H "Content-Type: application/json"

# Discover sets for a game
curl -X POST '${SUPABASE_URL}/functions/v1/discover-sets' \\
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{"game_slug": "magic-the-gathering"}'

# Import cards for a set
curl -X POST '${SUPABASE_URL}/functions/v1/justtcg-import' \\
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{"set_code": "neo", "game_slug": "magic-the-gathering"}'

# Refresh variant pricing
curl -X POST '${SUPABASE_URL}/functions/v1/justtcg-refresh-variants' \\
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{"game_slug": "magic-the-gathering", "limit": 100}'`}</CodeBlock>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Available Data */}
      <Card>
        <CardHeader>
          <CardTitle>Available Tables & Access</CardTitle>
          <CardDescription>
            Public data accessible via the anonymous key
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold text-foreground">Read Access (Public)</h4>
              <div className="space-y-1">
                <Badge variant="secondary">games</Badge> - Trading card games
                <Badge variant="secondary">sets</Badge> - Card sets/expansions  
                <Badge variant="secondary">cards</Badge> - Individual cards
                <Badge variant="secondary">variants</Badge> - Card variants with pricing
                <Badge variant="secondary">popular_cards</Badge> - Trending cards view
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-semibold text-foreground">Admin Only</h4>
              <div className="space-y-1">
                <Badge variant="outline">sync_jobs</Badge> - Background job status
                <Badge variant="outline">user_roles</Badge> - User permissions
                <Badge variant="outline">database_stats</Badge> - System statistics
              </div>
              <p className="text-xs text-muted-foreground">
                Requires service role key for write access
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
