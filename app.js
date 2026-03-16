// ─── WEATHER DATA MAPS ───────────────────────────────────────
const WI={0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',51:'🌦️',53:'🌦️',55:'🌧️',61:'🌧️',63:'🌧️',65:'🌧️',71:'🌨️',73:'🌨️',75:'❄️',80:'🌦️',81:'🌧️',82:'⛈️',95:'⛈️',96:'⛈️',99:'⛈️'};
const WD={0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Foggy',48:'Icy fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',61:'Light rain',63:'Moderate rain',65:'Heavy rain',71:'Light snow',73:'Moderate snow',75:'Heavy snow',80:'Rain showers',81:'Heavy showers',82:'Violent showers',95:'Thunderstorm',96:'Thunderstorm',99:'Thunderstorm'};
const DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DSHORT=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];

// ─── STATE ───────────────────────────────────────────────────
let useCelsius=true, currentData=null, currentCity='', currentLat=43.6532, currentLon=-79.3832, currentCode=0, searchTmr;
let favs = JSON.parse(localStorage.getItem('skye_favs')||'null') || [
  {name:'Toronto',lat:43.6532,lon:-79.3832},
  {name:'New York',lat:40.7128,lon:-74.006},
  {name:'London',lat:51.5074,lon:-0.1278}
];
const saveFavs = () => localStorage.setItem('skye_favs', JSON.stringify(favs));

// Backend API endpoint (Vercel serverless function)
const API = '/api/weather';

// ─── UNITS ───────────────────────────────────────────────────
const toF = c => Math.round(c * 9/5 + 32);
const fmt = c => useCelsius ? Math.round(c)+'°C' : toF(c)+'°F';
const fmtS = c => useCelsius ? Math.round(c)+'°' : toF(c)+'°';
function toggleUnit(){ useCelsius=!useCelsius; if(currentData) render(currentData, currentCity, []); }

// ─── THEME ───────────────────────────────────────────────────
function setTheme(){
  const h = new Date().getHours();
  document.getElementById('app').className = 'app' + (h<6||h>=20 ? ' night' : '');
}

// ─── CANVAS BACKGROUND ───────────────────────────────────────
const canvas = document.getElementById('bgCanvas');
const ctx = canvas.getContext('2d');
let particles=[], bgScene='clear_day', tick=0;

function resizeCanvas(){ canvas.width=window.innerWidth; canvas.height=window.innerHeight; }
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const SKY = {
  clear_day:    ['#1a4a8a','#2a6ab0','#4a90d9'],
  sunset:       ['#0d1b4b','#7a2e6e','#e8703a','#f5b042'],
  clear_night:  ['#020818','#0a1540','#0d2060'],
  cloudy_day:   ['#2a3a4a','#3a5268','#5a7a9a'],
  cloudy_night: ['#080e20','#121e30','#1a2d42'],
  rain:         ['#0f1a2a','#1a2a3a','#243848'],
  storm:        ['#06080f','#0e1420','#151f32'],
  snow:         ['#1a2a3a','#2a3a4a','#8aa0b8'],
  fog:          ['#1a2028','#2a3038','#4a5868']
};

function getScene(code, hour){
  const night = hour<6||hour>=20;
  const dusk  = (hour>=5&&hour<7)||(hour>=18&&hour<21);
  if(code>=95) return 'storm';
  if(code>=71) return 'snow';
  if(code>=51) return 'rain';
  if(code>=45) return 'fog';
  if(code>=3)  return night ? 'cloudy_night' : 'cloudy_day';
  if(night)    return 'clear_night';
  if(dusk)     return 'sunset';
  return 'clear_day';
}

function drawSky(s){
  const stops = SKY[s]||SKY.clear_day;
  const g = ctx.createLinearGradient(0,0,0,canvas.height);
  stops.forEach((c,i) => g.addColorStop(i/(stops.length-1), c));
  ctx.fillStyle=g; ctx.fillRect(0,0,canvas.width,canvas.height);
}

function drawCelestial(s){
  const w=canvas.width, h=canvas.height;
  if(s==='clear_day'||s==='cloudy_day'){
    const x=w*.75, y=h*.16;
    const g=ctx.createRadialGradient(x,y,10,x,y,110);
    g.addColorStop(0,'rgba(255,240,180,.5)'); g.addColorStop(1,'rgba(255,220,80,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,110,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,235,120,.95)'; ctx.beginPath(); ctx.arc(x,y,32,0,Math.PI*2); ctx.fill();
  }
  if(s==='sunset'){
    const sy=h*.65;
    const g=ctx.createRadialGradient(w*.5,sy,5,w*.5,sy,200);
    g.addColorStop(0,'rgba(255,200,80,.65)'); g.addColorStop(.4,'rgba(240,100,40,.3)'); g.addColorStop(1,'rgba(200,40,80,0)');
    ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
    ctx.fillStyle='rgba(255,210,90,.95)'; ctx.beginPath(); ctx.arc(w*.5,sy,28,0,Math.PI*2); ctx.fill();
    const hg=ctx.createLinearGradient(0,sy-80,0,h);
    hg.addColorStop(0,'rgba(212,178,122,.25)'); hg.addColorStop(1,'rgba(180,40,60,0)');
    ctx.fillStyle=hg; ctx.fillRect(0,sy-80,w,h);
  }
  if(s==='clear_night'||s==='cloudy_night'){
    const x=w*.78, y=h*.14;
    ctx.fillStyle='rgba(220,230,255,.9)'; ctx.beginPath(); ctx.arc(x,y,20,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(4,8,22,.88)'; ctx.beginPath(); ctx.arc(x+9,y-4,17,0,Math.PI*2); ctx.fill();
    for(let i=0;i<90;i++){
      const sx=Math.random()*w, sy=Math.random()*h*.55, r=Math.random()*1.5+.2;
      ctx.fillStyle=`rgba(255,255,255,${Math.random()*.8+.1})`; ctx.beginPath(); ctx.arc(sx,sy,r,0,Math.PI*2); ctx.fill();
    }
  }
}

function initParticles(s){
  particles=[]; const w=canvas.width, h=canvas.height;
  if(s==='rain'||s==='storm'){
    for(let i=0;i<240;i++) particles.push({x:Math.random()*w,y:Math.random()*h,vy:13+Math.random()*8,vx:-2-Math.random()*2,len:18+Math.random()*14,alpha:.2+Math.random()*.3});
  }
  if(s==='snow'){
    for(let i=0;i<150;i++) particles.push({x:Math.random()*w,y:Math.random()*h,vy:.8+Math.random()*1.2,vx:Math.sin(Math.random()*Math.PI*2)*.5,r:2+Math.random()*3,alpha:.5+Math.random()*.4,drift:Math.random()*Math.PI*2});
  }
  if(s==='fog'){
    for(let i=0;i<20;i++) particles.push({x:Math.random()*w,y:h*.25+Math.random()*h*.55,vx:.12+Math.random()*.18,pw:350+Math.random()*400,ph:70+Math.random()*90,alpha:.04+Math.random()*.05});
  }
  if(s==='clear_day'||s==='sunset'||s==='cloudy_day'){
    for(let i=0;i<7;i++) particles.push({x:Math.random()*w,y:h*.08+Math.random()*h*.38,vx:.1+Math.random()*.15,pw:200+Math.random()*320,ph:40+Math.random()*55,alpha:.05+Math.random()*.07,type:'cloud'});
  }
}

function animateBg(){
  requestAnimationFrame(animateBg); tick++;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawSky(bgScene); drawCelestial(bgScene);
  const w=canvas.width, h=canvas.height;

  if(bgScene==='rain'||bgScene==='storm'){
    ctx.strokeStyle='rgba(58,141,255,.4)'; ctx.lineWidth=1;
    particles.forEach(p=>{
      ctx.globalAlpha=p.alpha; ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.x+p.vx*2,p.y+p.len); ctx.stroke();
      p.x+=p.vx; p.y+=p.vy; if(p.y>h){p.y=-20;p.x=Math.random()*w;}
    });
    if(bgScene==='storm'&&tick%110===0){ctx.globalAlpha=.07;ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);}
    ctx.globalAlpha=1;
  }
  if(bgScene==='snow'){
    particles.forEach(p=>{
      p.drift+=.012; p.x+=p.vx+Math.sin(p.drift)*.4; p.y+=p.vy;
      if(p.y>h){p.y=-10;p.x=Math.random()*w;}
      ctx.globalAlpha=p.alpha; ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
    }); ctx.globalAlpha=1;
  }
  if(bgScene==='fog'){
    particles.forEach(p=>{
      p.x+=p.vx; if(p.x>w+p.pw) p.x=-p.pw;
      ctx.globalAlpha=p.alpha;
      const fg=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.pw/2);
      fg.addColorStop(0,'rgba(154,163,173,.7)'); fg.addColorStop(1,'rgba(154,163,173,0)');
      ctx.fillStyle=fg; ctx.beginPath(); ctx.ellipse(p.x,p.y,p.pw/2,p.ph/2,0,0,Math.PI*2); ctx.fill();
    }); ctx.globalAlpha=1;
  }
  if(bgScene==='clear_day'||bgScene==='sunset'||bgScene==='cloudy_day'){
    particles.forEach(p=>{
      if(p.type!=='cloud') return;
      p.x+=p.vx; if(p.x>w+p.pw) p.x=-p.pw;
      ctx.globalAlpha=p.alpha*(bgScene==='sunset'?1.5:1);
      const cg=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.pw/2);
      cg.addColorStop(0,'rgba(255,255,255,.88)'); cg.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle=cg; ctx.beginPath(); ctx.ellipse(p.x,p.y,p.pw/2,p.ph/2,0,0,Math.PI*2); ctx.fill();
    }); ctx.globalAlpha=1;
  }
}

