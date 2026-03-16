// ─── WEATHER MAPS ─────────────────────────────────────────────
const WI={0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',51:'🌦️',53:'🌦️',55:'🌧️',61:'🌧️',63:'🌧️',65:'🌧️',71:'🌨️',73:'🌨️',75:'❄️',80:'🌦️',81:'🌧️',82:'⛈️',95:'⛈️',96:'⛈️',99:'⛈️'};
const WD={0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Foggy',48:'Icy fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',61:'Light rain',63:'Moderate rain',65:'Heavy rain',71:'Light snow',73:'Moderate snow',75:'Heavy snow',80:'Rain showers',81:'Heavy showers',82:'Violent showers',95:'Thunderstorm',96:'Thunderstorm',99:'Thunderstorm'};
const DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DSHORT=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];

// EC city codes for accurate Canadian data
const EC_CITIES={'toronto':'ON/s0000458','montreal':'QC/s0000635','vancouver':'BC/s0000141','calgary':'AB/s0000047','edmonton':'AB/s0000045','ottawa':'ON/s0000430','winnipeg':'MB/s0000193','hamilton':'ON/s0000568','london':'ON/s0000326','halifax':'NS/s0000318','victoria':'BC/s0000775','saskatoon':'SK/s0000797','regina':'SK/s0000788','fredericton':'NB/s0000250','charlottetown':'PE/s0000583','whitehorse':'YT/s0000825','yellowknife':'NT/s0000366','mississauga':'ON/s0000582','brampton':'ON/s0000597','barrie':'ON/s0000568','markham':'ON/s0000669','oakville':'ON/s0000490','kitchener':'ON/s0000574'};

// ─── STATE ────────────────────────────────────────────────────
let useCelsius=true, currentData=null, currentCity='', currentLat=43.6532, currentLon=-79.3832, currentCode=0, searchTimeout;
let favourites=JSON.parse(localStorage.getItem('skye_favs')||'null')||[{name:'Toronto',lat:43.6532,lon:-79.3832},{name:'New York',lat:40.7128,lon:-74.006},{name:'London',lat:51.5074,lon:-0.1278}];
function saveFavs(){localStorage.setItem('skye_favs',JSON.stringify(favourites));}

// ─── UNITS ────────────────────────────────────────────────────
function toF(c){return Math.round(c*9/5+32);}
function fmt(c){return useCelsius?Math.round(c)+'°C':toF(c)+'°F';}
function fmtShort(c){return useCelsius?Math.round(c)+'°':toF(c)+'°';}
function toggleUnit(){useCelsius=!useCelsius;if(currentData)render(currentData,currentCity,[]);}

// ─── THEME ────────────────────────────────────────────────────
function setTheme(){
  const h=new Date().getHours();
  document.getElementById('app').className='app'+(h<6||h>=20?' night':'');
}

// ─── CANVAS BACKGROUND ────────────────────────────────────────
const canvas=document.getElementById('bgCanvas');
const ctx=canvas.getContext('2d');
let particles=[], bgScene='clear_day', tick=0;

function resizeCanvas(){canvas.width=window.innerWidth;canvas.height=window.innerHeight;}
window.addEventListener('resize',resizeCanvas);
resizeCanvas();

const SKY={
  clear_day:['#4a90d9','#87c1f0','#b8dcf7'],
  sunset:['#0d1b4b','#7a2e6e','#e8703a','#f5b042'],
  clear_night:['#020818','#0a1540','#0d2060'],
  cloudy_day:['#5a7a9a','#8aa8c0','#b0c8d8'],
  cloudy_night:['#080e20','#141e35','#1e2d45'],
  rain:['#1a2a3a','#2a3e52','#3a5268'],
  storm:['#0a0f1e','#151f32','#1e2e45'],
  snow:['#c0d0e0','#d8e5ef','#eaf1f7'],
  fog:['#8a9aaa','#aabbc8','#c8d5de']
};

function getScene(code,hour){
  const night=hour<6||hour>=20;
  const dusk=(hour>=5&&hour<7)||(hour>=18&&hour<21);
  if(code>=95)return 'storm';
  if(code>=71)return 'snow';
  if(code>=51)return 'rain';
  if(code>=45)return 'fog';
  if(code>=3)return night?'cloudy_night':'cloudy_day';
  if(night)return 'clear_night';
  if(dusk)return 'sunset';
  return 'clear_day';
}

function drawSky(scene){
  const stops=SKY[scene]||SKY.clear_day;
  const g=ctx.createLinearGradient(0,0,0,canvas.height);
  stops.forEach((c,i)=>g.addColorStop(i/(stops.length-1),c));
  ctx.fillStyle=g;ctx.fillRect(0,0,canvas.width,canvas.height);
}

function drawCelestial(scene){
  const w=canvas.width,h=canvas.height;
  if(scene==='clear_day'||scene==='cloudy_day'){
    const x=w*0.75,y=h*0.18;
    const g=ctx.createRadialGradient(x,y,10,x,y,100);
    g.addColorStop(0,'rgba(255,240,180,0.45)');g.addColorStop(1,'rgba(255,220,80,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,100,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(255,235,120,0.92)';ctx.beginPath();ctx.arc(x,y,32,0,Math.PI*2);ctx.fill();
  }
  if(scene==='sunset'){
    const sy=h*0.62;
    const g=ctx.createRadialGradient(w*0.5,sy,5,w*0.5,sy,180);
    g.addColorStop(0,'rgba(255,200,80,0.6)');g.addColorStop(0.4,'rgba(240,100,40,0.3)');g.addColorStop(1,'rgba(200,40,80,0)');
    ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    ctx.fillStyle='rgba(255,210,90,0.95)';ctx.beginPath();ctx.arc(w*0.5,sy,28,0,Math.PI*2);ctx.fill();
    const hg=ctx.createLinearGradient(0,sy-60,0,h);
    hg.addColorStop(0,'rgba(240,120,40,0.35)');hg.addColorStop(1,'rgba(180,40,60,0)');
    ctx.fillStyle=hg;ctx.fillRect(0,sy-60,w,h);
  }
  if(scene==='clear_night'||scene==='cloudy_night'){
    const x=w*0.78,y=h*0.15;
    ctx.fillStyle='rgba(220,230,255,0.9)';ctx.beginPath();ctx.arc(x,y,20,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(8,14,32,0.85)';ctx.beginPath();ctx.arc(x+9,y-4,17,0,Math.PI*2);ctx.fill();
    for(let i=0;i<80;i++){
      const sx=Math.random()*w,sy=Math.random()*h*0.55,r=Math.random()*1.4+0.3;
      ctx.fillStyle=`rgba(255,255,255,${Math.random()*0.7+0.2})`;
      ctx.beginPath();ctx.arc(sx,sy,r,0,Math.PI*2);ctx.fill();
    }
  }
}

function initParticles(scene){
  particles=[];
  const w=canvas.width,h=canvas.height;
  if(scene==='rain'||scene==='storm'){
    for(let i=0;i<220;i++) particles.push({x:Math.random()*w,y:Math.random()*h,vy:12+Math.random()*8,vx:-2-Math.random()*2,len:18+Math.random()*14,alpha:0.25+Math.random()*0.3});
  }
  if(scene==='snow'){
    for(let i=0;i<140;i++) particles.push({x:Math.random()*w,y:Math.random()*h,vy:0.8+Math.random()*1.2,vx:Math.sin(Math.random()*Math.PI*2)*0.5,r:2+Math.random()*3,alpha:0.5+Math.random()*0.4,drift:Math.random()*Math.PI*2});
  }
  if(scene==='fog'){
    for(let i=0;i<18;i++) particles.push({x:Math.random()*w,y:h*0.3+Math.random()*h*0.5,vx:0.15+Math.random()*0.2,vy:0,pw:300+Math.random()*400,ph:60+Math.random()*80,alpha:0.04+Math.random()*0.06});
  }
  if(scene==='clear_day'||scene==='sunset'||scene==='cloudy_day'){
    for(let i=0;i<6;i++) particles.push({x:Math.random()*w,y:h*0.1+Math.random()*h*0.35,vx:0.1+Math.random()*0.15,vy:0,pw:200+Math.random()*300,ph:40+Math.random()*50,alpha:0.06+Math.random()*0.07,type:'cloud'});
  }
}

function animateBg(){
  requestAnimationFrame(animateBg);
  tick++;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawSky(bgScene);
  drawCelestial(bgScene);
  const w=canvas.width,h=canvas.height;

  if(bgScene==='rain'||bgScene==='storm'){
    ctx.strokeStyle='rgba(180,210,255,0.5)';ctx.lineWidth=1;
    particles.forEach(p=>{
      ctx.globalAlpha=p.alpha;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+p.vx*2,p.y+p.len);ctx.stroke();
      p.x+=p.vx;p.y+=p.vy;if(p.y>h){p.y=-20;p.x=Math.random()*w;}
    });
    if(bgScene==='storm'&&tick%120===0){ctx.globalAlpha=0.08;ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);}
    ctx.globalAlpha=1;
  }
  if(bgScene==='snow'){
    particles.forEach(p=>{
      p.drift+=0.012;p.x+=p.vx+Math.sin(p.drift)*0.4;p.y+=p.vy;
      if(p.y>h){p.y=-10;p.x=Math.random()*w;}
      ctx.globalAlpha=p.alpha;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();
    });ctx.globalAlpha=1;
  }
  if(bgScene==='fog'){
    particles.forEach(p=>{
      p.x+=p.vx;if(p.x>w+p.pw)p.x=-p.pw;
      ctx.globalAlpha=p.alpha;
      const fg=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.pw/2);
      fg.addColorStop(0,'rgba(200,215,225,0.9)');fg.addColorStop(1,'rgba(200,215,225,0)');
      ctx.fillStyle=fg;ctx.beginPath();ctx.ellipse(p.x,p.y,p.pw/2,p.ph/2,0,0,Math.PI*2);ctx.fill();
    });ctx.globalAlpha=1;
  }
  if(bgScene==='clear_day'||bgScene==='sunset'||bgScene==='cloudy_day'){
    particles.forEach(p=>{
      if(p.type!=='cloud')return;
      p.x+=p.vx;if(p.x>w+p.pw)p.x=-p.pw;
      ctx.globalAlpha=p.alpha*(bgScene==='sunset'?1.4:1);
      const cg=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.pw/2);
      cg.addColorStop(0,'rgba(255,255,255,0.9)');cg.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle=cg;ctx.beginPath();ctx.ellipse(p.x,p.y,p.pw/2,p.ph/2,0,0,Math.PI*2);ctx.fill();
    });ctx.globalAlpha=1;
  }
}

