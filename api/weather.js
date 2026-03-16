export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  const { type, lat, lon, q } = req.query;

  try {
    // ── SEARCH (City & Postal/ZIP Codes) ─────────────────────
    if (type === 'search') {
      const query = q;
      // Open-Meteo Geocoding handles both ZIP and CA Postal Codes (e.g. M5V) automatically
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        const result = data.results[0];
        return res.json({
          lat: result.latitude,
          lon: result.longitude,
          city: result.name,
          admin: result.admin1
        });
      }
      return res.status(404).json({ error: 'Location not found' });
    }

    // ── FORECAST ──────────────────────────────────────────────
    if (type === 'forecast') {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,relative_humidity_2m,uv_index,precipitation&hourly=temperature_2m,precipitation_probability,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset&wind_speed_unit=kmh&temperature_unit=celsius&timezone=auto&forecast_days=7&models=gem_seamless`;
      const response = await fetch(url);
      return res.json(await response.json());
    }

    // ── ALERTS (Environment Canada) ───────────────────────────
    if (type === 'alerts') {
      const la = parseFloat(lat), lo = parseFloat(lon);
      // Fetches alerts within a small bounding box around the coordinates
      const alertUrl = `https://api.weather.gc.ca/collections/weather-alerts/items?bbox=${lo-0.1},${la-0.1},${lo+0.1},${la+0.1}`;
      const response = await fetch(alertUrl);
      const data = await response.json();
      
      const activeAlerts = (data.features || []).map(f => ({
        type: f.properties.alert_type === 'warning' ? 'Warning' : 'Statement',
        title: f.properties.headline_en || f.properties.event_en,
        severity: f.properties.alert_type === 'warning' ? 'severe' : 'moderate',
        description: f.properties.description_en
      }));
      return res.json({ alerts: activeAlerts });
    }

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
