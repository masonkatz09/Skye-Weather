// ─── CONSTANTS ───────────────────────────────────────────────
const WI = {
  0:'☀️', 1:'🌤️', 2:'⛅', 3:'☁️',
  45:'🌫️', 48:'🌫️',
  51:'🌦️', 53:'🌦️', 55:'🌧️',
  61:'🌧️', 63:'🌧️', 65:'🌧️',
  71:'🌨️', 73:'🌨️', 75:'❄️',
  80:'🌦️', 81:'🌧️', 82:'⛈️',
  95:'⛈️', 96:'⛈️', 99:'⛈️'
};

const WD = {
  0:'Clear sky', 1:'Mainly clear', 2:'Partly cloudy', 3:'Overcast',
  45:'Foggy', 48:'Icy fog',
  51:'Light drizzle', 53:'Drizzle', 55:'Heavy drizzle',
  61:'Light rain', 63:'Moderate rain', 65:'Heavy rain',
  71:'Light snow', 73:'Moderate snow', 75:'Heavy snow',
  80:'Rain showers', 81:'Heavy showers', 82:'Violent showers',
  95:'Thunderstorm', 96:'Thunderstorm', 99:'Thunderstorm'
};

const DAYS  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ─── STATE ───────────────────────────────────────────────────
let useCelsius   = true;
let currentData  = null;
let currentCity  = '';
let currentLat   = 43.6532;
let currentLon   = -79.3832;
let searchTimeout;

let favourites = JSON.parse(localStorage.getItem('skye_favs') || 'null') || [
  { name: 'Toronto',  lat: 43.6532, lon: -79.3832 },
  { name: 'New York', lat: 40.7128, lon: -74.0060 },
  { name: 'London',   lat: 51.5074, lon: -0.1278  }
];

function saveFavs() {
  localStorage.setItem('skye_favs', JSON.stringify(favourites));
}

// ─── UNIT TOGGLE ─────────────────────────────────────────────
function toF(c) { return Math.round(c * 9 / 5 + 32); }
function fmt(c) { return useCelsius ? Math.round(c) + '°C' : toF(c) + '°F'; }
function fmtShort(c) { return useCelsius ? Math.round(c) + '°' : toF(c) + '°'; }

function toggleUnit() {
  useCelsius = !useCelsius;
  if (currentData) render(currentData, currentCity);
}

// ─── THEME ───────────────────────────────────────────────────
function setTheme() {
  const h = new Date().getHours();
  const isNight = h < 6 || h >= 20;
  document.getElementById('app').className = 'app' + (isNight ? ' night' : '');
}

function heroColor(code, hour) {
  const isNight = hour < 6 || hour >= 20;
  if (isNight)          return '#060c1e';
  if (code === 0)       return '#1a4a8a';
  if (code <= 2)        return '#1e568a';
  if (code === 3)       return '#2a3a4a';
  if (code <= 55)       return '#1a2e3a';
  if (code <= 82)       return '#0f1a2a';
  return '#1a1025';
}

// ─── FAVOURITES ──────────────────────────────────────────────
function renderFavs() {
  const row = document.getElementById('favsRow');
  row.innerHTML = favourites.map((f, i) => `
    <div class="fav-chip${f.name === currentCity ? ' active' : ''}"
         onclick="loadCity('${f.name.replace(/'/g,"\\'")}', ${f.lat}, ${f.lon})">
      ${f.name}
      <span class="fav-remove" onclick="event.stopPropagation(); removeFav(${i})">×</span>
    </div>
  `).join('') + `<button class="add-fav-btn" onclick="addFav()">+ Save</button>`;
}

function addFav() {
  if (currentCity && !favourites.find(f => f.name === currentCity)) {
    favourites.push({ name: currentCity, lat: currentLat, lon: currentLon });
    saveFavs();
    renderFavs();
  }
}

