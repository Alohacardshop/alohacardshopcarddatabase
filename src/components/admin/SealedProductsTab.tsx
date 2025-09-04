import { useEffect, useState, useCallback } from "react";
import { Package, TrendingUp, DollarSign, BarChart3, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/ui/stat-card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SealedProduct {
  id: string;
  name: string;
  category: string;
  sku: string | null;
  image_url: string | null;
  msrp_cents: number | null;
  game: {
    name: string;
    slug: string;
  };
  variants: Array<{
    id: string;
    condition: string;
    language: string;
    price_cents: number | null;
    market_price_cents: number | null;
    last_updated: string | null;
  }>;
}

interface SealedStats {
  total_products: number;
  products_with_pricing: number;
  avg_price_cents: number;
  total_variants: number;
}

export function SealedProductsTab() {
  const [products, setProducts] = useState<SealedProduct[]>([]);
  const [stats, setStats] = useState<SealedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);

  const fetchSealedProducts = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch products with variants
      const { data: productsData, error: productsError } = await supabase
        .from('sealed_products')
        .select(`
          id,
          name,
          category,
          sku,
          image_url,
          msrp_cents,
          games!inner (
            name,
            slug
          ),
          sealed_variants (
            id,
            condition,
            language,
            price_cents,
            market_price_cents,
            last_updated
          )
        `)
        .eq('is_active', true)
        .order('name');

      if (productsError) throw productsError;

      // Transform data to match interface
      const transformedProducts = productsData?.map(product => ({
        ...product,
        game: product.games,
        variants: product.sealed_variants || []
      })) || [];

      setProducts(transformedProducts);

      // Calculate stats
      const totalProducts = transformedProducts.length;
      const productsWithPricing = transformedProducts.filter(p => 
        p.variants.some(v => v.price_cents !== null)
      ).length;
      
      const allVariants = transformedProducts.flatMap(p => p.variants);
      const pricesInCents = allVariants
        .map(v => v.price_cents)
        .filter((price): price is number => price !== null);
      
      const avgPrice = pricesInCents.length > 0 
        ? pricesInCents.reduce((sum, price) => sum + price, 0) / pricesInCents.length
        : 0;

      setStats({
        total_products: totalProducts,
        products_with_pricing: productsWithPricing,
        avg_price_cents: Math.round(avgPrice),
        total_variants: allVariants.length
      });

    } catch (error) {
      console.error('Error fetching sealed products:', error);
      toast.error('Failed to fetch sealed products');
    } finally {
      setLoading(false);
    }
  }, []);

  const syncSealedProducts = useCallback(async (gameSlug: string) => {
    try {
      setSyncing(gameSlug);
      
      const { data, error } = await supabase.functions.invoke('justtcg-sealed-sync', {
        body: { gameSlug }
      });

      if (error) throw error;

      toast.success(`Sealed products sync completed for ${gameSlug}`);
      await fetchSealedProducts(); // Refresh data

    } catch (error) {
      console.error('Sync error:', error);
      toast.error(`Failed to sync sealed products: ${error.message}`);
    } finally {
      setSyncing(null);
    }
  }, [fetchSealedProducts]);

  useEffect(() => {
    fetchSealedProducts();
  }, [fetchSealedProducts]);

  const formatPrice = (cents: number | null) => {
    if (cents === null) return 'N/A';
    return `$${(cents / 100).toFixed(2)}`;
  };

  const getCategoryBadgeVariant = (category: string) => {
    const variants: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
      'booster_box': 'default',
      'elite_trainer_box': 'secondary',
      'starter_deck': 'outline',
      'bundle': 'destructive',
    };
    return variants[category] || 'outline';
  };

  const formatCategoryName = (category: string) => {
    return category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Products"
            value={stats.total_products}
            icon={<Package className="h-4 w-4" />}
          />
          <StatCard
            title="With Pricing"
            value={stats.products_with_pricing}
            icon={<DollarSign className="h-4 w-4" />}
          />
          <StatCard
            title="Avg Price"
            value={formatPrice(stats.avg_price_cents)}
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <StatCard
            title="Total Variants"
            value={stats.total_variants}
            icon={<BarChart3 className="h-4 w-4" />}
          />
        </div>
      )}

      {/* Sync Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Sealed Products Sync</CardTitle>
          <CardDescription>
            Sync sealed products from JustTCG API for each game
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => syncSealedProducts('pokemon-en')}
              disabled={syncing === 'pokemon-en'}
              size="sm"
            >
              {syncing === 'pokemon-en' ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
              Sync Pokémon (EN)
            </Button>
            <Button
              onClick={() => syncSealedProducts('pokemon-jp')}
              disabled={syncing === 'pokemon-jp'}
              size="sm"
            >
              {syncing === 'pokemon-jp' ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
              Sync Pokémon (JP)
            </Button>
            <Button
              onClick={() => syncSealedProducts('magic-the-gathering')}
              disabled={syncing === 'magic-the-gathering'}
              size="sm"
            >
              {syncing === 'magic-the-gathering' ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
              Sync MTG
            </Button>
            <Button
              onClick={() => syncSealedProducts('yugioh')}
              disabled={syncing === 'yugioh'}
              size="sm"
            >
              {syncing === 'yugioh' ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
              Sync Yu-Gi-Oh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Sealed Products</CardTitle>
          <CardDescription>
            All sealed products with pricing information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Game</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>MSRP</TableHead>
                  <TableHead>Market Price</TableHead>
                  <TableHead>Variants</TableHead>
                  <TableHead>Last Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => {
                  const latestVariant = product.variants
                    .filter(v => v.price_cents !== null)
                    .sort((a, b) => new Date(b.last_updated || '').getTime() - new Date(a.last_updated || '').getTime())[0];

                  return (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {product.image_url && (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="h-10 w-10 rounded object-cover"
                            />
                          )}
                          <div>
                            <div className="font-medium">{product.name}</div>
                            {product.sku && (
                              <div className="text-sm text-muted-foreground">{product.sku}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{product.game.name}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getCategoryBadgeVariant(product.category)}>
                          {formatCategoryName(product.category)}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatPrice(product.msrp_cents)}</TableCell>
                      <TableCell>
                        {latestVariant ? formatPrice(latestVariant.market_price_cents || latestVariant.price_cents) : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{product.variants.length}</Badge>
                      </TableCell>
                      <TableCell>
                        {latestVariant?.last_updated 
                          ? new Date(latestVariant.last_updated).toLocaleDateString()
                          : 'Never'
                        }
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            
            {products.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No sealed products found. Try syncing data from the JustTCG API.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}