export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { type, lat, lon, city, postal } = req.query;

  try {

    // ── WEATHER FORECAST ────────────────────────────────────
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

    // ── EC CITYPAGE — current conditions + warnings ─────────
    if (type === 'ec') {
      const EC = {
        'toronto':'ON/s0000458','montreal':'QC/s0000635','vancouver':'BC/s0000141',
        'calgary':'AB/s0000047','edmonton':'AB/s0000045','ottawa':'ON/s0000430',
        'winnipeg':'MB/s0000193','hamilton':'ON/s0000568','london':'ON/s0000326',
        'halifax':'NS/s0000318','victoria':'BC/s0000775','saskatoon':'SK/s0000797',
        'regina':'SK/s0000788','fredericton':'NB/s0000250','charlottetown':'PE/s0000583',
        'whitehorse':'YT/s0000825','yellowknife':'NT/s0000366','iqaluit':'NU/s0000394',
        'mississauga':'ON/s0000582','brampton':'ON/s0000597','surrey':'BC/s0000813',
        'barrie':'ON/s0000568','kitchener':'ON/s0000574','markham':'ON/s0000669',
        'oakville':'ON/s0000490','windsor':'ON/s0000500','sudbury':'ON/s0000397',
        'thunder bay':'ON/s0000411','kingston':'ON/s0000574','guelph':'ON/s0000568',
        'st. john\'s':'NL/s0000280','saint john':'NB/s0000269','moncton':'NB/s0000661',
        'lethbridge':'AB/s0000742','red deer':'AB/s0000045','kelowna':'BC/s0000592',
        'abbotsford':'BC/s0000034','nanaimo':'BC/s0000394','kamloops':'BC/s0000568',
        'prince george':'BC/s0000584','burnaby':'BC/s0000141','richmond':'BC/s0000141'
      };

      const key = (city||'').toLowerCase().trim().replace(/,.*$/,'');
      const code = EC[key];
      if(!code) return res.json({ warnings:[], ecTemp:null, ecCond:null });

      const r = await fetch(`https://dd.weather.gc.ca/citypage_weather/xml/${code}_e.xml`, {
        headers: { 'User-Agent': 'SkyeWeather/1.0 (mkplusservices.com)' }
      });
      if(!r.ok) return res.json({ warnings:[], ecTemp:null, ecCond:null });

      const xml = await r.text();
      const warnings = [];

      // Parse warnings
      const warnReg = /<event[^>]*type="([^"]*)"[^>]*priority="([^"]*)"[^>]*>[\s\S]*?<description[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/description>/gi;
      let m;
      while((m=warnReg.exec(xml))!==null){
        const desc = m[3].trim();
        if(desc && !desc.toLowerCase().includes('no watches') && !desc.toLowerCase().includes('no warning')){
          warnings.push({
            type: m[1]||'Weather Alert',
            title: desc.replace(/\s+/g,' ').slice(0,200),
            severity: m[2]==='high'?'severe':m[2]==='medium'?'moderate':'minor'
          });
        }
      }
      // Also try without CDATA
      const warnReg2 = /<event[^>]*type="([^"]*)"[^>]*priority="([^"]*)"[^>]*>[\s\S]*?<description[^>]*>([\s\S]*?)<\/description>/gi;
      while((m=warnReg2.exec(xml))!==null){
        const desc = m[3].replace(/<[^>]+>/g,'').trim();
        if(desc && !desc.toLowerCase().includes('no watches') && warnings.length===0){
          warnings.push({
            type: m[1]||'Weather Alert',
            title: desc.replace(/\s+/g,' ').slice(0,200),
            severity: m[2]==='high'?'severe':m[2]==='medium'?'moderate':'minor'
          });
        }
      }

      // Current temp and condition
      const tempM = xml.match(/<temperature[^>]*unitType="metric"[^>]*>([\d.-]+)<\/temperature>/);
      const condM = xml.match(/<condition>(.*?)<\/condition>/);
      const ecTemp = tempM ? parseFloat(tempM[1]) : null;
      const ecCond = condM ? condM[1].trim() : null;

      return res.json({ warnings, ecTemp, ecCond });
    }

    // ── GLOBAL ALERTS ────────────────────────────────────────
    if (type === 'alerts') {
      const la = parseFloat(lat), lo = parseFloat(lon);
      const isCA = la>41 && la<84 && lo>-141 && lo<-52;
      const isUS = la>24 && la<50 && lo>-125 && lo<-66;
      const alerts = [];

      if(isCA){
        // Try EC national RSS for the relevant province
        const provinces = {
          ON: la>41&&la<57&&lo>-95&&lo<-74,
          BC: la>48&&la<60&&lo>-139&&lo<-114,
          AB: la>49&&la<60&&lo>-120&&lo<-110,
          QC: la>45&&la<63&&lo>-79&&lo<-57,
          MB: la>49&&la<60&&lo>-102&&lo<-89,
          SK: la>49&&la<60&&lo>-110&&lo<-101,
          NS: la>43&&la<47&&lo>-66&&lo<-59,
          NB: la>44&&la<48&&lo>-69&&lo<-63,
          NL: la>46&&la<61&&lo>-68&&lo<-52,
          PE: la>45&&la<47&&lo>-64&&lo<-62
        };
        // EC RSS region codes — maps province to main warning region
        const provRSS = {
          ON:'on-96', BC:'bc-48', AB:'ab-49', QC:'qc-71', MB:'mb-38',
          SK:'sk-69', NS:'ns-19', NB:'nb-29', NL:'nl-33', PE:'pe-65'
        };
        let provKey = 'ON';
        for(const [code, match] of Object.entries(provinces)){
          if(match){ provKey=code; break; }
        }
        const rssCode = provRSS[provKey] || 'on-96';
        try{
          const rssUrl = `https://www.weather.gc.ca/rss/warning/${rssCode}_e.xml`;
          const r = await fetch(rssUrl, { headers:{'User-Agent':'SkyeWeather/1.0'} });
          if(r.ok){
            const xml = await r.text();
            const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)];
            for(const e of entries){
              const titleM = e[1].match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
              const summaryM = e[1].match(/<summary[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/summary>/i);
              const title = titleM?titleM[1].replace(/<[^>]+>/g,'').trim():'';
              const summary = summaryM?summaryM[1].replace(/<[^>]+>/g,'').trim():'';
              if(title && !title.toLowerCase().includes('no watches') && !title.toLowerCase().includes('no warning') && !title.toLowerCase().includes('aucun')){
                const sev = title.toLowerCase().includes('warning')?'severe':title.toLowerCase().includes('watch')?'moderate':'minor';
                alerts.push({ type:title.split(' issued')[0].split(' en vigueur')[0].trim(), title:summary.slice(0,200)||title, severity:sev });
              }
            }
          }
        }catch(e){}
      }

      if(isUS){
        try{
          const r = await fetch(`https://api.weather.gov/alerts/active?point=${la.toFixed(4)},${lo.toFixed(4)}`, {
            headers:{ 'User-Agent':'SkyeWeather/1.0 (mkplusservices.com)', 'Accept':'application/geo+json' }
          });
          if(r.ok){
            const d = await r.json();
            (d.features||[]).slice(0,4).forEach(f=>{
              alerts.push({
                type: f.properties?.event||'Weather Alert',
                title: (f.properties?.headline||f.properties?.description||'').slice(0,200),
                severity: (f.properties?.severity||'minor').toLowerCase()
              });
            });
          }
        }catch(e){}
      }

      return res.json({ alerts });
    }

    // ── POSTAL / ZIP LOOKUP ──────────────────────────────────
    if (type === 'postal') {
      const isCA = /^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/.test(postal);
      const isUS = /^\d{5}$/.test(postal);
      const cc   = isCA ? 'ca' : isUS ? 'us' : 'ca';
      const clean = postal.replace(/\s/g,'').toUpperCase();
      // Canadian postal needs space in middle for Nominatim (M6C 3E9 not M6C3E9)
      const formatted = isCA ? clean.slice(0,3)+' '+clean.slice(3) : clean;

      // Try 1: structured postalcode with country lock
      const r1 = await fetch(
        `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(formatted)}&countrycodes=${cc}&format=json&addressdetails=1&limit=5`,
        { headers:{ 'User-Agent':'SkyeWeather/1.0 (mkplusservices.com)', 'Accept-Language':'en' } }
      );
      const d1 = await r1.json();
      if(d1&&d1.length) return res.json(d1);

      // Try 2: free-text ALWAYS locked to correct country — never search globally
      const countryName = isCA ? 'Canada' : isUS ? 'United States' : 'Canada';
      const r2 = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(formatted+', '+countryName)}&countrycodes=${cc}&format=json&addressdetails=1&limit=5`,
        { headers:{ 'User-Agent':'SkyeWeather/1.0 (mkplusservices.com)', 'Accept-Language':'en' } }
      );
      const d2 = await r2.json();
      if(d2&&d2.length) return res.json(d2);

      // Try 3: FSA only (first 3 chars) for broader Canadian match
      if(isCA){
        const r3 = await fetch(
          `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(clean.slice(0,3))}&countrycodes=ca&format=json&addressdetails=1&limit=5`,
          { headers:{ 'User-Agent':'SkyeWeather/1.0 (mkplusservices.com)', 'Accept-Language':'en' } }
        );
        const d3 = await r3.json();
        if(d3&&d3.length) return res.json(d3);
      }

      return res.json([]);
    }

    res.status(400).json({ error:'Unknown type' });

  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
