import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Normalization mappings - server-side
const PRINTING_MAP: Record<string, string> = {
  normal: "normal",
  holofoil: "holofoil", 
  reverse_holofoil: "reverse_holofoil",
  foil: "holofoil",       // alias
  rev: "reverse_holofoil", // alias
  holo: "holofoil",       // alias
  reverse: "reverse_holofoil" // alias
};

const CONDITION_MAP: Record<string, string> = {
  near_mint: "near_mint",
  lightly_played: "lightly_played", 
  moderately_played: "moderately_played",
  heavily_played: "heavily_played",
  damaged: "damaged",
  mint: "mint",
  nm: "near_mint", 
  lp: "lightly_played", 
  mp: "moderately_played", 
  hp: "heavily_played",
  dmg: "damaged"
};

function normalizePrinting(p?: string): string | undefined { 
  return p ? (PRINTING_MAP[p.toLowerCase()] || p) : undefined; 
}

function normalizeCondition(c?: string): string | undefined { 
  return c ? (CONDITION_MAP[c.toLowerCase()] || c) : undefined; 
}

interface BatchRequest {
  tcgplayerId: string;
  printing?: string;
  condition?: string;
}

const JTCG = Deno.env.get('JTCG_BASE') || 'https://api.justtcg.com/v1';
const JHDRS = {
  'X-API-Key': '',
  'Authorization': '',
  'Accept': 'application/json',
  'Content-Type': 'application/json',
};

async function fetchJsonWithRetry(url: string, options: RequestInit, retries = 3): Promise<any> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429 && attempt < retries - 1) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 5000);
        console.log(`Rate limited, backing off for ${backoffMs}ms (attempt ${attempt + 1})`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        continue;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
      
    } catch (error) {
      if (attempt === retries - 1) throw error;
      
      const backoffMs = Math.min(500 * Math.pow(2, attempt), 3000);
      console.log(`Request failed, retrying in ${backoffMs}ms: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }
}

async function getSingleCardPrice(tcgplayerId: string, printing?: string, condition?: string): Promise<any[]> {
  const p = normalizePrinting(printing);
  const c = normalizeCondition(condition);
  
  console.log({ tcgplayerId, printing: p, condition: c, action: 'getSingleCardPrice' });
  
  const params = new URLSearchParams();
  params.set('tcgplayerId', tcgplayerId);
  if (p) params.set('printing', p);
  if (c) params.set('condition', c);
  
  const url = `${JTCG}/cards?${params.toString()}`;
  
  try {
    const response = await fetchJsonWithRetry(url, { method: 'GET', headers: JHDRS });
    let rows = response?.data || [];
    
    console.log({ tcgplayerId, filtered_results: rows.length, printing: p, condition: c });
    
    // Safe fallback when filtered query returns zero results
    if (rows.length === 0 && (printing || condition)) {
      console.log(`No filtered results for tcgplayerId=${tcgplayerId}, retrying without filters`);
      const fallbackUrl = `${JTCG}/cards?tcgplayerId=${encodeURIComponent(tcgplayerId)}`;
      const fb = await fetchJsonWithRetry(fallbackUrl, { method: 'GET', headers: JHDRS });
      rows = fb?.data || [];
      console.log({ tcgplayerId, fallback_results: rows.length });
    }
    
    return rows;
    
  } catch (error) {
    console.error(`Single card price fetch failed for ${tcgplayerId}:`, error);
    return [];
  }
}

async function getBatchCardPrices(requests: BatchRequest[]): Promise<any[]> {
  // Normalize all requests
  const normalized = requests.map(it => ({
    ...it,
    printing: normalizePrinting(it.printing),
    condition: normalizeCondition(it.condition)
  }));
  
  console.log({ batch_count: normalized.length, action: 'getBatchCardPrices' });
  
  const allResults: any[] = [];
  const batchSize = 50; // Keep batches manageable
  
  for (let i = 0; i < normalized.length; i += batchSize) {
    const batch = normalized.slice(i, i + batchSize);
    
    try {
      const response = await fetchJsonWithRetry(`${JTCG}/cards/batch`, {
        method: 'POST',
        headers: JHDRS,
        body: JSON.stringify(batch)
      });
      
      const data = response?.data || [];
      console.log({ batch_start: i, batch_size: batch.length, results: data.length });
      
      if (data.length > 0) {
        allResults.push(...data);
      }
      
      // Fallback for empty batch results
      if (data.length === 0) {
        console.log(`Empty batch result, trying individual fallbacks`);
        for (const item of batch) {
          const u = `${JTCG}/cards?tcgplayerId=${encodeURIComponent(item.tcgplayerId)}`;
          try {
            const single = await fetchJsonWithRetry(u, { method: 'GET', headers: JHDRS });
            const d = single?.data || [];
            if (d.length) {
              console.log({ tcgplayerId: item.tcgplayerId, individual_fallback: d.length });
              allResults.push(...d);
            }
          } catch (singleError) {
            console.warn(`Individual fallback failed for ${item.tcgplayerId}:`, singleError.message);
          }
        }
      }
      
      // Rate limiting between batches
      if (i + batchSize < normalized.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
    } catch (error) {
      console.error(`Batch ${i} failed:`, error);
      // Continue with next batch
    }
  }
  
  return allResults;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const justTCGApiKey = Deno.env.get('JUSTTCG_API_KEY');
    
    if (!justTCGApiKey) {
      return new Response(JSON.stringify({
        success: false,
        error: 'JUSTTCG_API_KEY not configured',
        hint: 'Please add the JUSTTCG_API_KEY secret'
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
    
    // Set up headers with API key
    JHDRS['X-API-Key'] = justTCGApiKey;
    JHDRS['Authorization'] = `Bearer ${justTCGApiKey}`;
    
    let data: any[] = [];
    let requestPayload: any = null;
    
    if (req.method === 'GET') {
      // Single card lookup
      const url = new URL(req.url);
      const tcgplayerId = url.searchParams.get('tcgplayerId');
      const printing = url.searchParams.get('printing') || undefined;
      const condition = url.searchParams.get('condition') || undefined;
      
      if (!tcgplayerId) {
        return new Response(JSON.stringify({
          success: false,
          error: 'tcgplayerId is required',
          hint: 'Pass tcgplayerId as query parameter'
        }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
      
      requestPayload = { tcgplayerId, printing, condition };
      data = await getSingleCardPrice(tcgplayerId, printing, condition);
      
    } else if (req.method === 'POST') {
      // Batch lookup
      const requests: BatchRequest[] = await req.json();
      
      if (!Array.isArray(requests) || requests.length === 0) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid batch request',
          hint: 'POST body must be array of {tcgplayerId, printing?, condition?}'
        }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
      
      requestPayload = requests;
      data = await getBatchCardPrices(requests);
      
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: 'Method not allowed',
        hint: 'Use GET for single card or POST for batch'
      }), { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
    
    // Return structured response with counts
    if (data.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        count: 0,
        error: 'No results from JustTCG',
        hint: 'Check printing/condition normalization or try without filters',
        request: requestPayload
      }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
    
    return new Response(JSON.stringify({
      success: true,
      count: data.length,
      data,
      request: requestPayload
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
    
  } catch (error) {
    console.error('Error in justtcg-prices:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error',
      message: error.message,
      hint: 'Check function logs for details'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});