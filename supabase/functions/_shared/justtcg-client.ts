/**
 * JustTCG API Client for Deno edge functions
 * Rate limit: 500 requests per minute
 * Implements exponential backoff for 429 errors
 */

interface JustTCGGame {
  id: string;
  name: string;
  slug: string;
}

interface JustTCGSet {
  id: string;
  name: string;
  code: string;
  release_date: string;
  card_count?: number;
}

interface JustTCGCard {
  id: string;
  name: string;
  number?: string;
  rarity?: string;
  tcgplayer_id?: number;
  image_url?: string;
  variants?: JustTCGVariant[];
}

interface JustTCGVariant {
  id: string;
  condition: string;
  printing?: string;
  price_cents?: number;
}

interface RateLimiter {
  requests: number;
  windowStart: number;
  readonly maxRequests: number;
  readonly windowMs: number;
}

class JustTCGClient {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.justtcg.com/v1';
  private readonly rateLimiter: RateLimiter = {
    requests: 0,
    windowStart: Date.now(),
    maxRequests: 500,
    windowMs: 60 * 1000 // 1 minute
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
  }

  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {},
    retryCount = 0
  ): Promise<T> {
    await this.waitForRateLimit();
    
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    this.rateLimiter.requests++;

    // Handle rate limiting with exponential backoff
    if (response.status === 429) {
      if (retryCount < 3) {
        const backoffTime = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        console.log(`429 received, backing off for ${backoffTime}ms (attempt ${retryCount + 1})`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        return this.makeRequest<T>(endpoint, options, retryCount + 1);
      }
      throw new Error(`Rate limit exceeded after ${retryCount} retries`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  async getGames(): Promise<JustTCGGame[]> {
    console.log('Fetching games from JustTCG API');
    const response = await this.makeRequest<{ games: JustTCGGame[] }>('/games');
    return response.games;
  }

  async getSets(gameSlug: string, page = 1, limit = 100): Promise<{ sets: JustTCGSet[], pagination: any }> {
    console.log(`Fetching sets for game: ${gameSlug}, page: ${page}`);
    const response = await this.makeRequest<{ sets: JustTCGSet[], pagination: any }>(
      `/games/${gameSlug}/sets?page=${page}&limit=${limit}`
    );
    return response;
  }

  async getCards(gameSlug: string, setCode: string, page = 1, limit = 200): Promise<{ cards: JustTCGCard[], pagination: any }> {
    console.log(`Fetching cards for ${gameSlug}/${setCode}, page: ${page}`);
    const response = await this.makeRequest<{ cards: JustTCGCard[], pagination: any }>(
      `/games/${gameSlug}/sets/${setCode}/cards?page=${page}&limit=${limit}&include_variants=true`
    );
    return response;
  }
}

export { JustTCGClient, type JustTCGGame, type JustTCGSet, type JustTCGCard, type JustTCGVariant };