function removeFav(i) {
  favourites.splice(i, 1);
  saveFavs();
  renderFavs();
}

// ─── SEARCH ──────────────────────────────────────────────────
const searchInp = document.getElementById('searchInp');

searchInp.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  const q = searchInp.value.trim();
  if (q.length < 2) {
    document.getElementById('searchResults').classList.add('hidden');
    return;
  }
  searchTimeout = setTimeout(() => searchCity(q), 400);
});

searchInp.addEventListener('blur', () => {
  setTimeout(() => document.getElementById('searchResults').classList.add('hidden'), 200);
});

async function searchCity(q) {
  try {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`);
    const d = await r.json();
    const el = document.getElementById('searchResults');
    if (!d.results || !d.results.length) {
      el.classList.add('hidden');
      return;
    }
    el.classList.remove('hidden');
    el.innerHTML = d.results.map(c => `
      <div class="search-result-item"
           onclick="loadCity('${c.name.replace(/'/g,"\\'")}', ${c.latitude}, ${c.longitude});
                    searchInp.value='';
                    document.getElementById('searchResults').classList.add('hidden');">
        ${c.name}${c.admin1 ? ', ' + c.admin1 : ''}, ${c.country}
      </div>
    `).join('');
  } catch (e) {
    console.error('Search failed', e);
  }
}

// ─── LOCATION ────────────────────────────────────────────────
async function detectLocation() {
  document.getElementById('mainContent').innerHTML = `
    <div class="full-loading">
      <div class="loading-icon">📍</div>
      <div>Detecting your location...</div>
    </div>`;

  if (!navigator.geolocation) {
    await loadCity('Toronto', 43.6532, -79.3832);
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async pos => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
        const d = await r.json();
        const name = d.address.city || d.address.town || d.address.village || d.address.county || 'My Location';
        currentCity = name;
        currentLat  = lat;
        currentLon  = lon;
        renderFavs();
        await loadWeather(lat, lon, name);
      } catch {
        await loadWeather(lat, lon, 'My Location');
      }
    },
    async () => {
      await loadCity('Toronto', 43.6532, -79.3832);
    }
  );
}

// ─── LOAD CITY ───────────────────────────────────────────────
async function loadCity(name, lat, lon) {
  currentCity = name;
  currentLat  = lat;
  currentLon  = lon;
  renderFavs();
  document.getElementById('mainContent').innerHTML = `
    <div class="full-loading">
      <div class="loading-icon">🌤️</div>
      <div>Loading ${name}...</div>
    </div>`;
  await loadWeather(lat, lon, name);
}

// ─── LOAD WEATHER ────────────────────────────────────────────
async function loadWeather(lat, lon, city) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast`
      + `?latitude=${lat}&longitude=${lon}`
      + `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m,uv_index,precipitation`
      + `&hourly=temperature_2m,precipitation_probability,weather_code`
      + `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset`
      + `&wind_speed_unit=kmh&temperature_unit=celsius&timezone=auto&forecast_days=7`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('Weather fetch failed');
    const d = await res.json();

    currentData = d;
    render(d, city);
    loadAI(d.current.temperature_2m, WD[d.current.weather_code] || '', d.current.wind_speed_10m, d.current.relative_humidity_2m, city);
  } catch (e) {
    document.getElementById('mainContent').innerHTML = `
      <div class="full-loading">
        <div class="loading-icon">⚠️</div>
        <div>Could not load weather. Try another city.</div>
      </div>`;
  }
}