function setBackground(code,hour){
  const scene=getScene(code,hour);
  if(scene===bgScene&&particles.length)return;
  bgScene=scene;initParticles(scene);
}

animateBg();

// ─── FAVOURITES ───────────────────────────────────────────────
function renderFavs(){
  const row=document.getElementById('favsRow');
  row.innerHTML=favourites.map((f,i)=>`<div class="fav-chip${f.name===currentCity?' active':''}" onclick="loadCity('${f.name.replace(/'/g,"\\'")}',${f.lat},${f.lon})">${f.name}<span class="fav-remove" onclick="event.stopPropagation();removeFav(${i})">×</span></div>`).join('')+`<button class="add-fav-btn" onclick="addFav()">+ Save</button>`;
}
function addFav(){if(currentCity&&!favourites.find(f=>f.name===currentCity)){favourites.push({name:currentCity,lat:currentLat,lon:currentLon});saveFavs();renderFavs();}}
function removeFav(i){favourites.splice(i,1);saveFavs();renderFavs();}

// ─── SEARCH ───────────────────────────────────────────────────
const searchInp=document.getElementById('searchInp');
let searchTmr;
searchInp.addEventListener('input',()=>{
  clearTimeout(searchTmr);
  const q=searchInp.value.trim();
  if(q.length<2){document.getElementById('searchResults').classList.add('hidden');return;}
  searchTmr=setTimeout(()=>doSearch(q),450);
});
searchInp.addEventListener('blur',()=>setTimeout(()=>document.getElementById('searchResults').classList.add('hidden'),200));

