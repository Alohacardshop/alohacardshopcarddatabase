import { useEffect, useState, useCallback } from "react";
import { TrendingUp, TrendingDown, DollarSign, Activity, Zap, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/ui/stat-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PriceMovement {
  id: string;
  name: string;
  product_type: 'card' | 'sealed';
  game_name: string;
  set_name?: string;
  category?: string;
  percentage_change: number;
  price_old_cents: number;
  price_new_cents: number;
  recorded_at: string;
}

interface MarketOpportunity {
  id: string;
  name: string;
  product_type: 'card' | 'sealed';
  game_name: string;
  subcategory: string;
  base_price_cents: number;
  current_price_cents: number;
  profit_margin_percentage: number;
  opportunity_type: string;
}

interface TrendData {
  date: string;
  avg_price_cents: number;
  min_price_cents: number;
  max_price_cents: number;
  variant_count: number;
}

interface AnalyticsStats {
  total_tracked_products: number;
  price_changes_today: number;
  hot_products_count: number;
  avg_daily_movement: number;
}

export function AnalyticsTab() {
  const [topMovers, setTopMovers] = useState<PriceMovement[]>([]);
  const [marketOpportunities, setMarketOpportunities] = useState<MarketOpportunity[]>([]);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'1d' | '7d' | '30d'>('1d');
  const [selectedGame, setSelectedGame] = useState<string>('all');
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);

  const fetchAnalyticsData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch top movers from price history
      const hoursBack = selectedPeriod === '1d' ? 24 : selectedPeriod === '7d' ? 168 : 720;
      const { data: movementsData, error: movementsError } = await supabase
        .from('price_history')
        .select(`
          id,
          product_type,
          percentage_change,
          price_cents_old,
          price_cents_new,
          recorded_at,
          cards!inner (
            id,
            name,
            sets!inner (
              name,
              games!inner (name)
            )
          ),
          sealed_products (
            id,
            name,
            category,
            games!inner (name)
          )
        `)
        .gte('recorded_at', new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString())
        .order('percentage_change', { ascending: false })
        .limit(20);

      if (movementsError) throw movementsError;

      // Transform movements data
      const transformedMovements: PriceMovement[] = movementsData?.map(movement => ({
        id: movement.id,
        name: movement.product_type === 'card' 
          ? movement.cards?.name || 'Unknown Card'
          : movement.sealed_products?.name || 'Unknown Product',
        product_type: movement.product_type as 'card' | 'sealed',
        game_name: movement.product_type === 'card'
          ? movement.cards?.sets?.games?.name || 'Unknown Game'
          : movement.sealed_products?.games?.name || 'Unknown Game',
        set_name: movement.product_type === 'card' ? movement.cards?.sets?.name : undefined,
        category: movement.product_type === 'sealed' ? movement.sealed_products?.category : undefined,
        percentage_change: movement.percentage_change,
        price_old_cents: movement.price_cents_old,
        price_new_cents: movement.price_cents_new,
        recorded_at: movement.recorded_at
      })) || [];

      setTopMovers(transformedMovements);

      // Fetch market opportunities
      const { data: opportunitiesData, error: opportunitiesError } = await supabase
        .from('market_intelligence')
        .select('*')
        .order('profit_margin_percentage', { ascending: false })
        .limit(10);

      if (opportunitiesError) throw opportunitiesError;
      setMarketOpportunities((opportunitiesData || []).map(opportunity => ({
        ...opportunity,
        product_type: opportunity.product_type as 'card' | 'sealed'
      })));

      // Fetch trend data for price charts
      const daysBack = selectedPeriod === '1d' ? 1 : selectedPeriod === '7d' ? 7 : 30;
      const { data: trendsData, error: trendsError } = await supabase
        .from('daily_price_snapshots')
        .select('*')
        .gte('snapshot_date', new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('snapshot_date');

      if (trendsError) throw trendsError;
      
      // Aggregate trend data by date
      const trendsByDate = trendsData?.reduce((acc: any, snapshot) => {
        const date = snapshot.snapshot_date;
        if (!acc[date]) {
          acc[date] = {
            date,
            total_avg: 0,
            total_min: 0,
            total_max: 0,
            count: 0
          };
        }
        acc[date].total_avg += snapshot.avg_price_cents;
        acc[date].total_min += snapshot.min_price_cents;
        acc[date].total_max += snapshot.max_price_cents;
        acc[date].count += 1;
        return acc;
      }, {}) || {};

      const aggregatedTrends = Object.values(trendsByDate).map((trend: any) => ({
        date: trend.date,
        avg_price_cents: Math.round(trend.total_avg / trend.count),
        min_price_cents: Math.round(trend.total_min / trend.count),
        max_price_cents: Math.round(trend.total_max / trend.count),
        variant_count: trend.count
      }));

      setTrendData(aggregatedTrends as TrendData[]);

      // Calculate analytics stats
      const hotProductsCount = transformedMovements.filter(m => Math.abs(m.percentage_change) >= 10).length;
      const avgMovement = transformedMovements.length > 0 
        ? transformedMovements.reduce((sum, m) => sum + Math.abs(m.percentage_change), 0) / transformedMovements.length
        : 0;

      setStats({
        total_tracked_products: trendsData?.length || 0,
        price_changes_today: transformedMovements.length,
        hot_products_count: hotProductsCount,
        avg_daily_movement: Math.round(avgMovement * 100) / 100
      });

    } catch (error) {
      console.error('Error fetching analytics data:', error);
      toast.error('Failed to fetch analytics data');
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod]);

  const instantPriceCheck = useCallback(async () => {
    if (!lookupQuery.trim()) {
      toast.error('Please enter a search query');
      return;
    }

    try {
      setLookupLoading(true);
      
      const { data, error } = await supabase.functions.invoke('instant-price-check', {
        body: { query: lookupQuery, limit: 5 }
      });

      if (error) throw error;

      // Show results in a toast notification for now
      if (data?.results?.length > 0) {
        toast.success(`Found ${data.results.length} results. Check console for details.`);
        console.log('Price check results:', data.results);
      } else {
        toast.info('No results found for your query');
      }

    } catch (error) {
      console.error('Price check error:', error);
      toast.error(`Price check failed: ${error.message}`);
    } finally {
      setLookupLoading(false);
    }
  }, [lookupQuery]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const getChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (change < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Activity className="h-4 w-4 text-gray-500" />;
  };

  const getChangeBadge = (change: number) => {
    if (Math.abs(change) >= 10) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          {getChangeIcon(change)}
          {change > 0 ? '+' : ''}{change.toFixed(2)}%
        </Badge>
      );
    }
    if (Math.abs(change) >= 5) {
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          {getChangeIcon(change)}
          {change > 0 ? '+' : ''}{change.toFixed(2)}%
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="flex items-center gap-1">
        {getChangeIcon(change)}
        {change > 0 ? '+' : ''}{change.toFixed(2)}%
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Activity className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Analytics Stats */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Tracked Products"
            value={stats.total_tracked_products}
            icon={<Activity className="h-4 w-4" />}
          />
          <StatCard
            title="Price Changes Today"
            value={stats.price_changes_today}
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <StatCard
            title="Hot Products (>10% change)"
            value={stats.hot_products_count}
            icon={<AlertTriangle className="h-4 w-4" />}
          />
          <StatCard
            title="Avg Daily Movement"
            value={`${stats.avg_daily_movement}%`}
            icon={<Activity className="h-4 w-4" />}
          />
        </div>
      )}

      {/* Period and Game Selection */}
      <div className="flex gap-4 items-center">
        <Select value={selectedPeriod} onValueChange={(value: string) => setSelectedPeriod(value as '1d' | '7d' | '30d')}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1d">1 Day</SelectItem>
            <SelectItem value="7d">7 Days</SelectItem>
            <SelectItem value="30d">30 Days</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedGame} onValueChange={setSelectedGame}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Games</SelectItem>
            <SelectItem value="pokemon-en">Pokémon (EN)</SelectItem>
            <SelectItem value="pokemon-jp">Pokémon (JP)</SelectItem>
            <SelectItem value="magic-the-gathering">MTG</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="movers" className="space-y-6">
        <TabsList>
          <TabsTrigger value="movers">Top Movers</TabsTrigger>
          <TabsTrigger value="opportunities">Market Intelligence</TabsTrigger>
          <TabsTrigger value="lookup">Instant Price Check</TabsTrigger>
        </TabsList>

        <TabsContent value="movers">
          <Card>
            <CardHeader>
              <CardTitle>Top Price Movements</CardTitle>
              <CardDescription>
                Biggest price changes in the last {selectedPeriod === '1d' ? '24 hours' : selectedPeriod === '7d' ? '7 days' : '30 days'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Game</TableHead>
                    <TableHead>Old Price</TableHead>
                    <TableHead>New Price</TableHead>
                    <TableHead>Change</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topMovers.map((mover) => (
                    <TableRow key={mover.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{mover.name}</div>
                          {mover.set_name && (
                            <div className="text-sm text-muted-foreground">{mover.set_name}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {mover.product_type === 'card' ? 'Single' : 'Sealed'}
                        </Badge>
                      </TableCell>
                      <TableCell>{mover.game_name}</TableCell>
                      <TableCell>{formatPrice(mover.price_old_cents)}</TableCell>
                      <TableCell>{formatPrice(mover.price_new_cents)}</TableCell>
                      <TableCell>{getChangeBadge(mover.percentage_change)}</TableCell>
                      <TableCell>
                        {new Date(mover.recorded_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {topMovers.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No significant price movements found in the selected period.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="opportunities">
          <Card>
            <CardHeader>
              <CardTitle>Market Intelligence</CardTitle>
              <CardDescription>
                Best profit opportunities and arbitrage deals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Game</TableHead>
                    <TableHead>Base Price</TableHead>
                    <TableHead>Current Price</TableHead>
                    <TableHead>Profit Margin</TableHead>
                    <TableHead>Opportunity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {marketOpportunities.map((opportunity) => (
                    <TableRow key={opportunity.id}>
                      <TableCell className="font-medium">{opportunity.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {opportunity.product_type === 'card' ? 'Single' : 'Sealed'}
                        </Badge>
                      </TableCell>
                      <TableCell>{opportunity.game_name}</TableCell>
                      <TableCell>
                        {opportunity.base_price_cents > 0 ? formatPrice(opportunity.base_price_cents) : '-'}
                      </TableCell>
                      <TableCell>{formatPrice(opportunity.current_price_cents)}</TableCell>
                      <TableCell>
                        <Badge variant={opportunity.profit_margin_percentage >= 50 ? "default" : "secondary"}>
                          +{opportunity.profit_margin_percentage.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{opportunity.opportunity_type}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {marketOpportunities.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No significant market opportunities found at this time.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lookup">
          <Card>
            <CardHeader>
              <CardTitle>Instant Price Check</CardTitle>
              <CardDescription>
                Get real-time pricing for any product. Uses remaining monthly API allowance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search for any card or product..."
                    value={lookupQuery}
                    onChange={(e) => setLookupQuery(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                    onKeyDown={(e) => e.key === 'Enter' && instantPriceCheck()}
                  />
                </div>
                <Button
                  onClick={instantPriceCheck}
                  disabled={lookupLoading || !lookupQuery.trim()}
                >
                  {lookupLoading ? (
                    <Activity className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Zap className="h-4 w-4 mr-2" />
                  )}
                  Check Price
                </Button>
              </div>
              
              <div className="bg-muted/50 p-4 rounded-md">
                <h4 className="font-medium mb-2">How it works:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Searches across all supported games and products</li>
                  <li>• Returns real-time pricing from JustTCG API</li>
                  <li>• Shows all conditions and languages available</li>
                  <li>• Uses remaining monthly API capacity (currently ~350K requests available)</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}