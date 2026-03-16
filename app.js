// ─── WEATHER MAPS ─────────────────────────────────────────────
const WI={0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',51:'🌦️',53:'🌦️',55:'🌧️',61:'🌧️',63:'🌧️',65:'🌧️',71:'🌨️',73:'🌨️',75:'❄️',80:'🌦️',81:'🌧️',82:'⛈️',95:'⛈️',96:'⛈️',99:'⛈️'};
const WD={0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Foggy',48:'Icy fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',61:'Light rain',63:'Moderate rain',65:'Heavy rain',71:'Light snow',73:'Moderate snow',75:'Heavy snow',80:'Rain showers',81:'Heavy showers',82:'Violent showers',95:'Thunderstorm',96:'Thunderstorm',99:'Thunderstorm'};
const DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DSHORT=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
let useCelsius=true,currentData=null,currentCity='',currentLat=43.6532,currentLon=-79.3832,currentCode=0,searchTmr;
let favs=JSON.parse(localStorage.getItem('skye_favs')||'null')||[{name:'Toronto',lat:43.6532,lon:-79.3832},{name:'New York',lat:40.7128,lon:-74.006},{name:'London',lat:51.5074,lon:-0.1278}];
const saveFavs=()=>localStorage.setItem('skye_favs',JSON.stringify(favs));
const API='/api/weather';
const toF=c=>Math.round(c*9/5+32);
const fmt=c=>useCelsius?Math.round(c)+'°C':toF(c)+'°F';
const fmtS=c=>useCelsius?Math.round(c)+'°':toF(c)+'°';
function toggleUnit(){useCelsius=!useCelsius;if(currentData)render(currentData,currentCity,[]);}
function setTheme(){const h=new Date().getHours();document.getElementById('app').className='app'+(h<6||h>=20?' night':'');}
const canvas=document.getElementById('bgCanvas'),ctx=canvas.getContext('2d');
let particles=[],bgScene='clear_day',tick=0;
function resizeCanvas(){canvas.width=window.innerWidth;canvas.height=window.innerHeight;}
window.addEventListener('resize',resizeCanvas);resizeCanvas();
const SKY={clear_day:['#4a90d9','#87c1f0','#b8dcf7'],sunset:['#0d1b4b','#7a2e6e','#e8703a','#f5b042'],clear_night:['#020818','#0a1540','#0d2060'],cloudy_day:['#5a7a9a','#8aa8c0','#b0c8d8'],cloudy_night:['#080e20','#141e35','#1e2d45'],rain:['#1a2a3a','#2a3e52','#3a5268'],storm:['#0a0f1e','#151f32','#1e2e45'],snow:['#c0d0e0','#d8e5ef','#eaf1f7'],fog:['#8a9aaa','#aabbc8','#c8d5de']};
function getScene(code,hour){const night=hour<6||hour>=20,dusk=(hour>=5&&hour<7)||(hour>=18&&hour<21);if(code>=95)return 'storm';if(code>=71)return 'snow';if(code>=51)return 'rain';if(code>=45)return 'fog';if(code>=3)return night?'cloudy_night':'cloudy_day';if(night)return 'clear_night';if(dusk)return 'sunset';return 'clear_day';}
function drawSky(s){const stops=SKY[s]||SKY.clear_day,g=ctx.createLinearGradient(0,0,0,canvas.height);stops.forEach((c,i)=>g.addColorStop(i/(stops.length-1),c));ctx.fillStyle=g;ctx.fillRect(0,0,canvas.width,canvas.height);}
function drawCelestial(s){const w=canvas.width,h=canvas.height;if(s==='clear_day'||s==='cloudy_day'){const x=w*.75,y=h*.18,g=ctx.createRadialGradient(x,y,10,x,y,100);g.addColorStop(0,'rgba(255,240,180,.45)');g.addColorStop(1,'rgba(255,220,80,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,100,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(255,235,120,.92)';ctx.beginPath();ctx.arc(x,y,32,0,Math.PI*2);ctx.fill();}if(s==='sunset'){const sy=h*.62,g=ctx.createRadialGradient(w*.5,sy,5,w*.5,sy,180);g.addColorStop(0,'rgba(255,200,80,.6)');g.addColorStop(.4,'rgba(240,100,40,.3)');g.addColorStop(1,'rgba(200,40,80,0)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);ctx.fillStyle='rgba(255,210,90,.95)';ctx.beginPath();ctx.arc(w*.5,sy,28,0,Math.PI*2);ctx.fill();const hg=ctx.createLinearGradient(0,sy-60,0,h);hg.addColorStop(0,'rgba(240,120,40,.35)');hg.addColorStop(1,'rgba(180,40,60,0)');ctx.fillStyle=hg;ctx.fillRect(0,sy-60,w,h);}if(s==='clear_night'||s==='cloudy_night'){const x=w*.78,y=h*.15;ctx.fillStyle='rgba(220,230,255,.9)';ctx.beginPath();ctx.arc(x,y,20,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(8,14,32,.85)';ctx.beginPath();ctx.arc(x+9,y-4,17,0,Math.PI*2);ctx.fill();for(let i=0;i<80;i++){const sx=Math.random()*w,sy=Math.random()*h*.55,r=Math.random()*1.4+.3;ctx.fillStyle=`rgba(255,255,255,${Math.random()*.7+.2})`;ctx.beginPath();ctx.arc(sx,sy,r,0,Math.PI*2);ctx.fill();}}}
function initParticles(s){particles=[];const w=canvas.width,h=canvas.height;if(s==='rain'||s==='storm'){for(let i=0;i<220;i++)particles.push({x:Math.random()*w,y:Math.random()*h,vy:12+Math.random()*8,vx:-2-Math.random()*2,len:18+Math.random()*14,alpha:.25+Math.random()*.3});}if(s==='snow'){for(let i=0;i<140;i++)particles.push({x:Math.random()*w,y:Math.random()*h,vy:.8+Math.random()*1.2,vx:Math.sin(Math.random()*Math.PI*2)*.5,r:2+Math.random()*3,alpha:.5+Math.random()*.4,drift:Math.random()*Math.PI*2});}if(s==='fog'){for(let i=0;i<18;i++)particles.push({x:Math.random()*w,y:h*.3+Math.random()*h*.5,vx:.15+Math.random()*.2,pw:300+Math.random()*400,ph:60+Math.random()*80,alpha:.04+Math.random()*.06});}if(s==='clear_day'||s==='sunset'||s==='cloudy_day'){for(let i=0;i<6;i++)particles.push({x:Math.random()*w,y:h*.1+Math.random()*h*.35,vx:.1+Math.random()*.15,pw:200+Math.random()*300,ph:40+Math.random()*50,alpha:.06+Math.random()*.07,type:'cloud'});}}
function animateBg(){requestAnimationFrame(animateBg);tick++;ctx.clearRect(0,0,canvas.width,canvas.height);drawSky(bgScene);drawCelestial(bgScene);const w=canvas.width,h=canvas.height;if(bgScene==='rain'||bgScene==='storm'){ctx.strokeStyle='rgba(180,210,255,.5)';ctx.lineWidth=1;particles.forEach(p=>{ctx.globalAlpha=p.alpha;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+p.vx*2,p.y+p.len);ctx.stroke();p.x+=p.vx;p.y+=p.vy;if(p.y>h){p.y=-20;p.x=Math.random()*w;}});if(bgScene==='storm'&&tick%120===0){ctx.globalAlpha=.08;ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);}ctx.globalAlpha=1;}if(bgScene==='snow'){particles.forEach(p=>{p.drift+=.012;p.x+=p.vx+Math.sin(p.drift)*.4;p.y+=p.vy;if(p.y>h){p.y=-10;p.x=Math.random()*w;}ctx.globalAlpha=p.alpha;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();});ctx.globalAlpha=1;}if(bgScene==='fog'){particles.forEach(p=>{p.x+=p.vx;if(p.x>w+p.pw)p.x=-p.pw;ctx.globalAlpha=p.alpha;const fg=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.pw/2);fg.addColorStop(0,'rgba(200,215,225,.9)');fg.addColorStop(1,'rgba(200,215,225,0)');ctx.fillStyle=fg;ctx.beginPath();ctx.ellipse(p.x,p.y,p.pw/2,p.ph/2,0,0,Math.PI*2);ctx.fill();});ctx.globalAlpha=1;}if(bgScene==='clear_day'||bgScene==='sunset'||bgScene==='cloudy_day'){particles.forEach(p=>{if(p.type!=='cloud')return;p.x+=p.vx;if(p.x>w+p.pw)p.x=-p.pw;ctx.globalAlpha=p.alpha*(bgScene==='sunset'?1.4:1);const cg=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.pw/2);cg.addColorStop(0,'rgba(255,255,255,.9)');cg.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=cg;ctx.beginPath();ctx.ellipse(p.x,p.y,p.pw/2,p.ph/2,0,0,Math.PI*2);ctx.fill();});ctx.globalAlpha=1;}}
function setBg(code,hour){const s=getScene(code,hour);if(s===bgScene&&particles.length)return;bgScene=s;initParticles(s);}
animateBg();
function showAlert(idx){
  const existing=document.getElementById('alertModal');if(existing)existing.remove();
  const w=(window._activeWarnings||[])[idx];if(!w)return;
  const sevCol={extreme:'#ff4040',severe:'#ff5540',moderate:'#ff9500',minor:'#frd000'};
  const col={extreme:'#ff4040',severe:'#ff5540',moderate:'#ff9500',minor:'#ffd000'}[w.severity]||'#ff8070';
  const sevLabel=w.severity==='severe'?'Severe Warning':w.severity==='moderate'?'Weather Watch':w.severity==='extreme'?'Extreme Warning':'Special Statement';
  const modal=document.createElement('div');
  modal.id='alertModal';
  modal.style.cssText='position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,0.70);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);';
  modal.innerHTML=`<div style="background:#121417;border:1px solid ${col}33;border-radius:20px 20px 0 0;padding:0;max-width:480px;width:100%;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 -20px 60px rgba(0,0,0,0.8);">
    <div style="padding:1.25rem 1.5rem 0;flex-shrink:0;">
      <div style="width:36px;height:4px;background:rgba(255,255,255,0.15);border-radius:2px;margin:0 auto 1.25rem;"></div>
      <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:1rem;">
        <div style="width:44px;height:44px;border-radius:12px;background:${col}18;border:1px solid ${col}33;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">⚠️</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${col};margin-bottom:4px;font-family:'DM Sans',sans-serif">${sevLabel}</div>
          <div style="font-size:16px;font-weight:500;color:#E8EDF2;line-height:1.3;font-family:'DM Sans',sans-serif">${w.type}</div>
        </div>
        <button onclick="document.getElementById('alertModal').remove()" style="width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.10);color:#9AA3AD;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;line-height:1;font-family:sans-serif">×</button>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:1rem;">
        <div style="font-size:10px;padding:4px 10px;border-radius:20px;background:${col}15;color:${col};border:1px solid ${col}30;font-family:'DM Sans',sans-serif">Environment Canada</div>
        <div style="font-size:10px;padding:4px 10px;border-radius:20px;background:rgba(255,255,255,0.05);color:#6B747D;border:1px solid rgba(255,255,255,0.08);font-family:'DM Sans',sans-serif">${currentCity}</div>
      </div>
      <div style="height:1px;background:${col}22;"></div>
    </div>
    <div id="alertFullText" style="padding:1.25rem 1.5rem;overflow-y:auto;flex:1;font-family:'DM Sans',sans-serif;">
      <div style="color:#6B747D;font-size:13px;font-style:italic">Loading full statement...</div>
    </div>
    <div style="padding:1rem 1.5rem 1.5rem;flex-shrink:0;border-top:1px solid rgba(255,255,255,0.06);">
      <button onclick="document.getElementById('alertModal').remove()" style="width:100%;padding:13px;border-radius:12px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.10);color:#E8EDF2;font-size:14px;font-weight:500;cursor:pointer;font-family:'DM Sans',sans-serif;">Dismiss</button>
    </div>
  </div>`;
  modal.addEventListener('click',e=>{if(e.target===modal)modal.remove();});
  document.body.appendChild(modal);
  const textEl=modal.querySelector('#alertFullText');
  if(w.fullText){
    renderAlertText(textEl,null,w.fullText);
  } else {
    fetch(`${API}?type=alertdetail&city=${encodeURIComponent(currentCity)}&lat=${currentLat}&lon=${currentLon}`)
      .then(r=>r.json())
      .then(d=>{
        if(d.sections&&d.sections.length>0){renderAlertText(textEl,d.sections,null);}
        else if(d.fullText&&d.fullText.length>20){renderAlertText(textEl,null,d.fullText);}
        else{textEl.innerHTML='<div style="color:#9AA3AD;font-size:14px;line-height:1.75">'+(w.issuedTime||w.title||'No additional details available.')+'</div>';}
      })
      .catch(()=>{textEl.innerHTML='<div style="color:#9AA3AD;font-size:14px;line-height:1.75">'+(w.issuedTime||w.title||'Could not load statement.')+'</div>';});
  }
}