function isCAPostal(q){return /^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/.test(q.trim());}
function isUSZip(q){return /^\d{5}$/.test(q.trim());}

async function doSearch(q){
  const el=document.getElementById('searchResults');
  try{
    if(isCAPostal(q)){
      const clean=q.replace(/\s/g,'').toUpperCase();
      const fmt2=clean.slice(0,3)+' '+clean.slice(3);
      // Use Nominatim with postalcode parameter and Canada country code
      const url=`https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(clean)}&countrycodes=ca&format=json&addressdetails=1&limit=5`;
      const r=await fetch(url,{headers:{'Accept-Language':'en-CA,en'}});
      const d=await r.json();
      if(d&&d.length){
        const seen=new Set();
        const items=d.filter(c=>{
          const a=c.address||{};
          const n=a.city||a.town||a.village||a.suburb||a.municipality||a.county||fmt2;
          return seen.has(n)?false:(seen.add(n),true);
        }).slice(0,4).map(c=>{
          const a=c.address||{};
          const n=a.city||a.town||a.village||a.suburb||a.municipality||a.county||fmt2;
          const prov=a.state||'';
          return `<div class="search-result-item" onclick="loadCity('${n.replace(/'/g,"\\'")}',${c.lat},${c.lon});searchInp.value='';document.getElementById('searchResults').classList.add('hidden')">${n}${prov?', '+prov:''}, Canada <span style="opacity:0.5;font-size:11px">${fmt2}</span></div>`;
        });
        if(items.length){el.innerHTML=items.join('');el.classList.remove('hidden');return;}
      }
      el.innerHTML=`<div class="search-result-item" style="opacity:0.5">No results for ${fmt2} — try the city name</div>`;
      el.classList.remove('hidden');return;
    }
    if(isUSZip(q)){
      const r=await fetch(`https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(q)}&countrycodes=us&format=json&addressdetails=1&limit=4`,{headers:{'Accept-Language':'en-US,en'}});
      const d=await r.json();
      if(!d||!d.length){el.classList.add('hidden');return;}
      el.innerHTML=d.map(c=>{const a=c.address||{};const n=a.city||a.town||a.village||a.county||q;return `<div class="search-result-item" onclick="loadCity('${n.replace(/'/g,"\\'")}',${c.lat},${c.lon});searchInp.value='';document.getElementById('searchResults').classList.add('hidden')">${n}${a.state?', '+a.state:''}, USA <span style="opacity:0.5;font-size:11px">${q}</span></div>`;}).join('');
      el.classList.remove('hidden');return;
    }
    const r=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`);
    const d=await r.json();
    if(!d.results||!d.results.length){el.classList.add('hidden');return;}
    el.innerHTML=d.results.map(c=>`<div class="search-result-item" onclick="loadCity('${c.name.replace(/'/g,"\\'")}',${c.latitude},${c.longitude});searchInp.value='';document.getElementById('searchResults').classList.add('hidden')">${c.name}${c.admin1?', '+c.admin1:''}, ${c.country}</div>`).join('');
    el.classList.remove('hidden');
  }catch(e){console.error('Search:',e);}
}