// ─── RENDER ──────────────────────────────────────────────────
function render(d, city) {
  setTheme();

  const c    = d.current;
  const now  = new Date();
  const hour = now.getHours();
  const code = c.weather_code;
  const hbg  = heroColor(code, hour);
  const dateStr = DAYS[now.getDay()] + ', ' + MONTHS[now.getMonth()] + ' ' + now.getDate();

  const sunrise = d.daily.sunrise?.[0];
  const sunset  = d.daily.sunset?.[0];

  // Alert band
  const alertBand = (code >= 95)
    ? `<div class="alert-band"><span class="alert-icon">⚠️</span> Thunderstorm warning in effect for ${city}.</div>`
    : '';

  // Sunrise/sunset
  const sunRow = (sunrise && sunset)
    ? `<div class="sun-row">
        <div class="sun-card">
          <div class="sun-icon">🌅</div>
          <div>
            <div class="sun-label">Sunrise</div>
            <div class="sun-val">${fmtTime(sunrise)}</div>
          </div>
        </div>
        <div class="sun-card">
          <div class="sun-icon">🌇</div>
          <div>
            <div class="sun-label">Sunset</div>
            <div class="sun-val">${fmtTime(sunset)}</div>
          </div>
        </div>
      </div>`
    : '';

  // Hourly + precip
  const times  = d.hourly.time;
  const htemps = d.hourly.temperature_2m;
  const hrain  = d.hourly.precipitation_probability;
  const hcode  = d.hourly.weather_code;

  let hourlyHTML = '';
  let precipHTML = '';
  let count = 0;

  for (let i = 0; i < times.length && count < 12; i++) {
    const t = new Date(times[i]);
    if (t >= now) {
      const hr    = t.getHours();
      const label = count === 0 ? 'Now'
        : hr === 0  ? '12am'
        : hr < 12   ? hr + 'am'
        : hr === 12 ? '12pm'
        : (hr - 12) + 'pm';

      hourlyHTML += `
        <div class="h-card">
          <div class="h-time">${label}</div>
          <div class="h-icon">${WI[hcode[i]] || '🌡️'}</div>
          <div class="h-temp">${fmtShort(htemps[i])}</div>
          <div class="h-rain">${hrain[i]}%</div>
        </div>`;

      const bh = Math.max(4, Math.round(hrain[i] * 0.68));
      precipHTML += `
        <div class="precip-col">
          <div class="p-pct">${hrain[i]}%</div>
          <div class="p-bar-wrap"><div class="p-bar" style="height:${bh}px"></div></div>
          <div class="p-time">${label}</div>
        </div>`;

      count++;
    }
  }

  // 7-day
  let weekHTML = '';
  const dd = d.daily;
  for (let i = 0; i < 7; i++) {
    const dt   = new Date(dd.time[i]);
    const dn   = i === 0 ? 'Today' : DAYS[dt.getDay()];
    const wc   = dd.weather_code[i];
    const rain = dd.precipitation_probability_max[i] || 0;
    weekHTML += `
      <div class="day-row">
        <div class="d-name">${dn}</div>
        <div class="d-icon">${WI[wc] || '🌡️'}</div>
        <div class="d-desc">${WD[wc] || ''}</div>
        <div class="d-rain-bar"><div class="d-rain-fill" style="width:${rain}%"></div></div>
        <div class="d-rain-pct">${rain}%</div>
        <div class="d-temps">
          <span class="d-hi">${fmtShort(dd.temperature_2m_max[i])}</span>
          <span class="d-lo">${fmtShort(dd.temperature_2m_min[i])}</span>
        </div>
      </div>`;
  }

  document.getElementById('mainContent').innerHTML = `
    <div class="hero" style="background:${hbg}">
      <div class="hero-city">${city}</div>
      <div class="hero-date">${dateStr}</div>
      <div class="hero-main">
        <div>
          <div class="hero-temp-wrap">
            <div class="hero-temp">${useCelsius ? Math.round(c.temperature_2m) : toF(c.temperature_2m)}</div>
            <div class="hero-unit">${useCelsius ? '°C' : '°F'}</div>
          </div>
          <div class="hero-feels">Feels like ${fmt(c.apparent_temperature)}</div>
        </div>
        <div class="hero-right">
          <span class="hero-icon">${WI[code] || '🌡️'}</span>
          <div class="hero-desc">${WD[code] || ''}</div>
        </div>
      </div>
      <div class="hero-stats">
        <div class="hs" style="background:${hbg}">
          <div class="hs-l">Wind</div>
          <div class="hs-v">${Math.round(c.wind_speed_10m)} km/h</div>
        </div>
        <div class="hs" style="background:${hbg}">
          <div class="hs-l">Humidity</div>
          <div class="hs-v">${Math.round(c.relative_humidity_2m)}%</div>
        </div>
        <div class="hs" style="background:${hbg}">
          <div class="hs-l">UV Index</div>
          <div class="hs-v">${Math.round(c.uv_index)}</div>
        </div>
        <div class="hs" style="background:${hbg}">
          <div class="hs-l">Rain</div>
          <div class="hs-v">${c.precipitation || 0} mm</div>
        </div>
      </div>
    </div>

    ${alertBand}
    ${sunRow}

    <div class="sec">
      <div class="sec-label">Hourly</div>
      <div class="hourly-row">${hourlyHTML}</div>
    </div>

    <div class="sec">
      <div class="sec-label">Precipitation chance</div>
      <div class="precip-wrap">
        <div class="precip-bars">${precipHTML}</div>
      </div>
    </div>

    <div class="sec">
      <div class="sec-label">7-day forecast</div>
      <div class="week-list">${weekHTML}</div>
    </div>

    <div class="sec" id="aiSec">
      <div class="sec-label">Today's guide</div>
      <div class="ai-card">
        <div class="ai-sub">
          <div class="ai-sub-title">What to wear</div>
          <div class="loading-line" id="outfitTxt">Getting outfit suggestions</div>
          <div class="chips" id="outfitChips"></div>
        </div>
        <div class="ai-divider"></div>
        <div class="ai-sub">
          <div class="ai-sub-title">Things to do in ${city}</div>
          <div class="act-list" id="actList">
            <div class="loading-line">Finding activities</div>
          </div>
        </div>
      </div>
    </div>

    <div class="footer">Skye — weather, reimagined &nbsp;·&nbsp; Data: Open-Meteo</div>
  `;
}