function renderAlertText(el,sections,fullText){
  if(sections&&sections.length>0){
    el.innerHTML=sections.map(s=>{
      const lines=s.text.split('\n');
      let out='';
      lines.forEach((line,i)=>{
        const t=line.trim();if(!t)return;
        if(t==='###'){out+='<div style="height:1px;background:rgba(255,255,255,0.08);margin:12px 0;"></div>';}
        else if(/^(What|When|Where|Why|Additional information|Impacts|Issued by|Discussion):/i.test(t)){
          const colon=t.indexOf(':');
          out+='<div style="margin-bottom:14px;"><div style="font-weight:500;color:#E8EDF2;font-size:13px;margin-bottom:5px;">'+t.slice(0,colon)+'</div><div style="color:#9AA3AD;font-size:14px;line-height:1.75;">'+t.slice(colon+1).trim()+'</div></div>';
        } else if(i===0){out+='<div style="color:#E8EDF2;font-size:14px;line-height:1.75;margin-bottom:16px;">'+t+'</div>';}
        else{out+='<div style="color:#9AA3AD;font-size:14px;line-height:1.75;margin-bottom:10px;">'+t+'</div>';}
      });
      return out;
    }).join('<div style="height:1px;background:rgba(255,255,255,0.06);margin:14px 0;"></div>');
  } else if(fullText){
    el.innerHTML=fullText.split(/\n+/).filter(p=>p.trim()).map(p=>{
      const t=p.trim();
      if(t==='###')return'<div style="height:1px;background:rgba(255,255,255,0.08);margin:12px 0;"></div>';
      if(/^(What|When|Where|Additional information|Impacts|Issued by):/i.test(t)){
        const colon=t.indexOf(':');
        return'<div style="margin-bottom:14px;"><div style="font-weight:500;color:#E8EDF2;font-size:13px;margin-bottom:5px;">'+t.slice(0,colon)+'</div><div style="color:#9AA3AD;font-size:14px;line-height:1.75;">'+t.slice(colon+1).trim()+'</div></div>';
      }
      return'<div style="color:#9AA3AD;font-size:14px;line-height:1.75;margin-bottom:10px;">'+t+'</div>';
    }).join('');
  }
}

