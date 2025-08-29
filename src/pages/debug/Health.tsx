import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';

interface HealthCheck {
  name: string;
  status: 'healthy' | 'warning' | 'error';
  message: string;
  details?: any;
}

export default function Health() {
  const { user, session } = useAuth();
  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [loading, setLoading] = useState(true);

  const runHealthChecks = async () => {
    setLoading(true);
    const newChecks: HealthCheck[] = [];

    // Check 1: Supabase Connection
    try {
      const { data, error } = await supabase.from('games').select('count', { count: 'exact', head: true });
      newChecks.push({
        name: 'Supabase Connection',
        status: error ? 'error' : 'healthy',
        message: error ? `Connection failed: ${error.message}` : 'Connected successfully',
        details: error ? error : { count: data }
      });
    } catch (error) {
      newChecks.push({
        name: 'Supabase Connection',
        status: 'error',
        message: 'Failed to connect to Supabase',
        details: error
      });
    }

    // Check 2: Authentication Status
    newChecks.push({
      name: 'Authentication',
      status: user ? 'healthy' : 'warning',
      message: user ? `Signed in as ${user.email}` : 'Not authenticated',
      details: { user: user ? { id: user.id, email: user.email } : null, hasSession: !!session }
    });

    // Check 3: Database Read Test
    try {
      const { data, error } = await supabase.rpc('has_admin_users');
      newChecks.push({
        name: 'Database Functions',
        status: error ? 'error' : 'healthy',
        message: error ? `RPC call failed: ${error.message}` : 'Database functions working',
        details: error ? error : { has_admin_users: data }
      });
    } catch (error) {
      newChecks.push({
        name: 'Database Functions',
        status: 'error',
        message: 'Failed to call database function',
        details: error
      });
    }

    // Check 4: Edge Functions (if authenticated)
    if (user) {
      try {
        const { data, error } = await supabase.functions.invoke('health-check');
        newChecks.push({
          name: 'Edge Functions',
          status: error ? 'error' : 'healthy',
          message: error ? `Edge function failed: ${error.message}` : 'Edge functions accessible',
          details: error ? error : data
        });
      } catch (error) {
        newChecks.push({
          name: 'Edge Functions',
          status: 'error',
          message: 'Failed to invoke edge function',
          details: error
        });
      }
    } else {
      newChecks.push({
        name: 'Edge Functions',
        status: 'warning',
        message: 'Requires authentication to test',
        details: null
      });
    }

    // Check 5: Environment Configuration
    const envChecks = [];
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl) envChecks.push('VITE_SUPABASE_URL missing');
    if (!supabaseKey) envChecks.push('VITE_SUPABASE_ANON_KEY missing');

    newChecks.push({
      name: 'Environment Config',
      status: envChecks.length > 0 ? 'error' : 'healthy',
      message: envChecks.length > 0 ? `Missing: ${envChecks.join(', ')}` : 'All environment variables set',
      details: { 
        supabaseUrl: supabaseUrl ? '✓ Set' : '✗ Missing',
        supabaseKey: supabaseKey ? '✓ Set' : '✗ Missing'
      }
    });

    setChecks(newChecks);
    setLoading(false);
  };

  useEffect(() => {
    runHealthChecks();
  }, [user]);

  const getStatusIcon = (status: HealthCheck['status']) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
    }
  };

  const getStatusBadge = (status: HealthCheck['status']) => {
    const variants = {
      healthy: 'default',
      warning: 'secondary',
      error: 'destructive'
    } as const;

    return (
      <Badge variant={variants[status]}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Health Check</h1>
          <p className="text-muted-foreground">
            Verify Supabase connection, authentication, and system components
          </p>
        </div>
        <Button onClick={runHealthChecks} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4">
        {checks.map((check, index) => (
          <Card key={index}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getStatusIcon(check.status)}
                  <CardTitle className="text-lg">{check.name}</CardTitle>
                </div>
                {getStatusBadge(check.status)}
              </div>
              <CardDescription>{check.message}</CardDescription>
            </CardHeader>
            {check.details && (
              <CardContent>
                <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
                  {JSON.stringify(check.details, null, 2)}
                </pre>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common troubleshooting steps based on health check results
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {!user && (
            <Button asChild variant="outline">
              <a href="/auth">Sign In</a>
            </Button>
          )}
          <Button asChild variant="outline">
            <a href="/admin/setup">Admin Setup</a>
          </Button>
          <Button asChild variant="outline">
            <a href="/docs/ONBOARDING.md" target="_blank">
              View Onboarding Docs
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}