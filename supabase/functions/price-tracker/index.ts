import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PriceAlert {
  id: string;
  user_id: string;
  card_id?: string;
  sealed_product_id?: string;
  product_type: 'card' | 'sealed';
  alert_type: 'price_drop' | 'price_rise' | 'back_in_stock' | 'percentage_change';
  target_price_cents?: number;
  percentage_threshold?: number;
  condition_filter?: string;
  language_filter: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🔍 Starting price tracking and alert processing...');

    // Update daily price snapshots
    console.log('📊 Updating daily price snapshots...');
    const { error: snapshotError } = await supabase.rpc('update_daily_price_snapshots');
    
    if (snapshotError) {
      console.error('Error updating snapshots:', snapshotError);
      throw snapshotError;
    }

    // Get all active price alerts
    const { data: alerts, error: alertsError } = await supabase
      .from('price_alerts')
      .select('*')
      .eq('is_active', true);

    if (alertsError) throw alertsError;

    console.log(`📋 Processing ${alerts?.length || 0} active alerts...`);

    let alertsTriggered = 0;
    const notifications = [];

    for (const alert of alerts || []) {
      try {
        let shouldTrigger = false;
        let alertMessage = '';
        let priceOld = 0;
        let priceNew = 0;
        let percentageChange = 0;

        if (alert.product_type === 'card' && alert.card_id) {
          // Check card variants for price changes
          const { data: variants, error: variantsError } = await supabase
            .from('variants')
            .select(`
              *,
              cards!inner (name, sets!inner (name))
            `)
            .eq('card_id', alert.card_id)
            .eq('language', alert.language_filter)
            .order('last_updated', { ascending: false })
            .limit(1);

          if (variantsError) {
            console.error('Error fetching variants:', variantsError);
            continue;
          }

          const variant = variants?.[0];
          if (!variant || !variant.price_cents) continue;

          priceNew = variant.price_cents;

          // Get historical price for comparison
          const { data: priceHistory, error: historyError } = await supabase
            .from('price_history')
            .select('price_cents_old, price_cents_new, percentage_change')
            .eq('variant_id', variant.id)
            .order('recorded_at', { ascending: false })
            .limit(1);

          if (historyError) continue;

          const lastPrice = priceHistory?.[0];
          if (lastPrice) {
            priceOld = lastPrice.price_cents_old || 0;
            percentageChange = lastPrice.percentage_change || 0;
          }

          const cardName = variant.cards?.name || 'Unknown Card';
          const setName = variant.cards?.sets?.name || 'Unknown Set';

          // Check alert conditions
          if (alert.alert_type === 'price_drop' && alert.target_price_cents) {
            shouldTrigger = priceNew <= alert.target_price_cents;
            alertMessage = `${cardName} (${setName}) has dropped to $${(priceNew / 100).toFixed(2)} - below your target of $${(alert.target_price_cents / 100).toFixed(2)}`;
          } else if (alert.alert_type === 'price_rise' && alert.target_price_cents) {
            shouldTrigger = priceNew >= alert.target_price_cents;
            alertMessage = `${cardName} (${setName}) has risen to $${(priceNew / 100).toFixed(2)} - above your target of $${(alert.target_price_cents / 100).toFixed(2)}`;
          } else if (alert.alert_type === 'percentage_change' && alert.percentage_threshold) {
            shouldTrigger = Math.abs(percentageChange) >= alert.percentage_threshold;
            alertMessage = `${cardName} (${setName}) has changed by ${percentageChange > 0 ? '+' : ''}${percentageChange.toFixed(2)}% to $${(priceNew / 100).toFixed(2)}`;
          }

        } else if (alert.product_type === 'sealed' && alert.sealed_product_id) {
          // Check sealed product variants for price changes
          const { data: sealedVariants, error: sealedError } = await supabase
            .from('sealed_variants')
            .select(`
              *,
              sealed_products!inner (name, category)
            `)
            .eq('sealed_product_id', alert.sealed_product_id)
            .eq('language', alert.language_filter)
            .order('last_updated', { ascending: false })
            .limit(1);

          if (sealedError) {
            console.error('Error fetching sealed variants:', sealedError);
            continue;
          }

          const sealedVariant = sealedVariants?.[0];
          if (!sealedVariant || !sealedVariant.price_cents) continue;

          priceNew = sealedVariant.price_cents;

          // Get historical price for comparison
          const { data: sealedHistory, error: sealedHistoryError } = await supabase
            .from('price_history')
            .select('price_cents_old, price_cents_new, percentage_change')
            .eq('sealed_variant_id', sealedVariant.id)
            .order('recorded_at', { ascending: false })
            .limit(1);

          if (sealedHistoryError) continue;

          const lastSealedPrice = sealedHistory?.[0];
          if (lastSealedPrice) {
            priceOld = lastSealedPrice.price_cents_old || 0;
            percentageChange = lastSealedPrice.percentage_change || 0;
          }

          const productName = sealedVariant.sealed_products?.name || 'Unknown Product';

          // Check alert conditions for sealed products
          if (alert.alert_type === 'price_drop' && alert.target_price_cents) {
            shouldTrigger = priceNew <= alert.target_price_cents;
            alertMessage = `${productName} has dropped to $${(priceNew / 100).toFixed(2)} - below your target of $${(alert.target_price_cents / 100).toFixed(2)}`;
          } else if (alert.alert_type === 'back_in_stock') {
            shouldTrigger = sealedVariant.is_available && (!lastSealedPrice || priceOld === 0);
            alertMessage = `${productName} is back in stock at $${(priceNew / 100).toFixed(2)}`;
          }
        }

        if (shouldTrigger) {
          notifications.push({
            alert_id: alert.id,
            user_id: alert.user_id,
            message: alertMessage,
            price_old_cents: priceOld,
            price_new_cents: priceNew,
            percentage_change: percentageChange,
          });

          // Update alert triggered count and timestamp
          await supabase
            .from('price_alerts')
            .update({
              triggered_count: (alert.triggered_count || 0) + 1,
              last_triggered_at: new Date().toISOString()
            })
            .eq('id', alert.id);

          alertsTriggered++;
        }

      } catch (error) {
        console.error(`Error processing alert ${alert.id}:`, error);
        continue;
      }
    }

    // Batch insert notifications
    if (notifications.length > 0) {
      const { error: notificationError } = await supabase
        .from('alert_notifications')
        .insert(notifications);

      if (notificationError) {
        console.error('Error creating notifications:', notificationError);
      }
    }

    console.log(`✅ Price tracking completed. ${alertsTriggered} alerts triggered.`);

    return new Response(
      JSON.stringify({
        success: true,
        alerts_processed: alerts?.length || 0,
        alerts_triggered: alertsTriggered,
        notifications_created: notifications.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Price tracker error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});