function setBg(code, hour){
  const s = getScene(code, hour);
  if(s===bgScene && particles.length) return;
  bgScene=s; initParticles(s);
}

animateBg();

// ─── ALERT MODAL ─────────────────────────────────────────────
function showAlert(type, title, severity) {
  // Remove any existing modal
  const existing = document.getElementById('alertModal');
  if (existing) existing.remove();

  const sevCol = {extreme:'#ff4040',severe:'#ff5540',moderate:'#ff9500',minor:'#ffd000'};
  const col = sevCol[severity] || '#ff8070';

  const modal = document.createElement('div');
  modal.id = 'alertModal';
  modal.style.cssText = `position:fixed;inset:0;z-index:999;display:flex;align-items:center;justify-content:center;padding:1.5rem;background:rgba(0,0,0,0.65);backdrop-filter:blur(6px);`;
  modal.innerHTML = `
    <div style="background:#1a1e24;border:1px solid ${col}44;border-radius:18px;padding:1.75rem;max-width:420px;width:100%;position:relative;box-shadow:0 20px 60px rgba(0,0,0,0.6);">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:1rem;">
        <span style="font-size:22px">⚠️</span>
        <div>
          <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${col};margin-bottom:2px">Weather Alert</div>
          <div style="font-size:16px;font-weight:500;color:#E8EDF2;line-height:1.3">${type}</div>
        </div>
        <button onclick="document.getElementById('alertModal').remove()" style="margin-left:auto;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:50%;width:32px;height:32px;color:#9AA3AD;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0">×</button>
      </div>
      <div style="height:1px;background:${col}33;margin-bottom:1rem;"></div>
      <div style="font-size:13px;color:#9AA3AD;line-height:1.75;max-height:60vh;overflow-y:auto;white-space:pre-wrap">${title}</div>
      <div style="margin-top:1.25rem;display:flex;gap:8px;">
        <div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;padding:5px 12px;border-radius:20px;background:${col}18;color:${col};border:1px solid ${col}33">
          ${severity === 'severe' ? '🔴 Severe' : severity === 'moderate' ? '🟠 Moderate' : '🟡 Minor'}
        </div>
        <div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;padding:5px 12px;border-radius:20px;background:rgba(255,255,255,0.06);color:#6B747D;border:1px solid rgba(255,255,255,0.08)">
          Environment Canada
        </div>
      </div>
    </div>`;

  // Close on backdrop click
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

// ─── FAVOURITES ──────────────────────────────────────────────
function renderFavs(){
  document.getElementById('favsRow').innerHTML =
    favs.map((f,i)=>`<div class="fav-chip${f.name===currentCity?' active':''}" onclick="loadCity('${f.name.replace(/'/g,"\\'")}',${f.lat},${f.lon})">${f.name}<span class="fav-remove" onclick="event.stopPropagation();removeFav(${i})">×</span></div>`).join('')
    + `<button class="add-fav-btn" onclick="addFav()">+ Save</button>`;
}
function addFav(){ if(currentCity&&!favs.find(f=>f.name===currentCity)){favs.push({name:currentCity,lat:currentLat,lon:currentLon});saveFavs();renderFavs();} }
function removeFav(i){ favs.splice(i,1); saveFavs(); renderFavs(); }

// ─── SEARCH ──────────────────────────────────────────────────
const searchInp = document.getElementById('searchInp');
searchInp.addEventListener('input', ()=>{
  clearTimeout(searchTmr);
  const q = searchInp.value.trim();
  if(q.length<2){ document.getElementById('searchResults').classList.add('hidden'); return; }
  searchTmr = setTimeout(()=>doSearch(q), 450);
});
searchInp.addEventListener('blur', ()=>setTimeout(()=>document.getElementById('searchResults').classList.add('hidden'),200));

const isCAPostal = q => /^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/.test(q.trim());
const isUSZip    = q => /^\d{5}$/.test(q.trim());

async function doSearch(q){
  const el = document.getElementById('searchResults');
  try{
    if(isCAPostal(q)||isUSZip(q)){
      const r = await fetch(`${API}?type=postal&postal=${encodeURIComponent(q.trim())}`);
      const d = await r.json();
      if(d&&d.length){
        const seen=new Set();
        const items = d.filter(c=>{
          // For Canadian results, use _postalCity if available
          const n=c._postalCity||(c.address?.city||c.address?.town||c.address?.village||c.address?.county||q);
          return seen.has(n)?false:(seen.add(n),true);
        }).slice(0,4).map(c=>{
          const a=c.address||{};
          // Prefer the FSA-resolved city name for Canadian postal codes
          const n=c._postalCity||a.city||a.town||a.village||a.suburb||a.municipality||a.county||q;
          const prov=c._postalProv||a.state||'';
          const code=c._postalCode||q.toUpperCase();
          const country=a.country_code==='ca'?'Canada':a.country_code==='us'?'USA':(a.country||'Canada');
          return `<div class="search-result-item" onclick="loadCity('${n.replace(/'/g,"\\'")}',${c.lat},${c.lon});searchInp.value='';document.getElementById('searchResults').classList.add('hidden')">${n}${prov?', '+prov:''}, ${country} <span style="opacity:.5;font-size:11px">${code}</span></div>`;
        });
        if(items.length){ el.innerHTML=items.join(''); el.classList.remove('hidden'); return; }
      }
      el.innerHTML=`<div class="search-result-item" style="opacity:.5">No results for ${q.toUpperCase()} — try the city name</div>`;
      el.classList.remove('hidden'); return;
    }
    // City name — Open-Meteo geocoding (has CORS, no backend needed)
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`);
    const d = await r.json();
    if(!d.results||!d.results.length){ el.classList.add('hidden'); return; }
    el.innerHTML = d.results.map(c=>`<div class="search-result-item" onclick="loadCity('${c.name.replace(/'/g,"\\'")}',${c.latitude},${c.longitude});searchInp.value='';document.getElementById('searchResults').classList.add('hidden')">${c.name}${c.admin1?', '+c.admin1:''}, ${c.country}</div>`).join('');
    el.classList.remove('hidden');
  }catch(e){ console.error('Search:', e); }
}