// ─── LOCATION ─────────────────────────────────────────────────
async function detectLocation(){
  document.getElementById('mainContent').innerHTML='<div class="full-loading"><div class="loading-icon">📍</div><div>Detecting your location...</div></div>';
  if(!navigator.geolocation){loadCity('Toronto',43.6532,-79.3832);return;}
  navigator.geolocation.getCurrentPosition(
    async pos=>{
      const lat=pos.coords.latitude,lon=pos.coords.longitude;
      try{
        const r=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,{headers:{'Accept-Language':'en'}});
        const d=await r.json();
        const name=d.address?.city||d.address?.town||d.address?.village||d.address?.county||'My Location';
        currentCity=name;currentLat=lat;currentLon=lon;renderFavs();
        loadWeather(lat,lon,name);
      }catch{loadWeather(lat,lon,'My Location');}
    },
    ()=>loadCity('Toronto',43.6532,-79.3832)
  );
}

// ─── LOAD CITY ────────────────────────────────────────────────
function loadCity(name,lat,lon){
  currentCity=name;currentLat=lat;currentLon=lon;renderFavs();
  document.getElementById('mainContent').innerHTML=`<div class="full-loading"><div class="loading-icon">🌤️</div><div>Loading ${name}...</div></div>`;
  loadWeather(lat,lon,name);
}

// ─── EC WARNINGS ──────────────────────────────────────────────
async function fetchECWarnings(lat,lon,city){
  const warnings=[];
  try{
    const key=city.toLowerCase().trim().replace(/,.*$/,'');
    const ecCode=EC_CITIES[key];
    if(ecCode){
      const ecUrl=`https://dd.weather.gc.ca/citypage_weather/xml/${ecCode}_e.xml`;
      const proxy=`https://api.allorigins.win/get?url=${encodeURIComponent(ecUrl)}`;
      const r=await fetch(proxy);
      if(!r.ok)throw new Error('proxy fail');
      const j=await r.json();
      if(j&&j.contents){
        const parser=new DOMParser();
        const xml=parser.parseFromString(j.contents,'application/xml');
        // Current temp from EC (more accurate than model)
        const ecTempEl=xml.querySelector('currentConditions temperature');
        const ecCondEl=xml.querySelector('currentConditions condition');
        if(ecTempEl&&ecTempEl.textContent) window._ecTemp=parseFloat(ecTempEl.textContent);
        if(ecCondEl&&ecCondEl.textContent) window._ecCond=ecCondEl.textContent.trim();
        // Warnings
        xml.querySelectorAll('warnings event').forEach(el=>{
          const type=el.getAttribute('type')||'';
          const priority=el.getAttribute('priority')||'low';
          const desc=el.querySelector('description')?.textContent?.trim()||'';
          if(desc&&!desc.toLowerCase().includes('no watches')&&!desc.toLowerCase().includes('no warning')){
            warnings.push({
              type:type||'Weather Alert',
              title:desc.slice(0,150),
              severity:priority==='high'?'severe':priority==='medium'?'moderate':'minor'
            });
          }
        });
      }
    }
  }catch(e){console.log('EC fetch (non-critical):',e.message);}
  return warnings;
}

