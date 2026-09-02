// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: any;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Calatrava, Romblon Marine Coordinates
const LATITUDE = 12.6186;
const LONGITUDE = 122.0722;

Deno.serve(async () => {
  try {
    // 1. Fetch live marine & wind data for Calatrava waters from Open-Meteo
    const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${LATITUDE}&longitude=${LONGITUDE}&current=wave_height&wind_speed_unit=kmh`;
    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}&current=wind_speed_10m,wind_gusts_10m`;

    const [marineRes, forecastRes] = await Promise.all([
      fetch(marineUrl).then((res) => res.json()),
      fetch(forecastUrl).then((res) => res.json()),
    ]);

    const waveHeight = Number(marineRes.current?.wave_height ?? 0.6);
    const windSpeed = Number(forecastRes.current?.wind_speed_10m ?? 12);
    const windGusts = Number(forecastRes.current?.wind_gusts_10m ?? 18);

    // 2. Classify advisory based on maritime safety thresholds
    let condition = 'Calm / Safe for Boats';
    let message = 'Normal sea operations permitted across Calatrava waters.';

    if (waveHeight >= 2.0 || windSpeed >= 35 || windGusts >= 45) {
      condition = 'Rough / High Waves';
      message = `Waves up to ${waveHeight.toFixed(1)}m and ${Math.round(windSpeed)} km/h winds. Boat tours temporarily suspended.`;
    } else if (waveHeight >= 1.2 || windSpeed >= 22) {
      condition = 'Moderate / Exercise Caution';
      message = `Waves around ${waveHeight.toFixed(1)}m with brisk breezes. Small sea vessels advised to exercise caution.`;
    }

    // 3. Mark prior advisories inactive
    await supabase
      .from('advisories')
      .update({ is_active: false })
      .eq('is_active', true);

    // 4. Insert latest automated advisory
    const { error: insertError } = await supabase.from('advisories').insert([
      {
        sea_condition: condition,
        advisory_message: message,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
    ]);

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({
        success: true,
        condition,
        message,
        waveHeight,
        windSpeed,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});