// ─── LOCATION ────────────────────────────────────────────────
async function detectLocation(){
  document.getElementById('mainContent').innerHTML='<div class="full-loading"><div class="loading-icon">📍</div><div>Detecting your location...</div></div>';
  if(!navigator.geolocation){ loadCity('Toronto',43.6532,-79.3832); return; }
  navigator.geolocation.getCurrentPosition(
    async pos=>{
      const {latitude:lat, longitude:lon} = pos.coords;
      try{
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,{headers:{'Accept-Language':'en'}});
        const d = await r.json();
        const name = d.address?.city||d.address?.town||d.address?.village||d.address?.county||'My Location';
        currentCity=name; currentLat=lat; currentLon=lon; renderFavs(); loadWeather(lat,lon,name);
      }catch{ loadWeather(lat,lon,'My Location'); }
    },
    ()=>loadCity('Toronto',43.6532,-79.3832)
  );
}

function loadCity(name, lat, lon){
  currentCity=name; currentLat=parseFloat(lat); currentLon=parseFloat(lon); renderFavs();
  document.getElementById('mainContent').innerHTML=`<div class="full-loading"><div class="loading-icon">🌤️</div><div>Loading ${name}...</div></div>`;
  loadWeather(lat, lon, name);
}

// ─── LOAD WEATHER ────────────────────────────────────────────
async function loadWeather(lat, lon, city){
  try{
    const [forecastRes, ecRes, alertsRes] = await Promise.all([
      fetch(`${API}?type=forecast&lat=${lat}&lon=${lon}`),
      fetch(`${API}?type=ec&city=${encodeURIComponent(city)}&lat=${lat}&lon=${lon}`),
      fetch(`${API}?type=alerts&lat=${lat}&lon=${lon}`)
    ]);

    if(!forecastRes.ok) throw new Error('Forecast failed');
    const forecast = await forecastRes.json();

    let ecTemp=null, ecCond=null, warnings=[];
    if(ecRes.ok){
      const ec = await ecRes.json();
      ecTemp=ec.ecTemp; ecCond=ec.ecCond; warnings=ec.warnings||[];
    }
    if(alertsRes.ok){
      const al = await alertsRes.json();
      if(al.alerts&&al.alerts.length) warnings=[...warnings,...al.alerts];
    }

    // Deduplicate
    const seen=new Set();
    warnings = warnings.filter(w=>{ if(seen.has(w.type)) return false; seen.add(w.type); return true; });

    currentData=forecast; currentCode=forecast.current.weather_code;
    forecast.current._ecTemp = ecTemp;
    forecast.current._ecCond = ecCond;
    setBg(currentCode, new Date().getHours());
    render(forecast, city, warnings);
    loadAI(forecast.current.temperature_2m, WD[currentCode]||'', forecast.current.wind_speed_10m, forecast.current.relative_humidity_2m, city);
  }catch(e){
    console.error('loadWeather:', e);
    document.getElementById('mainContent').innerHTML='<div class="full-loading"><div class="loading-icon">⚠️</div><div>Could not load weather. Try searching for your city.</div></div>';
  }
}