// ─── LOAD WEATHER ─────────────────────────────────────────────
async function loadWeather(lat,lon,city){
  window._ecTemp=null;window._ecCond=null;
  try{
    const url=`https://api.open-meteo.com/v1/forecast`
      +`?latitude=${lat}&longitude=${lon}`
      +`&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,relative_humidity_2m,uv_index,precipitation`
      +`&hourly=temperature_2m,precipitation_probability,weather_code`
      +`&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset`
      +`&wind_speed_unit=kmh&temperature_unit=celsius&timezone=auto&forecast_days=7&models=gem_seamless`;

    const [weatherRes,warnings]=await Promise.all([fetch(url),fetchECWarnings(lat,lon,city)]);
    if(!weatherRes.ok)throw new Error('weather API failed');
    const d=await weatherRes.json();

    currentData=d;currentCode=d.current.weather_code;
    setBackground(currentCode,new Date().getHours());
    render(d,city,warnings);
    loadAI(d.current.temperature_2m,WD[currentCode]||'',d.current.wind_speed_10m,d.current.relative_humidity_2m,city);
  }catch(e){
    console.error('loadWeather error:',e);
    document.getElementById('mainContent').innerHTML='<div class="full-loading"><div class="loading-icon">⚠️</div><div>Could not load weather. Please try searching for your city.</div></div>';
  }
}

// ─── HELPERS ──────────────────────────────────────────────────
function windDir(deg){return['N','NE','E','SE','S','SW','W','NW'][Math.round(deg/45)%8]||'';}
function fmtTime(iso){return new Date(iso).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true});}

