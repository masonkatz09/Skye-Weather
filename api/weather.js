export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  const { type, lat, lon, city, postal } = req.query;
  try {

    if (type === 'forecast') {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,relative_humidity_2m,uv_index,precipitation&hourly=temperature_2m,precipitation_probability,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset&wind_speed_unit=kmh&temperature_unit=celsius&timezone=auto&forecast_days=7&models=gem_seamless`;
      return res.json(await (await fetch(url)).json());
    }

    if (type === 'ec') {
      const EC = {'toronto':'ON/s0000458','montreal':'QC/s0000635','vancouver':'BC/s0000141','calgary':'AB/s0000047','edmonton':'AB/s0000045','ottawa':'ON/s0000430','winnipeg':'MB/s0000193','hamilton':'ON/s0000568','london':'ON/s0000326','halifax':'NS/s0000318','victoria':'BC/s0000775','saskatoon':'SK/s0000797','regina':'SK/s0000788','fredericton':'NB/s0000250','charlottetown':'PE/s0000583','whitehorse':'YT/s0000825','yellowknife':'NT/s0000366','iqaluit':'NU/s0000394','mississauga':'ON/s0000582','brampton':'ON/s0000597','surrey':'BC/s0000813','barrie':'ON/s0000568','kitchener':'ON/s0000574','markham':'ON/s0000669','oakville':'ON/s0000490','windsor':'ON/s0000500','sudbury':'ON/s0000397','thunder bay':'ON/s0000411','kingston':'ON/s0000574','guelph':'ON/s0000568',"st. john's":'NL/s0000280','saint john':'NB/s0000269','moncton':'NB/s0000661','lethbridge':'AB/s0000742','red deer':'AB/s0000045','kelowna':'BC/s0000592','nanaimo':'BC/s0000394','kamloops':'BC/s0000568','prince george':'BC/s0000584','burnaby':'BC/s0000141','richmond':'BC/s0000141','abbotsford':'BC/s0000034','richmond hill':'ON/s0000651','vaughan':'ON/s0000782','oshawa':'ON/s0000574','waterloo':'ON/s0000574','brantford':'ON/s0000568','niagara falls':'ON/s0000326'};
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
        const descM = m[2].match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);
        if (descM) {
          const desc = descM[1].replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
          if (desc&&desc.length>5&&!desc.toLowerCase().includes('no watches')&&!desc.toLowerCase().includes('no warning')&&!desc.toLowerCase().includes('no special')) {
            warnings.push({type:typeM?typeM[1]:'Weather Alert',title:desc.slice(0,250),severity:prioM&&prioM[1]==='high'?'severe':prioM&&prioM[1]==='medium'?'moderate':'minor'});
          }
        }
      }
      const tempM = xml.match(/<temperature[^>]*unitType="metric"[^>]*>([\d.-]+)<\/temperature>/);
      const condM = xml.match(/<condition>(.*?)<\/condition>/);
      return res.json({warnings,ecTemp:tempM?parseFloat(tempM[1]):null,ecCond:condM?condM[1].trim():null});
    }

    if (type === 'alerts') {
      const la=parseFloat(lat),lo=parseFloat(lon);
      const isCA=la>41&&la<84&&lo>-141&&lo<-52;
      const isUS=la>24&&la<50&&lo>-125&&lo<-66;
      const alerts=[];

      if (isCA) {
        // Map lat/lon to exact EC battleboard region code
        const bb =
          (la>43.4&&la<44.2&&lo>-80.0&&lo<-78.8) ? 'on61' : // Toronto/GTA
          (la>44.8&&la<46.2&&lo>-76.5&&lo<-74.5) ? 'on62' : // Ottawa
          (la>42.8&&la<43.5&&lo>-80.5&&lo<-79.6) ? 'on70' : // Hamilton/Niagara
          (la>43.3&&la<44.0&&lo>-81.5&&lo<-80.0) ? 'on76' : // Kitchener
          (la>46.0&&la<47.5&&lo>-82.0&&lo<-80.0) ? 'on85' : // Sudbury
          (la>48.0&&la<49.0&&lo>-90.0&&lo<-88.0) ? 'on93' : // Thunder Bay
          (la>41.5&&la<43.0&&lo>-83.5&&lo<-82.0) ? 'on57' : // Windsor
          (la>44.0&&la<44.8&&lo>-76.8&&lo<-76.0) ? 'on70' : // Kingston area
          (la>49.0&&la<49.5&&lo>-123.5&&lo<-122.0) ? 'bc14' : // Vancouver
          (la>49.8&&la<50.5&&lo>-119.5&&lo<-119.0) ? 'bc25' : // Kelowna
          (la>50.5&&la<51.5&&lo>-121.5&&lo<-120.5) ? 'bc38' : // Kamloops
          (la>53.5&&la<54.5&&lo>-123.5&&lo<-122.0) ? 'bc58' : // Prince George
          (la>50.8&&la<51.5&&lo>-114.5&&lo<-113.5) ? 'ab45' : // Calgary
          (la>53.2&&la<53.8&&lo>-114.0&&lo<-113.0) ? 'ab46' : // Edmonton
          (la>49.5&&la<50.5&&lo>-113.5&&lo<-112.5) ? 'ab56' : // Lethbridge
          (la>45.3&&la<45.8&&lo>-74.0&&lo<-73.4)   ? 'qc39' : // Montreal
          (la>46.5&&la<47.0&&lo>-71.5&&lo<-71.0)   ? 'qc29' : // Quebec City
          (la>49.7&&la<50.2&&lo>-97.5&&lo<-96.8)   ? 'mb38' : // Winnipeg
          (la>51.9&&la<52.4&&lo>-106.9&&lo<-106.4) ? 'sk69' : // Saskatoon
          (la>50.2&&la<50.6&&lo>-104.9&&lo<-104.4) ? 'sk68' : // Regina
          (la>44.5&&la<45.0&&lo>-64.0&&lo<-63.4)   ? 'ns19' : // Halifax
          (la>45.8&&la<46.2&&lo>-66.8&&lo<-66.4)   ? 'nb29' : // Fredericton
          (la>46.0&&la<46.5&&lo>-64.9&&lo<-64.4)   ? 'nb12' : // Moncton
          (la>45.9&&la<46.4&&lo>-63.5&&lo<-62.9)   ? 'pe65' : // Charlottetown
          (la>47.3&&la<47.7&&lo>-52.9&&lo<-52.5)   ? 'nl33' : // St. John's
          // Province fallbacks
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

        try {
          const r = await fetch(`https://weather.gc.ca/rss/battleboard/${bb}_e.xml`,{headers:{'User-Agent':'SkyeWeather/1.0 (mkplusservices.com)'}});
          if (r.ok) {
            const xml = await r.text();
            for (const e of [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)]) {
              const tM = e[1].match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
              const sM = e[1].match(/<summary[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/summary>/i);
              const title = tM ? tM[1].replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').trim() : '';
              const summary = sM ? sM[1].replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').trim() : '';
              if (!title) continue;
              const tl = title.toLowerCase();
              if (tl.includes('no watches')||tl.includes('no warning')||tl.includes('aucun')||tl.includes('no special')||tl.includes('en vigueur')) continue;
              if (!tl.includes('warning')&&!tl.includes('watch')&&!tl.includes('advisory')&&!tl.includes('statement')&&!tl.includes('alert')) continue;
              const sev = tl.includes('warning')?'severe':tl.includes('watch')?'moderate':'minor';
              alerts.push({
                type: title.replace(/^(YELLOW|RED|ORANGE|GREEN)\s+(WARNING|WATCH|ADVISORY)\s*-?\s*/i,'').split(' issued')[0].split(' –')[0].trim(),
                title: (summary||title).slice(0,250),
                severity: sev
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
            (d.features||[]).slice(0,4).forEach(f=>alerts.push({type:f.properties?.event||'Weather Alert',title:(f.properties?.headline||f.properties?.description||'').slice(0,250),severity:(f.properties?.severity||'minor').toLowerCase()}));
          }
        } catch(e) {}
      }

      return res.json({alerts});
    }

    if (type === 'postal') {
      const raw = (postal||'').trim().toUpperCase().replace(/\s/g,'');
      const isCA = /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(raw);
      const isUS = /^\d{5}$/.test(raw);

      if (isCA) {
        // FSA (first 3 chars) → city, province — bypasses proprietary Canada Post data
        const FSA = {
          M1:'Toronto,ON',M2:'Toronto,ON',M3:'Toronto,ON',M4:'Toronto,ON',M5:'Toronto,ON',M6:'Toronto,ON',M7:'Toronto,ON',M8:'Toronto,ON',M9:'Toronto,ON',
          L3:'Markham,ON',L4:'Richmond Hill,ON',L5:'Mississauga,ON',L6:'Brampton,ON',L7:'Burlington,ON',L8:'Hamilton,ON',L9:'Oakville,ON',
          K1:'Ottawa,ON',K2:'Ottawa,ON',K4:'Ottawa,ON',K6:'Kingston,ON',K7:'Kingston,ON',K8:'Belleville,ON',
          N1:'Guelph,ON',N2:'Kitchener,ON',N3:'Cambridge,ON',N4:'Brantford,ON',N6:'London,ON',N7:'Sarnia,ON',N8:'Windsor,ON',N9:'Windsor,ON',
          P1:'Sudbury,ON',P3:'Sudbury,ON',P4:'Sault Ste. Marie,ON',P5:'Timmins,ON',P7:'Thunder Bay,ON',P8:'Thunder Bay,ON',
          V1:'Kelowna,BC',V2:'Abbotsford,BC',V3:'Surrey,BC',V4:'Surrey,BC',V5:'Vancouver,BC',V6:'Vancouver,BC',V7:'North Vancouver,BC',V8:'Victoria,BC',V9:'Victoria,BC',
          T1:'Lethbridge,AB',T2:'Calgary,AB',T3:'Calgary,AB',T4:'Red Deer,AB',T5:'Edmonton,AB',T6:'Edmonton,AB',T7:'Edmonton,AB',T8:'Edmonton,AB',T9:'Fort McMurray,AB',
          S2:'Moose Jaw,SK',S4:'Regina,SK',S6:'Saskatoon,SK',S7:'Saskatoon,SK',S9:'Prince Albert,SK',
          R2:'Winnipeg,MB',R3:'Winnipeg,MB',R4:'Winnipeg,MB',R6:'Brandon,MB',R7:'Brandon,MB',
          G1:'Quebec City,QC',G2:'Quebec City,QC',G3:'Quebec City,QC',G4:'Sherbrooke,QC',
          H1:'Montreal,QC',H2:'Montreal,QC',H3:'Montreal,QC',H4:'Montreal,QC',H7:'Laval,QC',H8:'Laval,QC',H9:'Laval,QC',
          J4:'Longueuil,QC',J5:'Longueuil,QC',J6:'Gatineau,QC',J7:'Gatineau,QC',J8:'Gatineau,QC',
          A1:"St. John's,NL",A2:"St. John's,NL",
          B1:'Sydney,NS',B2:'Halifax,NS',B3:'Halifax,NS',B4:'Truro,NS',
          E1:'Moncton,NB',E2:'Fredericton,NB',E3:'Fredericton,NB',E4:'Fredericton,NB',E5:'Saint John,NB',
          C1:'Charlottetown,PE',
          X1:'Yellowknife,NT',Y1:'Whitehorse,YT'
        };

        const fsa = raw.slice(0,3);
        const lookup = FSA[fsa] || FSA[raw.slice(0,2)];

        if (lookup) {
          const [cityName, prov] = lookup.split(',');
          const r = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityName+', '+prov+', Canada')}&countrycodes=ca&format=json&addressdetails=1&limit=2`,
            {headers:{'User-Agent':'SkyeWeather/1.0 (mkplusservices.com)','Accept-Language':'en'}}
          );
          const d = await r.json();
          if (d&&d.length) {
            return res.json(d.map(r=>({...r, _postalCity:cityName, _postalProv:prov, _postalCode:raw.slice(0,3)+' '+raw.slice(3)})));
          }
        }
        return res.json([]);
      }

      if (isUS) {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(raw)}&countrycodes=us&format=json&addressdetails=1&limit=4`,
          {headers:{'User-Agent':'SkyeWeather/1.0 (mkplusservices.com)','Accept-Language':'en'}}
        );
        return res.json(await r.json()||[]);
      }

      return res.json([]);
    }

    res.status(400).json({error:'Unknown type'});
  } catch(e) {
    res.status(500).json({error:e.message});
  }
}