// ─── HELPERS ─────────────────────────────────────────────────
const windDir  = d => ['N','NE','E','SE','S','SW','W','NW'][Math.round(d/45)%8]||'';
const fmtTime  = iso => new Date(iso).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true});

// ─── RENDER ──────────────────────────────────────────────────
function render(d, city, warnings){
  setTheme();
  const c=d.current, now=new Date(), hour=now.getHours(), code=c.weather_code;
  const dateStr=DAYS[now.getDay()]+', '+MONTHS[now.getMonth()]+' '+now.getDate();
  const sunrise=d.daily.sunrise?.[0], sunset=d.daily.sunset?.[0];
  const showTemp = c._ecTemp!=null ? c._ecTemp : c.temperature_2m;
  const showCond = c._ecCond || WD[code] || '';
  const wDir = c.wind_direction_10m!=null ? windDir(c.wind_direction_10m) : '';

  // Warnings band
  const sevCol = {extreme:'#ff4040',severe:'#ff5540',moderate:'#ff9500',minor:'#ffd000'};
  let alertHTML = '';
  if(warnings&&warnings.length){
    alertHTML = warnings.slice(0,3).map(w=>{
      const col = sevCol[w.severity]||'#ff8070';
      const safeType = w.type.replace(/'/g,"\\'");
      const safeTitle = w.title.replace(/'/g,"\\'").replace(/`/g,'\\`');
      return `<div class="alert-band" style="border-color:${col}44;color:${col};cursor:pointer;" onclick="showAlert('${safeType}','${safeTitle}','${w.severity}')">
        <span class="alert-icon">⚠️</span>
        <div style="flex:1">
          <div style="font-weight:500;font-size:13px;margin-bottom:3px">${w.type}</div>
          <div style="font-size:12px;opacity:.85;line-height:1.5">${w.title.slice(0,80)}${w.title.length>80?'...':''}</div>
        </div>
        <div style="font-size:18px;opacity:.5;flex-shrink:0">›</div>
      </div>`;
    }).join('');
  } else if(code>=95){
    alertHTML='<div class="alert-band" style="border-color:#ff554444;color:#ff8070"><span class="alert-icon">⚠️</span> Thunderstorm warning in effect.</div>';
  }

  // Sun times
  const sunHTML = (sunrise&&sunset) ? `
    <div class="sun-row">
      <div class="sun-card"><div class="sun-icon">🌅</div><div><div class="sun-label">Sunrise</div><div class="sun-val">${fmtTime(sunrise)}</div></div></div>
      <div class="sun-card"><div class="sun-icon">🌇</div><div><div class="sun-label">Sunset</div><div class="sun-val">${fmtTime(sunset)}</div></div></div>
    </div>` : '';

  // Hourly
  const times=d.hourly.time, htemps=d.hourly.temperature_2m, hrain=d.hourly.precipitation_probability, hcode=d.hourly.weather_code;
  let hourlyHTML='', precipHTML='', count=0;
  for(let i=0;i<times.length&&count<12;i++){
    const [dateKey,timeKey]=times[i].split('T'), hr=parseInt(timeKey);
    const todayKey=now.toLocaleDateString('en-CA'), tomorrowKey=new Date(now.getTime()+86400000).toLocaleDateString('en-CA');
    if(dateKey!==todayKey&&dateKey!==tomorrowKey) continue;
    if(dateKey===todayKey&&hr<hour) continue;
    const lbl=count===0?'Now':hr===0?'12am':hr<12?hr+'am':hr===12?'12pm':(hr-12)+'pm';
    hourlyHTML+=`<div class="h-card"><div class="h-time">${lbl}</div><div class="h-icon">${WI[hcode[i]]||'🌡️'}</div><div class="h-temp">${fmtS(htemps[i])}</div><div class="h-rain">${hrain[i]}%</div></div>`;
    precipHTML+=`<div class="precip-col"><div class="p-pct">${hrain[i]}%</div><div class="p-bar-wrap"><div class="p-bar" style="height:${Math.max(4,Math.round(hrain[i]*.68))}px"></div></div><div class="p-time">${lbl}</div></div>`;
    count++;
  }

  // 7-day
  const dd=d.daily; let weekHTML='';
  for(let i=0;i<7;i++){
    const [y,mo,dy]=dd.time[i].split('-').map(Number);
    const dow=new Date(y,mo-1,dy).getDay();
    const dn=i===0?'Today':i===1?'Tomorrow':DSHORT[dow];
    const wc=dd.weather_code[i], rain=dd.precipitation_probability_max[i]||0;
    weekHTML+=`<div class="day-row"><div class="d-name">${dn}</div><div class="d-icon">${WI[wc]||'🌡️'}</div><div class="d-desc">${WD[wc]||''}</div><div class="d-rain-bar"><div class="d-rain-fill" style="width:${rain}%"></div></div><div class="d-rain-pct">${rain}%</div><div class="d-temps"><span class="d-hi">${fmtS(dd.temperature_2m_max[i])}</span><span class="d-lo">${fmtS(dd.temperature_2m_min[i])}</span></div></div>`;
  }

  document.getElementById('mainContent').innerHTML = `
    <div class="hero">
      <div class="hero-city">${city}</div>
      <div class="hero-date">${dateStr}</div>
      <div class="hero-main">
        <div>
          <div class="hero-temp-wrap">
            <div class="hero-temp">${useCelsius?Math.round(showTemp):toF(showTemp)}</div>
            <div class="hero-unit">${useCelsius?'°C':'°F'}</div>
          </div>
          <div class="hero-feels">Feels like ${fmt(c.apparent_temperature)}</div>
        </div>
        <div class="hero-right">
          <span class="hero-icon">${WI[code]||'🌡️'}</span>
          <div class="hero-desc">${showCond}</div>
        </div>
      </div>
      <div class="hero-stats">
        <div class="hs"><div class="hs-l">Wind</div><div class="hs-v">${wDir} ${Math.round(c.wind_speed_10m)}<span style="font-size:10px"> km/h</span></div></div>
        <div class="hs"><div class="hs-l">Humidity</div><div class="hs-v">${Math.round(c.relative_humidity_2m)}%</div></div>
        <div class="hs"><div class="hs-l">UV Index</div><div class="hs-v">${Math.round(c.uv_index)}</div></div>
        <div class="hs"><div class="hs-l">Rain</div><div class="hs-v">${c.precipitation||0} mm</div></div>
      </div>
    </div>
    ${alertHTML}
    ${sunHTML}
    <div class="sec"><div class="sec-label">Hourly</div><div class="hourly-row">${hourlyHTML}</div></div>
    <div class="sec"><div class="sec-label">Precipitation chance</div><div class="precip-wrap"><div class="precip-bars">${precipHTML}</div></div></div>
    <div class="sec"><div class="sec-label">7-day forecast</div><div class="week-list">${weekHTML}</div></div>
    <div class="sec">
      <div class="sec-label">Today's guide</div>
      <div class="ai-card">
        <div class="ai-sub">
          <div class="ai-sub-title">What to wear</div>
          <div class="loading-line" id="outfitTxt">Getting suggestions</div>
          <div class="chips" id="outfitChips"></div>
        </div>
        <div class="ai-divider"></div>
        <div class="ai-sub">
          <div class="ai-sub-title">Things to do in ${city}</div>
          <div class="act-list" id="actList"><div class="loading-line">Finding activities</div></div>
        </div>
      </div>
    </div>
    <div class="footer">
      <div class="footer-brand">Skye Weather</div>
      <div class="footer-data">Powered by Environment Canada · Open-Meteo GEM</div>
      <div class="footer-credit">Created by <span>MK+ Services</span></div>
    </div>`;
}

// ─── AI GUIDE ────────────────────────────────────────────────
async function loadAI(temp, desc, wind, humidity, city){
  const prompt=`Weather in ${city}: ${Math.round(temp)}°C, ${desc}, wind ${Math.round(wind)} km/h, humidity ${Math.round(humidity)}%. Return ONLY valid JSON, no markdown: {"outfit_summary":"2 practical sentences on what to wear","outfit_items":["item1","item2","item3","item4"],"activities":["activity 1","activity 2","activity 3","activity 4"]}`;
  try{
    const res=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:600,messages:[{role:'user',content:prompt}]})});
    const data=await res.json();
    const f=JSON.parse((data.content?.[0]?.text||'{}').replace(/```json|```/g,'').trim());
    const ot=document.getElementById('outfitTxt'), oc=document.getElementById('outfitChips'), al=document.getElementById('actList');
    if(ot){ ot.className='ai-body'; ot.textContent=f.outfit_summary||''; }
    if(oc) oc.innerHTML=(f.outfit_items||[]).map(i=>`<div class="chip">${i}</div>`).join('');
    if(al) al.innerHTML=(f.activities||[]).map(a=>`<div class="act-item"><div class="act-dot"></div>${a}</div>`).join('');
  }catch(e){
    const ot=document.getElementById('outfitTxt');
    if(ot){ ot.className='ai-body'; ot.textContent='AI suggestions unavailable.'; }
  }
}

// ─── INIT ────────────────────────────────────────────────────
renderFavs();
detectLocation();
