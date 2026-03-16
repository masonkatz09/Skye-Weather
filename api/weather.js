export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  const { type, lat, lon, city, postal } = req.query;

  try {

    // ── FORECAST ──────────────────────────────────────────────
    if (type === 'forecast') {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,relative_humidity_2m,uv_index,precipitation&hourly=temperature_2m,precipitation_probability,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset&wind_speed_unit=kmh&temperature_unit=celsius&timezone=auto&forecast_days=7&models=gem_seamless`;
      return res.json(await (await fetch(url)).json());
    }

    // ── EC CITYPAGE — current conditions + warnings ────────────
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
        "st. john's":'NL/s0000280','saint john':'NB/s0000269','moncton':'NB/s0000661',
        'lethbridge':'AB/s0000742','red deer':'AB/s0000045','kelowna':'BC/s0000592',
        'nanaimo':'BC/s0000394','kamloops':'BC/s0000568','prince george':'BC/s0000584',
        'burnaby':'BC/s0000141','richmond':'BC/s0000141','abbotsford':'BC/s0000034',
        'richmond hill':'ON/s0000651','vaughan':'ON/s0000782','oshawa':'ON/s0000574',
        'waterloo':'ON/s0000574','brantford':'ON/s0000568','niagara falls':'ON/s0000326'
      };
      const key = (city||'').toLowerCase().trim().replace(/,.*$/,'');
      const code = EC[key];
      if (!code) return res.json({warnings:[],ecTemp:null,ecCond:null});

      const r = await fetch(`https://dd.weather.gc.ca/citypage_weather/xml/${code}_e.xml`,{headers:{'User-Agent':'SkyeWeather/1.0 (mkplusservices.com)'}});
      if (!r.ok) return res.json({warnings:[],ecTemp:null,ecCond:null});
      const xml = await r.text();

      const warnings = [];
      for (const m of [...xml.matchAll(/<event([^>]*)>([\s\S]*?)<\/event>/gi)]) {
        const typeM = m[1].match(/type="([^"]*)"/i);
        const prioM = m[1].match(/priority="([^"]*)"/i);
        const urlM  = m[1].match(/url="([^"]*)"/i);
        const descM = m[2].match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);
        if (descM) {
          const desc = descM[1].replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
          if (desc && desc.length>5 && !desc.toLowerCase().includes('no watches') && !desc.toLowerCase().includes('no warning') && !desc.toLowerCase().includes('no special')) {
            warnings.push({
              type: typeM?typeM[1]:'Weather Alert',
              title: desc,
              url: urlM?urlM[1]:null,
              severity: prioM&&prioM[1]==='high'?'severe':prioM&&prioM[1]==='medium'?'moderate':'minor'
            });
          }
        }
      }
      const tempM = xml.match(/<temperature[^>]*unitType="metric"[^>]*>([\d.-]+)<\/temperature>/);
      const condM = xml.match(/<condition>(.*?)<\/condition>/);
      return res.json({warnings,ecTemp:tempM?parseFloat(tempM[1]):null,ecCond:condM?condM[1].trim():null});
    }

    // ── FULL ALERT TEXT ────────────────────────────────────────
    // Fetch the full text bulletin from EC's public bulletin server
    if (type === 'alerttext') {
      const la = parseFloat(lat), lo = parseFloat(lon);
      // EC public bulletin codes by province/region
      // These are AAFC CWAO bulletins — the actual text that meteorologists write
      const getBulletin = (la, lo) => {
        if (la>41&&la<57&&lo>-95&&lo<-74)  return 'ONCN14 CWTO'; // Ontario south
        if (la>57&&la<69&&lo>-95&&lo<-74)  return 'ONCN12 CWTO'; // Ontario north
        if (la>48&&la<60&&lo>-139&&lo<-114) return 'BCCN14 CWVR'; // BC south
        if (la>49&&la<60&&lo>-120&&lo<-110) return 'ABCN14 CWWG'; // Alberta
        if (la>45&&la<63&&lo>-79&&lo<-57)   return 'QCCN14 CWUL'; // Quebec
        if (la>49&&la<60&&lo>-102&&lo<-89)  return 'MNCN14 CWWG'; // Manitoba
        if (la>49&&la<60&&lo>-110&&lo<-101) return 'SKCN14 CWWG'; // Saskatchewan
        if (la>43&&la<47&&lo>-66&&lo<-59)   return 'NSCN14 CWHX'; // Nova Scotia
        if (la>44&&la<48&&lo>-69&&lo<-63)   return 'NBCN14 CWMX'; // NB
        if (la>46&&la<61&&lo>-68&&lo<-52)   return 'NLCN14 CWYR'; // NL
        return 'ONCN14 CWTO';
      };

      // Try to fetch from battleboard which has the most detail
      const bb = getBattleboardCode(la, lo);
      const r = await fetch(`https://weather.gc.ca/rss/battleboard/${bb}_e.xml`,{headers:{'User-Agent':'SkyeWeather/1.0 (mkplusservices.com)'}});
      if (!r.ok) return res.json({text:''});
      const xml = await r.text();

      // Extract all entry summaries and content
      const texts = [];
      for (const e of [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)]) {
        const titleM = e[1].match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
        const summaryM = e[1].match(/<summary[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/summary>/i);
        const contentM = e[1].match(/<content[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content>/i);
        const title = titleM?titleM[1].replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').trim():'';
        const summary = summaryM?summaryM[1].replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').trim():'';
        const content = contentM?contentM[1].replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').trim():'';
        if (!title) continue;
        const tl = title.toLowerCase();
        if (tl.includes('no watches')||tl.includes('no warning')||tl.includes('aucun')) continue;
        if (!tl.includes('warning')&&!tl.includes('watch')&&!tl.includes('advisory')&&!tl.includes('statement')&&!tl.includes('alert')) continue;
        texts.push({title, summary, content});
      }
      return res.json({texts});
    }

    // ── GLOBAL ALERTS ─────────────────────────────────────────
    if (type === 'alerts') {
      const la=parseFloat(lat),lo=parseFloat(lon);
      const isCA=la>41&&la<84&&lo>-141&&lo<-52;
      const isUS=la>24&&la<50&&lo>-125&&lo<-66;
      const alerts=[];

      if (isCA) {
        const bb = getBattleboardCode(la, lo);
        try {
          const r = await fetch(`https://weather.gc.ca/rss/battleboard/${bb}_e.xml`,{headers:{'User-Agent':'SkyeWeather/1.0 (mkplusservices.com)'}});
          if (r.ok) {
            const xml = await r.text();
            for (const e of [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)]) {
              const tM = e[1].match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
              const sM = e[1].match(/<summary[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/summary>/i);
              const pubM = e[1].match(/<published>([\s\S]*?)<\/published>/i);
              const updM = e[1].match(/<updated>([\s\S]*?)<\/updated>/i);
              const impM = e[1].match(/<impact>([\s\S]*?)<\/impact>/i);
              const title   = tM ? tM[1].replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').trim() : '';
              const summary = sM ? sM[1].replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').trim() : '';
              const published = pubM?pubM[1].trim():updM?updM[1].trim():'';
              const impact = impM?impM[1].trim():'';
              if (!title) continue;
              const tl = title.toLowerCase();
              if (tl.includes('no watches')||tl.includes('no warning')||tl.includes('aucun')||tl.includes('no special')||tl.includes('en vigueur')) continue;
              if (!tl.includes('warning')&&!tl.includes('watch')&&!tl.includes('advisory')&&!tl.includes('statement')&&!tl.includes('alert')) continue;
              const sev = tl.includes('warning')?'severe':tl.includes('watch')?'moderate':'minor';
              // The summary in battleboard is just the issued time like "Issued: 10:46 AM EST Friday 30 January 2026"
              // The real full text needs to come from the EC citypage XML warnings url field
              alerts.push({
                type: title.replace(/^(YELLOW|RED|ORANGE|GREEN)\s+(WARNING|WATCH|ADVISORY|STATEMENT)\s*[-–]?\s*/i,'').split(' issued')[0].split(' –')[0].trim(),
                title: title, // Keep full title including severity color
                issuedTime: summary, // "Issued: 10:46 AM EST..."
                impact: impact,
                severity: sev,
                published: published
              });
            }
          }
        } catch(e) {}
      }

      if (isUS) {
        try {
          const r = await fetch(`https://api.weather.gov/alerts/active?point=${la.toFixed(4)},${lo.toFixed(4)}`,{headers:{'User-Agent':'SkyeWeather/1.0 (mkplusservices.com)','Accept':'application/geo+json'}});
          if (r.ok) {
            const d = await r.json();
            (d.features||[]).slice(0,4).forEach(f=>alerts.push({
              type: f.properties?.event||'Weather Alert',
              title: f.properties?.event||'Weather Alert',
              issuedTime: f.properties?.sent ? new Date(f.properties.sent).toLocaleString('en-US',{weekday:'long',month:'long',day:'numeric',hour:'numeric',minute:'2-digit',hour12:true,timeZoneName:'short'}) : '',
              fullText: (f.properties?.description||'')+(f.properties?.instruction?'\n\nWHAT YOU SHOULD DO:\n'+f.properties.instruction:''),
              severity: (f.properties?.severity||'minor').toLowerCase()
            }));
          }
        } catch(e) {}
      }

      return res.json({alerts});
    }

    // ── FULL ALERT DETAIL ─────────────────────────────────────
    // Fetch the complete EC warning text from the citypage XML for a specific city
    if (type === 'alertdetail') {
      const EC = {
        'toronto':'ON/s0000458','montreal':'QC/s0000635','vancouver':'BC/s0000141',
        'calgary':'AB/s0000047','edmonton':'AB/s0000045','ottawa':'ON/s0000430',
        'winnipeg':'MB/s0000193','hamilton':'ON/s0000568','london':'ON/s0000326',
        'halifax':'NS/s0000318','victoria':'BC/s0000775','saskatoon':'SK/s0000797',
        'regina':'SK/s0000788','mississauga':'ON/s0000582','brampton':'ON/s0000597',
        'surrey':'BC/s0000813','barrie':'ON/s0000568','kitchener':'ON/s0000574',
        'markham':'ON/s0000669','oakville':'ON/s0000490','windsor':'ON/s0000500',
        'sudbury':'ON/s0000397','thunder bay':'ON/s0000411','guelph':'ON/s0000568',
        "st. john's":'NL/s0000280','moncton':'NB/s0000661','kelowna':'BC/s0000592'
      };
      const key = (city||'').toLowerCase().trim().replace(/,.*$/,'');
      const code = EC[key];
      if (!code) return res.json({fullText:'', issuedTime:''});

      const r = await fetch(`https://dd.weather.gc.ca/citypage_weather/xml/${code}_e.xml`,{headers:{'User-Agent':'SkyeWeather/1.0 (mkplusservices.com)'}});
      if (!r.ok) return res.json({fullText:'', issuedTime:''});
      const xml = await r.text();

      // Extract full warning text from the XML
      // The citypage XML has <warnings> with <event> elements containing full description
      const fullTexts = [];
      let issuedTime = '';

      for (const m of [...xml.matchAll(/<event([^>]*)>([\s\S]*?)<\/event>/gi)]) {
        const inner = m[2];
        const descM = inner.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);
        const dateM = inner.match(/<dateTime[^>]*>([\s\S]*?)<\/dateTime>/i);
        if (descM) {
          const desc = descM[1].replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
          if (desc && desc.length > 10 && !desc.toLowerCase().includes('no watches') && !desc.toLowerCase().includes('no warning')) {
            fullTexts.push(desc);
          }
        }
        if (dateM && !issuedTime) {
          issuedTime = dateM[1].trim();
        }
      }

      // Also try to get the full text from EC's public ATOM feed which has more detail
      // The real full bulletin text
      const bb = getBattleboardCode(parseFloat(lat), parseFloat(lon));
      let bulletinText = '';
      try {
        const r2 = await fetch(`https://weather.gc.ca/rss/battleboard/${bb}_e.xml`,{headers:{'User-Agent':'SkyeWeather/1.0 (mkplusservices.com)'}});
        if (r2.ok) {
          const xml2 = await r2.text();
          // Get all entry content
          for (const e of [...xml2.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)]) {
            const tM = e[1].match(/<title[^>]*>([\s\S]*?)<\/title>/i);
            const sM = e[1].match(/<summary[^>]*>([\s\S]*?)<\/summary>/i);
            const pubM = e[1].match(/<published>([\s\S]*?)<\/published>/i);
            const title = tM?tM[1].replace(/<[^>]+>/g,'').trim():'';
            const summary = sM?sM[1].replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&#39;/g,"'").trim():'';
            const pub = pubM?pubM[1].trim():'';
            if (!title) continue;
            const tl = title.toLowerCase();
            if (tl.includes('no watches')||tl.includes('no warning')||tl.includes('aucun')) continue;
            if (!tl.includes('warning')&&!tl.includes('watch')&&!tl.includes('advisory')&&!tl.includes('statement')&&!tl.includes('alert')) continue;
            if (summary) bulletinText += summary + '\n\n';
            if (pub && !issuedTime) issuedTime = pub;
          }
        }
      } catch(e) {}

      const combined = [...fullTexts].join('\n\n') + (bulletinText ? '\n\n' + bulletinText : '');
      return res.json({fullText: combined.trim(), issuedTime});
    }

    // ── POSTAL / ZIP LOOKUP ────────────────────────────────────
    if (type === 'postal') {
      const raw = (postal||'').trim().toUpperCase().replace(/\s/g,'');
      const isCA = /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(raw);
      const isUS = /^\d{5}$/.test(raw);

      if (isCA) {
        const fsa = raw.slice(0,3);
        const formatted = raw.slice(0,3)+' '+raw.slice(3);

        // FSA centroid coordinates — precise lat/lon for each FSA
        // This gives neighbourhood-level accuracy without Canada Post's proprietary data
        const FSA_COORDS = {
          // Toronto neighbourhoods — each FSA is a distinct neighbourhood
          M1B:{lat:43.8113,lon:-79.1948,name:'Scarborough',prov:'ON'},
          M1C:{lat:43.7849,lon:-79.1630,name:'Rouge Hill',prov:'ON'},
          M1E:{lat:43.7636,lon:-79.1887,name:'Guildwood',prov:'ON'},
          M1G:{lat:43.7706,lon:-79.2169,name:'Woburn',prov:'ON'},
          M1H:{lat:43.7731,lon:-79.2395,name:'Cedarbrae',prov:'ON'},
          M1J:{lat:43.7447,lon:-79.2394,name:'Scarborough Village',prov:'ON'},
          M1K:{lat:43.7280,lon:-79.2646,name:'Kennedy Park',prov:'ON'},
          M1L:{lat:43.7111,lon:-79.2847,name:'Clairlea',prov:'ON'},
          M1M:{lat:43.7163,lon:-79.2390,name:'Cliffside',prov:'ON'},
          M1N:{lat:43.6962,lon:-79.2369,name:'Birch Cliff',prov:'ON'},
          M1P:{lat:43.7574,lon:-79.2695,name:'Dorset Park',prov:'ON'},
          M1R:{lat:43.7500,lon:-79.2979,name:'Wexford',prov:'ON'},
          M1S:{lat:43.7942,lon:-79.2622,name:'Agincourt',prov:'ON'},
          M1T:{lat:43.7808,lon:-79.3043,name:"Tam O'Shanter",prov:'ON'},
          M1V:{lat:43.8153,lon:-79.2841,name:'Milliken',prov:'ON'},
          M1W:{lat:43.7996,lon:-79.3309,name:'Steeles',prov:'ON'},
          M1X:{lat:43.8365,lon:-79.2071,name:'Upper Rouge',prov:'ON'},
          M2H:{lat:43.8037,lon:-79.3634,name:'Hillcrest Village',prov:'ON'},
          M2J:{lat:43.7789,lon:-79.3462,name:'Fairview',prov:'ON'},
          M2K:{lat:43.7867,lon:-79.3857,name:'Bayview Village',prov:'ON'},
          M2L:{lat:43.7574,lon:-79.3749,name:'York Mills',prov:'ON'},
          M2M:{lat:43.7900,lon:-79.4093,name:'Willowdale',prov:'ON'},
          M2N:{lat:43.7711,lon:-79.4079,name:'Willowdale East',prov:'ON'},
          M2P:{lat:43.7527,lon:-79.3919,name:'York Mills West',prov:'ON'},
          M2R:{lat:43.8025,lon:-79.4419,name:'Willowdale West',prov:'ON'},
          M3A:{lat:43.7531,lon:-79.3296,name:"Don Mills",prov:'ON'},
          M3B:{lat:43.7459,lon:-79.3533,name:'Don Mills North',prov:'ON'},
          M3C:{lat:43.7258,lon:-79.3407,name:'Don Mills South',prov:'ON'},
          M3H:{lat:43.7542,lon:-79.4425,name:'Bathurst Manor',prov:'ON'},
          M3J:{lat:43.7648,lon:-79.4876,name:'Northwood Park',prov:'ON'},
          M3K:{lat:43.7370,lon:-79.4650,name:'Downsview',prov:'ON'},
          M3L:{lat:43.7390,lon:-79.5064,name:'Downsview West',prov:'ON'},
          M3M:{lat:43.7281,lon:-79.4951,name:'Humber Summit',prov:'ON'},
          M3N:{lat:43.7615,lon:-79.5226,name:'Glenfield',prov:'ON'},
          M4A:{lat:43.7258,lon:-79.3129,name:'Victoria Village',prov:'ON'},
          M4B:{lat:43.7065,lon:-79.3090,name:'East York',prov:'ON'},
          M4C:{lat:43.6953,lon:-79.3183,name:'East York North',prov:'ON'},
          M4E:{lat:43.6763,lon:-79.2935,name:'The Beaches',prov:'ON'},
          M4G:{lat:43.7093,lon:-79.3634,name:'Leaside',prov:'ON'},
          M4H:{lat:43.7050,lon:-79.3433,name:'Thorncliffe Park',prov:'ON'},
          M4J:{lat:43.6854,lon:-79.3375,name:'East Toronto',prov:'ON'},
          M4K:{lat:43.6796,lon:-79.3522,name:'The Danforth',prov:'ON'},
          M4L:{lat:43.6687,lon:-79.3213,name:'India Bazaar',prov:'ON'},
          M4M:{lat:43.6594,lon:-79.3474,name:'Studio District',prov:'ON'},
          M4N:{lat:43.7280,lon:-79.3874,name:'Lawrence Park',prov:'ON'},
          M4P:{lat:43.7127,lon:-79.3892,name:'Davisville North',prov:'ON'},
          M4R:{lat:43.7223,lon:-79.4043,name:'North Toronto',prov:'ON'},
          M4S:{lat:43.7044,lon:-79.3988,name:'Davisville',prov:'ON'},
          M4T:{lat:43.6896,lon:-79.3832,name:'Moore Park',prov:'ON'},
          M4V:{lat:43.6862,lon:-79.4003,name:'Summerhill',prov:'ON'},
          M4W:{lat:43.6806,lon:-79.3768,name:'Rosedale',prov:'ON'},
          M4X:{lat:43.6672,lon:-79.3736,name:'Cabbagetown',prov:'ON'},
          M4Y:{lat:43.6653,lon:-79.3836,name:'Church-Yonge',prov:'ON'},
          M5A:{lat:43.6543,lon:-79.3607,name:'Regent Park',prov:'ON'},
          M5B:{lat:43.6572,lon:-79.3783,name:'Garden District',prov:'ON'},
          M5C:{lat:43.6517,lon:-79.3752,name:'St. James Town',prov:'ON'},
          M5E:{lat:43.6441,lon:-79.3733,name:'Berczy Park',prov:'ON'},
          M5G:{lat:43.6579,lon:-79.3879,name:'Central Bay Street',prov:'ON'},
          M5H:{lat:43.6489,lon:-79.3825,name:'Richmond',prov:'ON'},
          M5J:{lat:43.6401,lon:-79.3812,name:'Harbourfront East',prov:'ON'},
          M5K:{lat:43.6472,lon:-79.3813,name:'Toronto Islands',prov:'ON'},
          M5L:{lat:43.6481,lon:-79.3793,name:'Commerce Court',prov:'ON'},
          M5M:{lat:43.7327,lon:-79.4228,name:'Bedford Park',prov:'ON'},
          M5N:{lat:43.7175,lon:-79.4193,name:'Roselawn',prov:'ON'},
          M5P:{lat:43.6966,lon:-79.4107,name:'Forest Hill North',prov:'ON'},
          M5R:{lat:43.6727,lon:-79.4109,name:'The Annex',prov:'ON'},
          M5S:{lat:43.6626,lon:-79.4000,name:'University',prov:'ON'},
          M5T:{lat:43.6538,lon:-79.4012,name:'Kensington Market',prov:'ON'},
          M5V:{lat:43.6289,lon:-79.3958,name:'CN Tower/King West',prov:'ON'},
          M5W:{lat:43.6468,lon:-79.3825,name:'Stn A PO Boxes',prov:'ON'},
          M5X:{lat:43.6484,lon:-79.3828,name:'First Canadian Place',prov:'ON'},
          M6A:{lat:43.7185,lon:-79.4726,name:'Lawrence Heights',prov:'ON'},
          M6B:{lat:43.7099,lon:-79.4503,name:'Glencairn',prov:'ON'},
          M6C:{lat:43.6966,lon:-79.4285,name:'Humewood-Cedarvale',prov:'ON'},
          M6E:{lat:43.6869,lon:-79.4530,name:'Caledonia-Fairbank',prov:'ON'},
          M6G:{lat:43.6694,lon:-79.4289,name:'Christie',prov:'ON'},
          M6H:{lat:43.6675,lon:-79.4424,name:'Dovercourt',prov:'ON'},
          M6J:{lat:43.6476,lon:-79.4157,name:'Little Portugal',prov:'ON'},
          M6K:{lat:43.6380,lon:-79.4273,name:'Brockton',prov:'ON'},
          M6L:{lat:43.7134,lon:-79.4938,name:'North Park',prov:'ON'},
          M6M:{lat:43.6911,lon:-79.4916,name:'Del Ray',prov:'ON'},
          M6N:{lat:43.6719,lon:-79.4930,name:'Runnymede',prov:'ON'},
          M6P:{lat:43.6616,lon:-79.4627,name:'High Park North',prov:'ON'},
          M6R:{lat:43.6488,lon:-79.4564,name:'Parkdale',prov:'ON'},
          M6S:{lat:43.6516,lon:-79.4844,name:'Runnymede South',prov:'ON'},
          M7A:{lat:43.6624,lon:-79.3924,name:"Queen's Park",prov:'ON'},
          M7R:{lat:43.6369,lon:-79.6153,name:'Canada Post',prov:'ON'},
          M7Y:{lat:43.6627,lon:-79.3232,name:'Business Reply Mail',prov:'ON'},
          M8V:{lat:43.6049,lon:-79.5017,name:'New Toronto',prov:'ON'},
          M8W:{lat:43.6028,lon:-79.5444,name:'Alderwood',prov:'ON'},
          M8X:{lat:43.6534,lon:-79.5135,name:"The Kingsway",prov:'ON'},
          M8Y:{lat:43.6365,lon:-79.4975,name:'Old Mill North',prov:'ON'},
          M8Z:{lat:43.6247,lon:-79.5207,name:'Mimico NW',prov:'ON'},
          M9A:{lat:43.6643,lon:-79.5325,name:'Islington',prov:'ON'},
          M9B:{lat:43.6506,lon:-79.5574,name:'West Deane Park',prov:'ON'},
          M9C:{lat:43.6435,lon:-79.5933,name:'Eringate',prov:'ON'},
          M9L:{lat:43.7571,lon:-79.5791,name:'Humber Summit',prov:'ON'},
          M9M:{lat:43.7302,lon:-79.5438,name:'Humberlea',prov:'ON'},
          M9N:{lat:43.7063,lon:-79.5170,name:'Weston',prov:'ON'},
          M9P:{lat:43.6947,lon:-79.5299,name:'Westmount',prov:'ON'},
          M9R:{lat:43.6882,lon:-79.5530,name:'Kingsview Village',prov:'ON'},
          M9V:{lat:43.7393,lon:-79.5882,name:'Beaumond Heights',prov:'ON'},
          M9W:{lat:43.7067,lon:-79.5958,name:'Northwest',prov:'ON'},
          // Mississauga
          L4T:{lat:43.7073,lon:-79.6447,name:'Malton',prov:'ON'},
          L4W:{lat:43.6332,lon:-79.6366,name:'Northeast Mississauga',prov:'ON'},
          L4X:{lat:43.6186,lon:-79.6296,name:'Cooksville',prov:'ON'},
          L4Y:{lat:43.5911,lon:-79.6148,name:'Mississauga Valleys',prov:'ON'},
          L4Z:{lat:43.6529,lon:-79.6662,name:'Hurontario',prov:'ON'},
          L5A:{lat:43.5828,lon:-79.5978,name:'Cooksville East',prov:'ON'},
          L5B:{lat:43.5832,lon:-79.6135,name:'Mississauga City Centre',prov:'ON'},
          L5C:{lat:43.5598,lon:-79.6085,name:'Erindale',prov:'ON'},
          L5E:{lat:43.5573,lon:-79.5624,name:'Lakeview',prov:'ON'},
          L5G:{lat:43.5514,lon:-79.5867,name:'Port Credit',prov:'ON'},
          L5H:{lat:43.5427,lon:-79.5686,name:'Clarkson',prov:'ON'},
          L5J:{lat:43.5182,lon:-79.6367,name:'Clarkson West',prov:'ON'},
          L5K:{lat:43.5229,lon:-79.6624,name:'Sheridan',prov:'ON'},
          L5L:{lat:43.5396,lon:-79.6826,name:'Erin Mills',prov:'ON'},
          L5M:{lat:43.5569,lon:-79.7028,name:'Churchill Meadows',prov:'ON'},
          L5N:{lat:43.5856,lon:-79.7408,name:'Lisgar',prov:'ON'},
          L5R:{lat:43.6261,lon:-79.6863,name:'Heartland',prov:'ON'},
          L5V:{lat:43.6097,lon:-79.7196,name:'Meadowvale',prov:'ON'},
          L5W:{lat:43.6460,lon:-79.7261,name:'Meadowvale Business Park',prov:'ON'},
          // Vancouver neighbourhoods
          V5K:{lat:49.2827,lon:-123.0342,name:'Hastings-Sunrise',prov:'BC'},
          V5L:{lat:49.2756,lon:-123.0599,name:'Grandview',prov:'BC'},
          V5M:{lat:49.2611,lon:-123.0462,name:'Renfrew',prov:'BC'},
          V5N:{lat:49.2630,lon:-123.0731,name:'Kensington',prov:'BC'},
          V5P:{lat:49.2279,lon:-123.0806,name:'Fraserview',prov:'BC'},
          V5R:{lat:49.2489,lon:-123.0420,name:'Renfrew Heights',prov:'BC'},
          V5S:{lat:49.2388,lon:-123.0605,name:'Champlain Heights',prov:'BC'},
          V5T:{lat:49.2632,lon:-123.1036,name:'Mount Pleasant',prov:'BC'},
          V5V:{lat:49.2502,lon:-123.0956,name:'Kensington-Cedar',prov:'BC'},
          V5W:{lat:49.2307,lon:-123.0944,name:'Riley Park',prov:'BC'},
          V5X:{lat:49.2238,lon:-123.0696,name:'Sunset',prov:'BC'},
          V5Y:{lat:49.2668,lon:-123.1122,name:'Mount Pleasant West',prov:'BC'},
          V5Z:{lat:49.2539,lon:-123.1198,name:'Fairview',prov:'BC'},
          V6A:{lat:49.2836,lon:-123.0931,name:'Strathcona',prov:'BC'},
          V6B:{lat:49.2798,lon:-123.1097,name:'Downtown East',prov:'BC'},
          V6C:{lat:49.2862,lon:-123.1161,name:'Downtown',prov:'BC'},
          V6E:{lat:49.2803,lon:-123.1285,name:'West End',prov:'BC'},
          V6G:{lat:49.2954,lon:-123.1303,name:'Coal Harbour',prov:'BC'},
          V6H:{lat:49.2671,lon:-123.1406,name:'Kitsilano',prov:'BC'},
          V6J:{lat:49.2629,lon:-123.1604,name:'Kitsilano West',prov:'BC'},
          V6K:{lat:49.2598,lon:-123.1524,name:'Kitsilano South',prov:'BC'},
          V6L:{lat:49.2514,lon:-123.1582,name:'Arbutus',prov:'BC'},
          V6M:{lat:49.2427,lon:-123.1492,name:'Kerrisdale',prov:'BC'},
          V6N:{lat:49.2272,lon:-123.1359,name:'Marpole',prov:'BC'},
          V6P:{lat:49.2304,lon:-123.1538,name:'Oakridge',prov:'BC'},
          V6R:{lat:49.2697,lon:-123.1852,name:'Point Grey',prov:'BC'},
          V6S:{lat:49.2598,lon:-123.1887,name:'Dunbar',prov:'BC'},
          V6T:{lat:49.2603,lon:-123.2452,name:'UBC',prov:'BC'},
          // Calgary
          T2E:{lat:51.0673,lon:-114.0497,name:'Bridgeland',prov:'AB'},
          T2G:{lat:51.0414,lon:-114.0497,name:'Inglewood',prov:'AB'},
          T2H:{lat:50.9941,lon:-114.0849,name:'Haysboro',prov:'AB'},
          T2J:{lat:50.9638,lon:-114.0731,name:'Willow Park',prov:'AB'},
          T2K:{lat:51.0882,lon:-114.0849,name:'Thorncliffe',prov:'AB'},
          T2L:{lat:51.0952,lon:-114.1196,name:'Dalhousie',prov:'AB'},
          T2M:{lat:51.0774,lon:-114.0977,name:'Mount Pleasant',prov:'AB'},
          T2N:{lat:51.0637,lon:-114.1140,name:'Briar Hill',prov:'AB'},
          T2P:{lat:51.0466,lon:-114.0708,name:'Downtown Calgary',prov:'AB'},
          T2R:{lat:51.0405,lon:-114.0827,name:'Mission',prov:'AB'},
          T2S:{lat:51.0301,lon:-114.0826,name:'Erlton',prov:'AB'},
          T2T:{lat:51.0272,lon:-114.1003,name:'Altadore',prov:'AB'},
          T2V:{lat:50.9895,lon:-114.1179,name:'Lakeview',prov:'AB'},
          T2W:{lat:50.9572,lon:-114.1178,name:'Woodlands',prov:'AB'},
          T2X:{lat:50.9242,lon:-114.0872,name:'Sundance',prov:'AB'},
          T2Y:{lat:50.9052,lon:-114.1309,name:'Somerset',prov:'AB'},
          T2Z:{lat:50.9279,lon:-113.9847,name:'McKenzie Towne',prov:'AB'},
          T3A:{lat:51.0775,lon:-114.1828,name:'Bowness',prov:'AB'},
          T3B:{lat:51.0812,lon:-114.1597,name:'Bowness East',prov:'AB'},
          T3C:{lat:51.0483,lon:-114.1508,name:'Shaganappi',prov:'AB'},
          T3E:{lat:51.0252,lon:-114.1451,name:'Glendale',prov:'AB'},
          T3G:{lat:51.1125,lon:-114.1976,name:'Tuscany',prov:'AB'},
          T3H:{lat:51.0268,lon:-114.1756,name:'Aspen Woods',prov:'AB'},
          T3J:{lat:51.1151,lon:-113.9611,name:'Saddle Ridge',prov:'AB'},
          T3K:{lat:51.1321,lon:-114.0558,name:'Coventry Hills',prov:'AB'},
          T3L:{lat:51.1272,lon:-114.1602,name:'Crestmont',prov:'AB'},
          T3M:{lat:50.8815,lon:-114.0635,name:'Mahogany',prov:'AB'},
          T3N:{lat:51.1497,lon:-114.0090,name:'Skyview Ranch',prov:'AB'},
          T3P:{lat:51.1716,lon:-113.9615,name:'Cityscape',prov:'AB'},
          T3R:{lat:51.1663,lon:-114.0618,name:'Evanston',prov:'AB'},
          // Ottawa
          K1A:{lat:45.4215,lon:-75.6972,name:'Parliament Hill',prov:'ON'},
          K1B:{lat:45.4346,lon:-75.5961,name:'Gloucester',prov:'ON'},
          K1C:{lat:45.4549,lon:-75.5634,name:'Orleans West',prov:'ON'},
          K1E:{lat:45.4721,lon:-75.5196,name:'Orleans East',prov:'ON'},
          K1G:{lat:45.4091,lon:-75.6438,name:'Alta Vista',prov:'ON'},
          K1H:{lat:45.3852,lon:-75.6680,name:'Heron Gate',prov:'ON'},
          K1J:{lat:45.4525,lon:-75.6287,name:'Overbrook',prov:'ON'},
          K1K:{lat:45.4387,lon:-75.6464,name:'Vanier',prov:'ON'},
          K1L:{lat:45.4341,lon:-75.6619,name:'Eastview',prov:'ON'},
          K1M:{lat:45.4414,lon:-75.6874,name:'Lindenlea',prov:'ON'},
          K1N:{lat:45.4279,lon:-75.6921,name:'Sandy Hill',prov:'ON'},
          K1P:{lat:45.4215,lon:-75.6972,name:'Centretown',prov:'ON'},
          K1R:{lat:45.4090,lon:-75.7147,name:'West Centretown',prov:'ON'},
          K1S:{lat:45.4122,lon:-75.6734,name:'Glebe',prov:'ON'},
          K1T:{lat:45.3747,lon:-75.6277,name:'Blossom Park',prov:'ON'},
          K1V:{lat:45.3583,lon:-75.6735,name:'Riverside South',prov:'ON'},
          K1Y:{lat:45.3992,lon:-75.7367,name:'Mechanicsville',prov:'ON'},
          K1Z:{lat:45.3963,lon:-75.7466,name:'Westboro',prov:'ON'},
          K2A:{lat:45.3906,lon:-75.7673,name:'Carlington',prov:'ON'},
          K2B:{lat:45.3651,lon:-75.7854,name:'Craig Henry',prov:'ON'},
          K2C:{lat:45.3752,lon:-75.7490,name:'Merivale',prov:'ON'},
          K2E:{lat:45.3439,lon:-75.7327,name:'Barrhaven',prov:'ON'},
          K2G:{lat:45.3468,lon:-75.7747,name:'Centrepointe',prov:'ON'},
          K2H:{lat:45.3305,lon:-75.8218,name:'Bells Corners',prov:'ON'},
          K2J:{lat:45.2822,lon:-75.7526,name:'Stittsville',prov:'ON'},
          K2K:{lat:45.3512,lon:-75.9058,name:'Kanata North',prov:'ON'},
          K2L:{lat:45.3270,lon:-75.9098,name:'Bridlewood',prov:'ON'},
          K2M:{lat:45.3150,lon:-75.8847,name:'Kanata South',prov:'ON'},
          K2P:{lat:45.4143,lon:-75.7016,name:"Centretown West",prov:'ON'},
          K2R:{lat:45.2690,lon:-75.8214,name:'Barrhaven South',prov:'ON'},
          K2S:{lat:45.3133,lon:-75.9551,name:'Stittsville South',prov:'ON'},
          K2T:{lat:45.3672,lon:-75.9139,name:'Morgan Glen',prov:'ON'},
          K2V:{lat:45.2973,lon:-75.8681,name:'Bridlewood South',prov:'ON'},
          K2W:{lat:45.2670,lon:-75.9204,name:'Munster',prov:'ON'},
        };

        const data = FSA_COORDS[fsa];
        if (data) {
          return res.json([{
            lat: data.lat.toString(),
            lon: data.lon.toString(),
            _postalCity: data.name,
            _postalProv: data.prov,
            _postalCode: formatted,
            address: {city: data.name, state: data.prov, country: 'Canada', country_code: 'ca'}
          }]);
        }

        // Fallback: use FSA prefix lookup for cities not in the detailed table
        const FSA_CITY = {
          M:'Toronto,ON',L3:'Markham,ON',L4:'Richmond Hill,ON',L5:'Mississauga,ON',L6:'Brampton,ON',L7:'Burlington,ON',L8:'Hamilton,ON',L9:'Oakville,ON',
          K1:'Ottawa,ON',K2:'Ottawa,ON',K4:'Ottawa,ON',K6:'Kingston,ON',K7:'Kingston,ON',K8:'Belleville,ON',
          N1:'Guelph,ON',N2:'Kitchener,ON',N3:'Cambridge,ON',N4:'Brantford,ON',N6:'London,ON',N7:'Sarnia,ON',N8:'Windsor,ON',N9:'Windsor,ON',
          P1:'Sudbury,ON',P3:'Sudbury,ON',P7:'Thunder Bay,ON',P8:'Thunder Bay,ON',
          V1:'Kelowna,BC',V2:'Abbotsford,BC',V3:'Surrey,BC',V4:'Surrey,BC',V5:'Vancouver,BC',V6:'Vancouver,BC',V7:'North Vancouver,BC',V8:'Victoria,BC',V9:'Victoria,BC',
          T1:'Lethbridge,AB',T2:'Calgary,AB',T3:'Calgary,AB',T4:'Red Deer,AB',T5:'Edmonton,AB',T6:'Edmonton,AB',T7:'Edmonton,AB',T8:'Edmonton,AB',
          S4:'Regina,SK',S6:'Saskatoon,SK',S7:'Saskatoon,SK',
          R2:'Winnipeg,MB',R3:'Winnipeg,MB',R4:'Winnipeg,MB',R6:'Brandon,MB',
          G1:'Quebec City,QC',G2:'Quebec City,QC',H1:'Montreal,QC',H2:'Montreal,QC',H3:'Montreal,QC',H4:'Montreal,QC',H7:'Laval,QC',H8:'Laval,QC',
          J4:'Longueuil,QC',J6:'Gatineau,QC',J7:'Gatineau,QC',J8:'Gatineau,QC',
          A1:"St. John's,NL",B2:'Halifax,NS',B3:'Halifax,NS',B4:'Truro,NS',
          E1:'Moncton,NB',E2:'Fredericton,NB',E3:'Fredericton,NB',E5:'Saint John,NB',
          C1:'Charlottetown,PE',X1:'Yellowknife,NT',Y1:'Whitehorse,YT'
        };
        const lookup = FSA_CITY[fsa]||FSA_CITY[fsa.slice(0,2)]||FSA_CITY[fsa[0]];
        if (lookup) {
          const [cityName, prov] = lookup.split(',');
          const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityName+', '+prov+', Canada')}&countrycodes=ca&format=json&addressdetails=1&limit=2`,{headers:{'User-Agent':'SkyeWeather/1.0 (mkplusservices.com)','Accept-Language':'en'}});
          const d = await r.json();
          if (d&&d.length) return res.json(d.map(r=>({...r,_postalCity:cityName,_postalProv:prov,_postalCode:formatted})));
        }
        return res.json([]);
      }

      if (isUS) {
        const r = await fetch(`https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(raw)}&countrycodes=us&format=json&addressdetails=1&limit=4`,{headers:{'User-Agent':'SkyeWeather/1.0 (mkplusservices.com)','Accept-Language':'en'}});
        return res.json(await r.json()||[]);
      }
      return res.json([]);
    }

    res.status(400).json({error:'Unknown type'});
  } catch(e) {
    res.status(500).json({error:e.message});
  }
}

// Helper: map lat/lon to EC battleboard region code
function getBattleboardCode(la, lo) {
  return (la>43.4&&la<44.2&&lo>-80.0&&lo<-78.8) ? 'on61' :
         (la>44.8&&la<46.2&&lo>-76.5&&lo<-74.5) ? 'on62' :
         (la>42.8&&la<43.5&&lo>-80.5&&lo<-79.6) ? 'on70' :
         (la>43.3&&la<44.0&&lo>-81.5&&lo<-80.0) ? 'on76' :
         (la>46.0&&la<47.5&&lo>-82.0&&lo<-80.0) ? 'on85' :
         (la>48.0&&la<49.0&&lo>-90.0&&lo<-88.0) ? 'on93' :
         (la>41.5&&la<43.0&&lo>-83.5&&lo<-82.0) ? 'on57' :
         (la>49.0&&la<49.5&&lo>-123.5&&lo<-122.0) ? 'bc14' :
         (la>49.8&&la<50.5&&lo>-119.5&&lo<-119.0) ? 'bc25' :
         (la>50.5&&la<51.5&&lo>-121.5&&lo<-120.5) ? 'bc38' :
         (la>53.5&&la<54.5&&lo>-123.5&&lo<-122.0) ? 'bc58' :
         (la>50.8&&la<51.5&&lo>-114.5&&lo<-113.5) ? 'ab45' :
         (la>53.2&&la<53.8&&lo>-114.0&&lo<-113.0) ? 'ab46' :
         (la>49.5&&la<50.5&&lo>-113.5&&lo<-112.5) ? 'ab56' :
         (la>45.3&&la<45.8&&lo>-74.0&&lo<-73.4)   ? 'qc39' :
         (la>46.5&&la<47.0&&lo>-71.5&&lo<-71.0)   ? 'qc29' :
         (la>49.7&&la<50.2&&lo>-97.5&&lo<-96.8)   ? 'mb38' :
         (la>51.9&&la<52.4&&lo>-106.9&&lo<-106.4) ? 'sk69' :
         (la>50.2&&la<50.6&&lo>-104.9&&lo<-104.4) ? 'sk68' :
         (la>44.5&&la<45.0&&lo>-64.0&&lo<-63.4)   ? 'ns19' :
         (la>45.8&&la<46.2&&lo>-66.8&&lo<-66.4)   ? 'nb29' :
         (la>46.0&&la<46.5&&lo>-64.9&&lo<-64.4)   ? 'nb12' :
         (la>45.9&&la<46.4&&lo>-63.5&&lo<-62.9)   ? 'pe65' :
         (la>47.3&&la<47.7&&lo>-52.9&&lo<-52.5)   ? 'nl33' :
         (la>41&&la<57&&lo>-95&&lo<-74)            ? 'on61' :
         (la>48&&la<60&&lo>-139&&lo<-114)           ? 'bc14' :
         (la>49&&la<60&&lo>-120&&lo<-110)           ? 'ab45' :
         (la>45&&la<63&&lo>-79&&lo<-57)             ? 'qc39' :
         (la>49&&la<60&&lo>-102&&lo<-89)            ? 'mb38' :
         (la>49&&la<60&&lo>-110&&lo<-101)           ? 'sk69' :
         (la>43&&la<47&&lo>-66&&lo<-59)             ? 'ns19' :
         (la>44&&la<48&&lo>-69&&lo<-63)             ? 'nb29' :
         (la>46&&la<61&&lo>-68&&lo<-52)             ? 'nl33' :
         (la>45&&la<47&&lo>-64&&lo<-62)             ? 'pe65' :
         (la>60&&lo>-141&&lo<-120)                  ? 'yt26' :
         (la>60&&lo>-120&&lo<-102)                  ? 'nt25' :
         (la>60&&lo>-102&&lo<-63)                   ? 'nu23' : 'on61';
}
