import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { getSupabase } from '@/lib/supabaseClient';
import MissingSupabaseConfig from '@/components/MissingSupabaseConfig';
import {
  Search,
  Database,
  Loader2,
  Eye,
  Download,
  Filter,
  SortAsc,
  SortDesc,
  ExternalLink
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

// Get Supabase client with env validation
let supabase;
try {
  supabase = getSupabase();
} catch (e) {
  if ((e as Error).message === 'MISSING_SUPABASE_ENV') {
    // Component will render guard instead of crashing
    supabase = null;
  } else {
    throw e;
  }
}

interface Game {
  id: string;
  name: string;
  slug: string;
  justtcg_id: string;
  created_at: string;
}

interface Card {
  id: string;
  name: string;
  number: string;
  rarity: string;
  image_url: string;
  sets: { name: string; code: string };
  variants?: Variant[];
}

interface Variant {
  id: string;
  condition: string;
  printing: string;
  price_cents: number;
  last_updated: string;
}

export function DataBrowser() {
  // Return config guard if Supabase is not configured
  if (!supabase) {
    return <MissingSupabaseConfig />;
  }

  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'games' | 'cards'>('games');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGame, setSelectedGame] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [games, setGames] = useState<Game[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);

  useEffect(() => {
    fetchGames();
  }, []);

  useEffect(() => {
    if (activeTab === 'cards' && selectedGame) {
      fetchCards();
    }
  }, [activeTab, selectedGame, searchQuery, sortOrder]);

  const fetchGames = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .order('name', { ascending: sortOrder === 'asc' });

      if (error) throw error;
      setGames(data || []);
    } catch (error) {
      console.error('Failed to fetch games:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch games',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCards = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('cards')
        .select(`
          *,
          sets!inner(name, code, games!inner(slug))
        `);

      if (selectedGame) {
        query = query.eq('sets.games.slug', selectedGame);
      }

      if (searchQuery) {
        query = query.ilike('name', `%${searchQuery}%`);
      }

      query = query.order('name', { ascending: sortOrder === 'asc' }).limit(100);

      const { data, error } = await query;

      if (error) throw error;
      setCards(data || []);
    } catch (error) {
      console.error('Failed to fetch cards:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch cards',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCardDetails = async (cardId: string) => {
    try {
      const { data, error } = await supabase
        .from('cards')
        .select(`
          *,
          sets(name, code),
          variants(*)
        `)
        .eq('id', cardId)
        .single();

      if (error) throw error;
      setSelectedCard(data);
    } catch (error) {
      console.error('Failed to fetch card details:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch card details',
        variant: 'destructive'
      });
    }
  };

  const exportData = async (type: 'games' | 'cards') => {
    try {
      let data;
      if (type === 'games') {
        data = games;
      } else {
        data = cards;
      }

      const csvContent = "data:text/csv;charset=utf-8," + 
        Object.keys(data[0] || {}).join(",") + "\n" +
        data.map(row => Object.values(row).join(",")).join("\n");

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `${type}_export.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: 'Success',
        description: `${type} data exported successfully`
      });
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: 'Error',
        description: 'Failed to export data',
        variant: 'destructive'
      });
    }
  };

  const formatPrice = (cents: number | null) => {
    if (!cents) return 'N/A';
    return `$${(cents / 100).toFixed(2)}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Data Browser</h1>
        <p className="text-muted-foreground">Browse and search your TCG database</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-muted p-1 rounded-lg w-fit">
        <Button
          variant={activeTab === 'games' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('games')}
        >
          <Database className="h-4 w-4 mr-2" />
          Games
        </Button>
        <Button
          variant={activeTab === 'cards' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('cards')}
        >
          <Search className="h-4 w-4 mr-2" />
          Cards
        </Button>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Search & Filter
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {activeTab === 'cards' && (
              <div className="flex-1 min-w-48">
                <Select value={selectedGame} onValueChange={setSelectedGame}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a game" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Games</SelectItem>
                    {games.map((game) => (
                      <SelectItem key={game.id} value={game.slug}>
                        {game.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {activeTab === 'cards' && (
              <div className="flex-1 min-w-64">
                <Input
                  placeholder="Search cards by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
              Sort {sortOrder === 'asc' ? 'A-Z' : 'Z-A'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => exportData(activeTab)}
              disabled={activeTab === 'games' ? games.length === 0 : cards.length === 0}
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {activeTab === 'games' ? 'Games' : 'Cards'}
            <Badge variant="secondary" className="ml-2">
              {activeTab === 'games' ? games.length : cards.length} items
            </Badge>
          </CardTitle>
          <CardDescription>
            {activeTab === 'games' 
              ? 'All trading card games in your database'
              : 'Cards from the selected game (max 100 results)'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {activeTab === 'games' ? (
                      <>
                        <TableHead>Name</TableHead>
                        <TableHead>Slug</TableHead>
                        <TableHead>JustTCG ID</TableHead>
                        <TableHead>Created</TableHead>
                      </>
                    ) : (
                      <>
                        <TableHead>Name</TableHead>
                        <TableHead>Set</TableHead>
                        <TableHead>Number</TableHead>
                        <TableHead>Rarity</TableHead>
                        <TableHead>Actions</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeTab === 'games' ? (
                    games.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          No games found
                        </TableCell>
                      </TableRow>
                    ) : (
                      games.map((game) => (
                        <TableRow key={game.id}>
                          <TableCell className="font-medium">{game.name}</TableCell>
                          <TableCell>
                            <code className="bg-muted px-2 py-1 rounded text-sm">
                              {game.slug}
                            </code>
                          </TableCell>
                          <TableCell>
                            <code className="bg-muted px-2 py-1 rounded text-sm">
                              {game.justtcg_id}
                            </code>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(game.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))
                    )
                  ) : (
                    cards.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          {selectedGame ? 'No cards found for the selected game' : 'Select a game to view cards'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      cards.map((card) => (
                        <TableRow key={card.id}>
                          <TableCell className="font-medium">{card.name}</TableCell>
                          <TableCell>{card.sets?.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{card.number || 'N/A'}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{card.rarity || 'Unknown'}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => fetchCardDetails(card.id)}
                                  >
                                    <Eye className="h-3 w-3" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl">
                                  <DialogHeader>
                                    <DialogTitle>{selectedCard?.name}</DialogTitle>
                                    <DialogDescription>
                                      {selectedCard?.sets?.name} ({selectedCard?.sets?.code})
                                    </DialogDescription>
                                  </DialogHeader>
                                  {selectedCard && (
                                    <div className="space-y-4">
                                      {selectedCard.image_url && (
                                        <div className="flex justify-center">
                                          <img 
                                            src={selectedCard.image_url} 
                                            alt={selectedCard.name}
                                            className="max-w-48 rounded-lg border"
                                          />
                                        </div>
                                      )}
                                      
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <label className="text-sm font-medium">Number:</label>
                                          <div>{selectedCard.number || 'N/A'}</div>
                                        </div>
                                        <div>
                                          <label className="text-sm font-medium">Rarity:</label>
                                          <div>{selectedCard.rarity || 'Unknown'}</div>
                                        </div>
                                      </div>

                                      {selectedCard.variants && selectedCard.variants.length > 0 && (
                                        <div>
                                          <label className="text-sm font-medium mb-2 block">Price Variations:</label>
                                          <div className="space-y-2">
                                            {selectedCard.variants.map((variant) => (
                                              <div key={variant.id} className="flex justify-between items-center p-2 bg-muted rounded">
                                                <div>
                                                  <span className="font-medium">{variant.condition}</span>
                                                  {variant.printing !== 'normal' && (
                                                    <Badge variant="outline" className="ml-2">
                                                      {variant.printing}
                                                    </Badge>
                                                  )}
                                                </div>
                                                <div className="font-mono">
                                                  {formatPrice(variant.price_cents)}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </DialogContent>
                              </Dialog>
                              
                              {card.image_url && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  asChild
                                >
                                  <a href={card.image_url} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}