// ─── AI GUIDE ────────────────────────────────────────────────
async function loadAI(temp, desc, wind, humidity, city) {
  const prompt = `Weather in ${city} right now: ${Math.round(temp)}°C, ${desc}, wind ${Math.round(wind)} km/h, humidity ${Math.round(humidity)}%.

Return ONLY valid JSON with no markdown or backticks:
{
  "outfit_summary": "2 specific, practical sentences about what to wear today",
  "outfit_items": ["item 1", "item 2", "item 3", "item 4"],
  "activities": ["specific activity 1 suited to this weather", "activity 2", "activity 3", "activity 4"]
}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await res.json();
    const raw  = data.content?.[0]?.text || '{}';
    const f    = JSON.parse(raw.replace(/```json|```/g, '').trim());

    const outfitTxt  = document.getElementById('outfitTxt');
    const outfitChips = document.getElementById('outfitChips');
    const actList    = document.getElementById('actList');

    if (outfitTxt)   outfitTxt.className = 'ai-body';
    if (outfitTxt)   outfitTxt.textContent = f.outfit_summary || '';
    if (outfitChips) outfitChips.innerHTML = (f.outfit_items || []).map(i => `<div class="chip">${i}</div>`).join('');
    if (actList)     actList.innerHTML     = (f.activities || []).map(a => `<div class="act-item"><div class="act-dot"></div>${a}</div>`).join('');
  } catch (e) {
    const outfitTxt = document.getElementById('outfitTxt');
    if (outfitTxt) { outfitTxt.className = 'ai-body'; outfitTxt.textContent = 'Could not load suggestions.'; }
  }
}

// ─── HELPERS ─────────────────────────────────────────────────
function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// ─── INIT ────────────────────────────────────────────────────
renderFavs();
detectLocation();
