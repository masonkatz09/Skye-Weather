export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { type, lat, lon, city, postal, country } = req.query;

  try {
    // ── WEATHER FORECAST ──────────────────────────────────────
    if (type === 'forecast') {
      const url = `https://api.open-meteo.com/v1/forecast`
        + `?latitude=${lat}&longitude=${lon}`
        + `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,relative_humidity_2m,uv_index,precipitation`
        + `&hourly=temperature_2m,precipitation_probability,weather_code`
        + `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset`
        + `&wind_speed_unit=kmh&temperature_unit=celsius&timezone=auto&forecast_days=7&models=gem_seamless`;
      const r = await fetch(url);
      const d = await r.json();
      return res.json(d);
    }

    // ── EC CITYPAGE (current conditions + warnings for Canada) ─
    if (type === 'ec') {
      const EC_CODES = {
        toronto:'ON/s0000458', montreal:'QC/s0000635', vancouver:'BC/s0000141',
        calgary:'AB/s0000047', edmonton:'AB/s0000045', ottawa:'ON/s0000430',
        winnipeg:'MB/s0000193', hamilton:'ON/s0000568', london:'ON/s0000326',
        halifax:'NS/s0000318', victoria:'BC/s0000775', saskatoon:'SK/s0000797',
        regina:'SK/s0000788', fredericton:'NB/s0000250', charlottetown:'PE/s0000583',
        whitehorse:'YT/s0000825', yellowknife:'NT/s0000366', iqaluit:'NU/s0000394',
        mississauga:'ON/s0000582', brampton:'ON/s0000597', surrey:'BC/s0000813',
        barrie:'ON/s0000568', kitchener:'ON/s0000574', markham:'ON/s0000669',
        oakville:'ON/s0000490', 'thunder bay':'ON/s0000411', windsor:'ON/s0000500',
        sudbury:'ON/s0000397', kingston:'ON/s0000574', guelph:'ON/s0000568',
        'st. john\'s':'NL/s0000280', 'saint john':'NB/s0000269', moncton:'NB/s0000661',
        lethbridge:'AB/s0000742', 'red deer':'AB/s0000045', kelowna:'BC/s0000592',
        abbotsford:'BC/s0000034', burnaby:'BC/s0000141', richmond:'BC/s0000141',
        nanaimo:'BC/s0000394', kamloops:'BC/s0000568', 'prince george':'BC/s0000584'
      };
      const key = (city || '').toLowerCase().trim().replace(/,.*$/, '');
      const code = EC_CODES[key];
      if (!code) return res.json({ warnings: [], ecTemp: null, ecCond: null });

      const ecUrl = `https://dd.weather.gc.ca/citypage_weather/xml/${code}_e.xml`;
      const r = await fetch(ecUrl, { headers: { 'User-Agent': 'SkyeWeather/1.0' } });
      if (!r.ok) return res.json({ warnings: [], ecTemp: null, ecCond: null });
      const xml = await r.text();

      // Parse warnings
      const warnings = [];
      const warnMatches = xml.matchAll(/<event[^>]*type="([^"]*)"[^>]*priority="([^"]*)"[^>]*>[\s\S]*?<description[^>]*>([\s\S]*?)<\/description>/gi);
      for (const m of warnMatches) {
        const type = m[1], priority = m[2], desc = m[3].replace(/<[^>]+>/g, '').trim();
        if (desc && !desc.toLowerCase().includes('no watches') && !desc.toLowerCase().includes('no warning')) {
          warnings.push({
            type,
            title: desc.slice(0, 200),
            severity: priority === 'high' ? 'severe' : priority === 'medium' ? 'moderate' : 'minor'
          });
        }
      }

      // Parse current conditions
      const tempMatch = xml.match(/<temperature[^>]*unitType="metric"[^>]*>([\d.-]+)<\/temperature>/);
      const condMatch = xml.match(/<condition>(.*?)<\/condition>/);
      const ecTemp = tempMatch ? parseFloat(tempMatch[1]) : null;
      const ecCond = condMatch ? condMatch[1].trim() : null;

      return res.json({ warnings, ecTemp, ecCond });
    }

    // ── GLOBAL WEATHER ALERTS (all countries via OpenMeteo + NWS) ─
    if (type === 'alerts') {
      const isCanada = parseFloat(lat) > 41 && parseFloat(lat) < 84 && parseFloat(lon) > -141 && parseFloat(lon) < -52;
      const isUS = parseFloat(lat) > 24 && parseFloat(lat) < 50 && parseFloat(lon) > -125 && parseFloat(lon) < -66;

      if (isCanada) {
        // Try EC national alerts RSS
        const r = await fetch(`https://www.weather.gc.ca/rss/warning/on-96_e.xml`, { headers: { 'User-Agent': 'SkyeWeather/1.0' } });
        if (r.ok) {
          const xml = await r.text();
          const alerts = [];
          const entries = xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi);
          for (const e of entries) {
            const titleM = e[1].match(/<title[^>]*>([\s\S]*?)<\/title>/i);
            const summaryM = e[1].match(/<summary[^>]*>([\s\S]*?)<\/summary>/i);
            const title = titleM ? titleM[1].replace(/<[^>]+>/g,'').trim() : '';
            const summary = summaryM ? summaryM[1].replace(/<[^>]+>/g,'').trim() : '';
            if (title && !title.toLowerCase().includes('no watches') && !title.toLowerCase().includes('aucun')) {
              const sev = title.toLowerCase().includes('warning') ? 'severe' : title.toLowerCase().includes('watch') ? 'moderate' : 'minor';
              alerts.push({ type: title.split(' issued')[0].split(' en vigueur')[0], title: summary.slice(0, 200), severity: sev });
            }
          }
          return res.json({ alerts });
        }
      }

      if (isUS) {
        // US National Weather Service — official free API with CORS
        const r = await fetch(`https://api.weather.gov/alerts/active?point=${parseFloat(lat).toFixed(4)},${parseFloat(lon).toFixed(4)}`, {
          headers: { 'User-Agent': 'SkyeWeather/1.0 contact@mkplusservices.com', 'Accept': 'application/geo+json' }
        });
        if (r.ok) {
          const d = await r.json();
          const alerts = (d.features || []).slice(0, 5).map(f => ({
            type: f.properties?.event || 'Weather Alert',
            title: f.properties?.headline || f.properties?.description?.slice(0, 200) || '',
            severity: (f.properties?.severity || 'minor').toLowerCase()
          }));
          return res.json({ alerts });
        }
      }

      return res.json({ alerts: [] });
    }

    // ── POSTAL CODE / ZIP LOOKUP ───────────────────────────────
    if (type === 'postal') {
      const isCA = /^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/.test(postal);
      const isUS = /^\d{5}$/.test(postal);
      const cc = isCA ? 'ca' : isUS ? 'us' : (country || 'ca');
      const clean = postal.replace(/\s/g, '').toUpperCase();

      // Try structured postal code lookup first
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(clean)}&countrycodes=${cc}&format=json&addressdetails=1&limit=5`,
        { headers: { 'User-Agent': 'SkyeWeather/1.0', 'Accept-Language': 'en' } }
      );
      const d = await r.json();
      if (d && d.length) return res.json(d);

      // Fallback: free-text search
      const r2 = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(clean + (isCA ? ' Canada' : ''))}&format=json&addressdetails=1&limit=5`,
        { headers: { 'User-Agent': 'SkyeWeather/1.0', 'Accept-Language': 'en' } }
      );
      const d2 = await r2.json();
      return res.json(d2 || []);
    }

    res.status(400).json({ error: 'Unknown type' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