// ─── RENDER ───────────────────────────────────────────────────
function render(d,city,warnings){
  setTheme();
  const c=d.current,now=new Date(),hour=now.getHours(),code=c.weather_code;
  const dateStr=DAYS[now.getDay()]+', '+MONTHS[now.getMonth()]+' '+now.getDate();
  const sunrise=d.daily.sunrise?.[0],sunset=d.daily.sunset?.[0];

  // Use EC observed temp if available — more accurate for Canadian cities
  const showTemp=window._ecTemp!=null?window._ecTemp:c.temperature_2m;
  const showCond=window._ecCond||WD[code]||'';
  const wDir=c.wind_direction_10m!=null?windDir(c.wind_direction_10m):'';

  // Warnings band
  let alertHTML='';
  if(warnings&&warnings.length){
    const sevCol={severe:'#ff5540',moderate:'#ff9500',minor:'#ffd000'};
    alertHTML=warnings.map(w=>`
      <div class="alert-band" style="border-color:${sevCol[w.severity]||'#f87171'}44;color:${sevCol[w.severity]||'#f87171'}">
        <span class="alert-icon">⚠️</span>
        <div><div style="font-weight:500;margin-bottom:2px">${w.type}</div><div style="font-size:12px;opacity:0.85">${w.title}</div></div>
      </div>`).join('');
  } else if(code>=95){
    alertHTML='<div class="alert-band"><span class="alert-icon">⚠️</span> Thunderstorm warning in effect.</div>';
  }

  // Sunrise / sunset
  const sunHTML=(sunrise&&sunset)?`<div class="sun-row">
    <div class="sun-card"><div class="sun-icon">🌅</div><div><div class="sun-label">Sunrise</div><div class="sun-val">${fmtTime(sunrise)}</div></div></div>
    <div class="sun-card"><div class="sun-icon">🌇</div><div><div class="sun-label">Sunset</div><div class="sun-val">${fmtTime(sunset)}</div></div></div>
  </div>`:'';

  // Hourly
  const times=d.hourly.time,htemps=d.hourly.temperature_2m,hrain=d.hourly.precipitation_probability,hcode=d.hourly.weather_code;
  let hourlyHTML='',precipHTML='',count=0;
  for(let i=0;i<times.length&&count<12;i++){
    const parts=times[i].split('T'),hr=parseInt(parts[1]);
    const dateKey=parts[0],todayKey=now.toLocaleDateString('en-CA');
    const isToday=dateKey===todayKey;
    const isTomorrow=new Date(dateKey+'T12:00:00').getDate()===new Date(now.getTime()+86400000).getDate();
    if(!isToday&&!isTomorrow)continue;
    if(isToday&&hr<hour)continue;
    const lbl=count===0?'Now':hr===0?'12am':hr<12?hr+'am':hr===12?'12pm':(hr-12)+'pm';
    hourlyHTML+=`<div class="h-card"><div class="h-time">${lbl}</div><div class="h-icon">${WI[hcode[i]]||'🌡️'}</div><div class="h-temp">${fmtShort(htemps[i])}</div><div class="h-rain">${hrain[i]}%</div></div>`;
    const bh=Math.max(4,Math.round(hrain[i]*0.68));
    precipHTML+=`<div class="precip-col"><div class="p-pct">${hrain[i]}%</div><div class="p-bar-wrap"><div class="p-bar" style="height:${bh}px"></div></div><div class="p-time">${lbl}</div></div>`;
    count++;
  }

  // 7-day
  const dd=d.daily;
  let weekHTML='';
  for(let i=0;i<7;i++){
    const[y,mo,dy]=dd.time[i].split('-').map(Number);
    const dow=new Date(y,mo-1,dy).getDay();
    const dn=i===0?'Today':i===1?'Tomorrow':DSHORT[dow];
    const wc=dd.weather_code[i],rain=dd.precipitation_probability_max[i]||0;
    weekHTML+=`<div class="day-row"><div class="d-name">${dn}</div><div class="d-icon">${WI[wc]||'🌡️'}</div><div class="d-desc">${WD[wc]||''}</div><div class="d-rain-bar"><div class="d-rain-fill" style="width:${rain}%"></div></div><div class="d-rain-pct">${rain}%</div><div class="d-temps"><span class="d-hi">${fmtShort(dd.temperature_2m_max[i])}</span><span class="d-lo">${fmtShort(dd.temperature_2m_min[i])}</span></div></div>`;
  }

  document.getElementById('mainContent').innerHTML=`
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
        <div class="ai-sub"><div class="ai-sub-title">What to wear</div><div class="loading-line" id="outfitTxt">Getting suggestions</div><div class="chips" id="outfitChips"></div></div>
        <div class="ai-divider"></div>
        <div class="ai-sub"><div class="ai-sub-title">Things to do in ${city}</div><div class="act-list" id="actList"><div class="loading-line">Finding activities</div></div></div>
      </div>
    </div>
    <div class="footer">
      <div class="footer-brand">Skye Weather</div>
      <div class="footer-data">Powered by Environment Canada · Open-Meteo GEM</div>
      <div class="footer-credit">Created by <span>MK+ Services</span></div>
    </div>`;
}

// ─── AI GUIDE ─────────────────────────────────────────────────
async function loadAI(temp,desc,wind,humidity,city){
  const prompt=`Weather in ${city}: ${Math.round(temp)}°C, ${desc}, wind ${Math.round(wind)} km/h, humidity ${Math.round(humidity)}%. Return ONLY valid JSON no markdown: {"outfit_summary":"2 practical sentences on what to wear","outfit_items":["item1","item2","item3","item4"],"activities":["activity 1","activity 2","activity 3","activity 4"]}`;
  try{
    const res=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:600,messages:[{role:'user',content:prompt}]})});
    const data=await res.json();
    const f=JSON.parse((data.content?.[0]?.text||'{}').replace(/```json|```/g,'').trim());
    const ot=document.getElementById('outfitTxt'),oc=document.getElementById('outfitChips'),al=document.getElementById('actList');
    if(ot){ot.className='ai-body';ot.textContent=f.outfit_summary||'';}
    if(oc)oc.innerHTML=(f.outfit_items||[]).map(i=>`<div class="chip">${i}</div>`).join('');
    if(al)al.innerHTML=(f.activities||[]).map(a=>`<div class="act-item"><div class="act-dot"></div>${a}</div>`).join('');
  }catch(e){const ot=document.getElementById('outfitTxt');if(ot){ot.className='ai-body';ot.textContent='AI suggestions unavailable.';}}
}

// ─── INIT ─────────────────────────────────────────────────────
renderFavs();
detectLocation();
