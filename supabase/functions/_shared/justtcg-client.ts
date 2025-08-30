/**
 * JustTCG API Client for Deno edge functions - Premium Plan Optimized
 * Rate limit: 400 requests per minute (safe buffer under 500 limit)
 * Batch size: 100 items per request (premium limit)
 * Smart delay: 150ms between requests
 */

interface JustTCGGame {
  id: string;
  name: string;
  count: number;
  cards_count: number;
  sets_count: number;
}

interface JustTCGSet {
  id: string;
  name: string;
  code: string;
  release_date: string;
  card_count?: number;
  game?: string;
}

interface JustTCGCard {
  id: string;
  name: string;
  number?: string;
  rarity?: string;
  tcgplayerId?: number;
  image_url?: string;
  variants?: JustTCGVariant[];
  setId?: string;
}

interface JustTCGVariant {
  id: string;
  condition: string;
  printing?: string;
  price?: number; // Will be converted to price_cents
  lastUpdated?: string;
}

interface JustTCGError {
  error: string;
  code: string;
}

interface RateLimiter {
  requests: number;
  windowStart: number;
  readonly maxRequests: number;
  readonly windowMs: number;
  readonly delayMs: number;
}

// Game slug mapping for JustTCG API
const GAME_SLUG_MAP: Record<string, string> = {
  'mtg': 'magic-the-gathering',
  'pokemon': 'pokemon', 
  'yugioh': 'yugioh'
};

const REVERSE_GAME_SLUG_MAP: Record<string, string> = {
  'magic-the-gathering': 'mtg',
  'pokemon': 'pokemon',
  'yugioh': 'yugioh'
};

class JustTCGClient {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.justtcg.com/v1';
  private readonly rateLimiter: RateLimiter = {
    requests: 0,
    windowStart: Date.now(),
    maxRequests: 400, // Safe buffer under 500 limit
    windowMs: 60 * 1000, // 1 minute
    delayMs: 150 // Smart delay between requests
  };

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    
    // Reset window if needed
    if (now - this.rateLimiter.windowStart >= this.rateLimiter.windowMs) {
      this.rateLimiter.requests = 0;
      this.rateLimiter.windowStart = now;
    }

    // Check if we're at the limit
    if (this.rateLimiter.requests >= this.rateLimiter.maxRequests) {
      const waitTime = this.rateLimiter.windowMs - (now - this.rateLimiter.windowStart);
      console.log(`Rate limit reached, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Reset after waiting
      this.rateLimiter.requests = 0;
      this.rateLimiter.windowStart = Date.now();
    }

    // Smart delay between requests
    if (this.rateLimiter.requests > 0) {
      await new Promise(resolve => setTimeout(resolve, this.rateLimiter.delayMs));
    }
  }

  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {},
    retryCount = 0
  ): Promise<T> {
    await this.waitForRateLimit();
    
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      this.rateLimiter.requests++;

      // Handle rate limiting with exponential backoff: 2s, 4s, 8s, 16s, 30s max
      if (response.status === 429) {
        if (retryCount < 5) {
          const backoffTimes = [2000, 4000, 8000, 16000, 30000];
          const backoffTime = backoffTimes[retryCount];
          console.log(`429 rate limit, backing off for ${backoffTime}ms (attempt ${retryCount + 1})`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          return this.makeRequest<T>(endpoint, options, retryCount + 1);
        }
        throw new Error(`Rate limit exceeded after ${retryCount} retries`);
      }

      if (!response.ok) {
        let errorData: JustTCGError;
        try {
          errorData = await response.json();
        } catch {
          errorData = { 
            error: `HTTP ${response.status}: ${response.statusText}`, 
            code: 'HTTP_ERROR' 
          };
        }
        
        console.error(`JustTCG API Error: ${errorData.code} - ${errorData.error}`);
        throw new Error(`${errorData.code}: ${errorData.error}`);
      }

      return response.json();
    } catch (error) {
      if (error.message.includes('Rate limit exceeded')) {
        throw error;
      }
      throw new Error(`API request failed: ${error.message}`);
    }
  }

  private mapGameSlug(slug: string, reverse = false): string {
    if (reverse) {
      return REVERSE_GAME_SLUG_MAP[slug] || slug;
    }
    return GAME_SLUG_MAP[slug] || slug;
  }

  async getGames(): Promise<JustTCGGame[]> {
    console.log('Fetching games from JustTCG API');
    const response = await this.makeRequest<{ data: JustTCGGame[], _metadata: any }>('/games');
    
    return response.data;
  }

  async getSets(gameSlug: string, offset = 0, limit = 100): Promise<{ sets: JustTCGSet[], pagination: any }> {
    const justTCGSlug = this.mapGameSlug(gameSlug);
    console.log(`Fetching sets for game: ${justTCGSlug}, offset: ${offset}, limit: ${limit}`);
    
    const response = await this.makeRequest<{ sets: JustTCGSet[], pagination: any }>(
      `/sets?game=${justTCGSlug}&limit=${limit}&offset=${offset}`
    );
    
    return response;
  }

  async getCards(gameSlug: string, setId: string, offset = 0, limit = 100): Promise<{ cards: JustTCGCard[], pagination: any }> {
    const justTCGSlug = this.mapGameSlug(gameSlug);
    console.log(`Fetching cards for ${justTCGSlug}/set/${setId}, offset: ${offset}, limit: ${limit}`);
    
    const response = await this.makeRequest<{ cards: JustTCGCard[], pagination: any }>(
      `/cards?game=${justTCGSlug}&set=${setId}&limit=${limit}&offset=${offset}&include_variants=true`
    );
    
    return response;
  }

  async batchGetCards(cardIds: string[]): Promise<JustTCGCard[]> {
    if (cardIds.length === 0) return [];
    
    console.log(`Batch fetching ${cardIds.length} cards`);
    const response = await this.makeRequest<{ cards: JustTCGCard[] }>(
      '/cards/batch',
      {
        method: 'POST',
        body: JSON.stringify({ ids: cardIds })
      }
    );
    
    return response.cards;
  }

  // Health check - simple API connectivity test
  async healthCheck(): Promise<boolean> {
    try {
      await this.makeRequest<{ data: JustTCGGame[], _metadata: any }>('/games');
      return true;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }

  // Get current rate limit status
  getRateLimitStatus() {
    const now = Date.now();
    const windowElapsed = now - this.rateLimiter.windowStart;
    const windowRemaining = Math.max(0, this.rateLimiter.windowMs - windowElapsed);
    
    return {
      requests: this.rateLimiter.requests,
      maxRequests: this.rateLimiter.maxRequests,
      windowRemaining,
      requestsRemaining: Math.max(0, this.rateLimiter.maxRequests - this.rateLimiter.requests)
    };
  }

  // Process card data for database storage
  static processCardForStorage(card: JustTCGCard) {
    return {
      name: card.name,
      number: card.number,
      rarity: card.rarity,
      justtcg_card_id: card.id,
      tcgplayer_id: card.tcgplayerId ? parseInt(card.tcgplayerId.toString()) : null,
      image_url: card.image_url
    };
  }

  // Process variant data for database storage
  static processVariantForStorage(variant: JustTCGVariant) {
    return {
      condition: variant.condition,
      printing: variant.printing || 'normal',
      price_cents: variant.price ? Math.round(variant.price * 100) : null,
      justtcg_variant_id: variant.id,
      last_updated: variant.lastUpdated ? new Date(variant.lastUpdated).toISOString() : new Date().toISOString()
    };
  }
}

export { JustTCGClient, type JustTCGGame, type JustTCGSet, type JustTCGCard, type JustTCGVariant };