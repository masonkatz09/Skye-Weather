export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  const { type, lat, lon, q } = req.query;

  try {
    // ── SEARCH: Handles Postal Codes, Cities, and Lat/Lon ──────────────────
    if (type === 'search') {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en&format=json`;
      const data = await (await fetch(url)).json();
      if (data.results && data.results.length > 0) {
        const r = data.results[0];
        return res.json({ lat: r.latitude, lon: r.longitude, city: r.name, admin: r.admin1 });
      }
      return res.status(404).json({ error: 'Location not found' });
    }

    // ── FORECAST: Restores your high-res data ──────────────────
    if (type === 'forecast') {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,relative_humidity_2m,uv_index,precipitation&hourly=temperature_2m,precipitation_probability,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset&wind_speed_unit=kmh&temperature_unit=celsius&timezone=auto&forecast_days=7&models=gem_seamless`;
      return res.json(await (await fetch(url)).json());
    }

    // ── ALERTS: Real Environment Canada Data ──────────────────
    if (type === 'alerts') {
      const la = parseFloat(lat), lo = parseFloat(lon);
      const alertUrl = `https://api.weather.gc.ca/collections/weather-alerts/items?bbox=${lo-0.1},${la-0.1},${lo+0.1},${la+0.1}`;
      const data = await (await fetch(alertUrl)).json();
      return res.json({ 
        alerts: (data.features || []).map(f => ({ 
          title: f.properties.headline_en || f.properties.event_en 
        })) 
      });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