function renderFavs(){document.getElementById('favsRow').innerHTML=favs.map((f,i)=>`<div class="fav-chip${f.name===currentCity?' active':''}" onclick="loadCity('${f.name.replace(/'/g,"\\'")}',${f.lat},${f.lon})">${f.name}<span class="fav-remove" onclick="event.stopPropagation();removeFav(${i})">×</span></div>`).join('')+`<button class="add-fav-btn" onclick="addFav()">+ Save</button>`;}
function addFav(){if(currentCity&&!favs.find(f=>f.name===currentCity)){favs.push({name:currentCity,lat:currentLat,lon:currentLon});saveFavs();renderFavs();}}
function removeFav(i){favs.splice(i,1);saveFavs();renderFavs();}
const searchInp=document.getElementById('searchInp');
searchInp.addEventListener('input',()=>{clearTimeout(searchTmr);const q=searchInp.value.trim();if(q.length<2){document.getElementById('searchResults').classList.add('hidden');return;}searchTmr=setTimeout(()=>doSearch(q),450);});
searchInp.addEventListener('blur',()=>setTimeout(()=>document.getElementById('searchResults').classList.add('hidden'),200));
const isCAPostal=q=>/^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/.test(q.trim());
const isUSZip=q=>/^\d{5}$/.test(q.trim());
async function doSearch(q){const el=document.getElementById('searchResults');try{if(isCAPostal(q)||isUSZip(q)){const r=await fetch(`${API}?type=postal&postal=${encodeURIComponent(q.trim())}`);const d=await r.json();if(d&&d.length){const seen=new Set();const items=d.filter(c=>{const n=c._postalCity||(c.address?.city||c.address?.town||c.address?.village||c.address?.suburb||q);return seen.has(n)?false:(seen.add(n),true);}).slice(0,4).map(c=>{const n=c._postalCity||(c.address?.city||c.address?.town||c.address?.village||c.address?.suburb||q);const prov=c._postalProv||(c.address?.state||'');const code2=c._postalCode||q.toUpperCase();const country=c.address?.country_code==='ca'?'Canada':c.address?.country_code==='us'?'USA':'Canada';return `<div class="search-result-item" onclick="loadCity('${n.replace(/'/g,"\\'")}',${c.lat},${c.lon});searchInp.value='';document.getElementById('searchResults').classList.add('hidden')">${n}${prov?', '+prov:''}, ${country} <span style="opacity:.5;font-size:11px">${code2}</span></div>`;});if(items.length){el.innerHTML=items.join('');el.classList.remove('hidden');return;}}el.innerHTML=`<div class="search-result-item" style="opacity:.5">No results for ${q.toUpperCase()} — try the city name</div>`;el.classList.remove('hidden');return;}const r=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`);const d=await r.json();if(!d.results||!d.results.length){el.classList.add('hidden');return;}el.innerHTML=d.results.map(c=>`<div class="search-result-item" onclick="loadCity('${c.name.replace(/'/g,"\\'")}',${c.latitude},${c.longitude});searchInp.value='';document.getElementById('searchResults').classList.add('hidden')">${c.name}${c.admin1?', '+c.admin1:''}, ${c.country}</div>`).join('');el.classList.remove('hidden');}catch(e){console.error('Search:',e);}}
async function detectLocation(){document.getElementById('mainContent').innerHTML='<div class="full-loading"><div class="loading-icon">📍</div><div>Detecting your location...</div></div>';if(!navigator.geolocation){loadCity('Toronto',43.6532,-79.3832);return;}navigator.geolocation.getCurrentPosition(async pos=>{const lat=pos.coords.latitude,lon=pos.coords.longitude;try{const r=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,{headers:{'Accept-Language':'en'}});const d=await r.json();const name=d.address?.city||d.address?.town||d.address?.village||d.address?.county||'My Location';currentCity=name;currentLat=lat;currentLon=lon;renderFavs();loadWeather(lat,lon,name);}catch{loadWeather(lat,lon,'My Location');}},()=>loadCity('Toronto',43.6532,-79.3832));}
function loadCity(name,lat,lon){currentCity=name;currentLat=parseFloat(lat);currentLon=parseFloat(lon);renderFavs();document.getElementById('mainContent').innerHTML=`<div class="full-loading"><div class="loading-icon">🌤️</div><div>Loading ${name}...</div></div>`;loadWeather(lat,lon,name);}
async function loadWeather(lat,lon,city){
  // Step 1: Forecast ONLY — if this fails, show error. Nothing else can break this.
  let forecast;
  try{
    const r=await fetch(`${API}?type=forecast&lat=${lat}&lon=${lon}`);
    if(!r.ok) throw new Error('Forecast API returned '+r.status);
    forecast=await r.json();
    if(!forecast||!forecast.current) throw new Error('Invalid forecast data');
  }catch(e){
    console.error('Forecast failed:',e);
    document.getElementById('mainContent').innerHTML='<div class="full-loading"><div class="loading-icon">⚠️</div><div>Could not load weather. Please search for your city.</div></div>';
    return;
  }

  // Step 2: EC conditions + alerts — totally optional, never block weather display
  let ecTemp=null,ecCond=null,warnings=[];
  try{
    const [ecRes,alertsRes]=await Promise.allSettled([
      fetch(`${API}?type=ec&city=${encodeURIComponent(city)}&lat=${lat}&lon=${lon}`),
      fetch(`${API}?type=alerts&lat=${lat}&lon=${lon}`)
    ]);
    if(ecRes.status==='fulfilled'&&ecRes.value.ok){
      const ec=await ecRes.value.json();
      ecTemp=ec.ecTemp||null; ecCond=ec.ecCond||null; warnings=ec.warnings||[];
    }
    if(alertsRes.status==='fulfilled'&&alertsRes.value.ok){
      const al=await alertsRes.value.json();
      if(al.alerts&&al.alerts.length) warnings=[...warnings,...al.alerts];
    }
  }catch(e){ console.log('EC/alerts non-critical:',e.message); }

  // Deduplicate warnings
  const seen=new Set();
  warnings=warnings.filter(w=>{if(seen.has(w.type))return false;seen.add(w.type);return true;});

  currentData=forecast; currentCode=forecast.current.weather_code;
  forecast.current._ecTemp=ecTemp; forecast.current._ecCond=ecCond;
  setBg(currentCode,new Date().getHours());
  render(forecast,city,warnings);
  loadAI(forecast.current.temperature_2m,WD[currentCode]||'',forecast.current.wind_speed_10m,forecast.current.relative_humidity_2m,city);
}
async function loadAI(temp,desc,wind,humidity,city){const prompt=`Weather in ${city}: ${Math.round(temp)}°C, ${desc}, wind ${Math.round(wind)} km/h, humidity ${Math.round(humidity)}%. Return ONLY valid JSON no markdown: {"outfit_summary":"2 practical sentences on what to wear","outfit_items":["item1","item2","item3","item4"],"activities":["activity 1","activity 2","activity 3","activity 4"]}`;try{const res=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:600,messages:[{role:'user',content:prompt}]})});const data=await res.json();const f=JSON.parse((data.content?.[0]?.text||'{}').replace(/```json|```/g,'').trim());const ot=document.getElementById('outfitTxt'),oc=document.getElementById('outfitChips'),al=document.getElementById('actList');if(ot){ot.className='ai-body';ot.textContent=f.outfit_summary||'';}if(oc)oc.innerHTML=(f.outfit_items||[]).map(i=>`<div class="chip">${i}</div>`).join('');if(al)al.innerHTML=(f.activities||[]).map(a=>`<div class="act-item"><div class="act-dot"></div>${a}</div>`).join('');}catch(e){const ot=document.getElementById('outfitTxt');if(ot){ot.className='ai-body';ot.textContent='AI suggestions unavailable.';}}}
renderFavs();
detectLocation();
