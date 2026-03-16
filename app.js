const WI={0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',51:'🌦️',53:'🌦️',55:'🌧️',61:'🌧️',63:'🌧️',65:'🌧️',71:'🌨️',73:'🌨️',75:'❄️',80:'🌦️',81:'🌧️',82:'⛈️',95:'⛈️',96:'⛈️',99:'⛈️'};
const WD={0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Foggy',48:'Icy fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',61:'Light rain',63:'Moderate rain',65:'Heavy rain',71:'Light snow',73:'Moderate snow',75:'Heavy snow',80:'Rain showers',81:'Heavy showers',82:'Violent showers',95:'Thunderstorm',96:'Thunderstorm',99:'Thunderstorm'};

let useCelsius=true, currentData=null, currentCity='Toronto', currentLat=43.6532, currentLon=-79.3832;

// --- GEOLOCATION ---
async function detectLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(async (p) => {
      currentLat = p.coords.latitude;
      currentLon = p.coords.longitude;
      const res = await fetch(`/api/weather?type=search&q=${currentLat},${currentLon}`);
      const data = await res.json();
      currentCity = data.city || "My Location";
      refreshWeather();
    }, () => alert("GPS Access Denied."), { enableHighAccuracy: true });
  }
}

// --- CORE REFRESH ---
async function refreshWeather() {
  const [fRes, aRes] = await Promise.all([
    fetch(`/api/weather?type=forecast&lat=${currentLat}&lon=${currentLon}`),
    fetch(`/api/weather?type=alerts&lat=${currentLat}&lon=${currentLon}`)
  ]);
  currentData = await fRes.json();
  const alertData = await aRes.json();

  const banner = document.getElementById('alertBanner');
  if (alertData.alerts && alertData.alerts.length > 0) {
    banner.textContent = `⚠️ ${alertData.alerts[0].title}`;
    banner.style.display = 'block';
  } else {
    banner.style.display = 'none';
  }

  render(currentData, currentCity);
  loadAI(currentData.current.temperature_2m, WD[currentData.current.weather_code], currentData.current.wind_speed_10m, currentData.current.relative_humidity_2m, currentCity);
}

// --- RENDER LUXE UI ---
function render(d, city) {
  const c = d.current;
  const temp = useCelsius ? Math.round(c.temperature_2m) : Math.round(c.temperature_2m * 9/5 + 32);
  
  document.getElementById('mainContent').innerHTML = `
    <div class="hero">
      <div class="hero-city">${city}</div>
      <div class="hero-temp-wrap">
        <div class="hero-temp">${temp}</div>
        <div class="hero-unit">${useCelsius?'°C':'°F'}</div>
      </div>
      <div class="hero-desc">${WD[c.weather_code]}</div>
      <div class="stats-grid">
        <div class="stat-card"><span>Wind</span><strong>${Math.round(c.wind_speed_10m)} km/h</strong></div>
        <div class="stat-card"><span>Humidity</span><strong>${Math.round(c.relative_humidity_2m)}%</strong></div>
        <div class="stat-card"><span>UV Index</span><strong>${Math.round(c.uv_index)}</strong></div>
      </div>
    </div>
    <div class="ai-section">
      <div class="ai-header">SKYE AI ASSISTANT</div>
      <div id="outfitTxt" class="ai-body">Analyzing weather for the perfect fit...</div>
      <div id="outfitChips" class="chip-row"></div>
    </div>
  `;
}

// --- SEARCH LISTENER ---
document.getElementById('searchInp').addEventListener('keypress', async (e) => {
  if (e.key === 'Enter') {
    const res = await fetch(`/api/weather?type=search&q=${encodeURIComponent(e.target.value)}`);
    const data = await res.json();
    if (data.lat) {
      currentLat = data.lat; currentLon = data.lon; currentCity = data.city;
      refreshWeather();
    }
  }
});

// --- AI OUTFIT LOGIC (Restored) ---
async function loadAI(t, d, w, h, c) {
  const prompt = `Weather in ${c}: ${t}°C, ${d}. Give 2 streetwear outfit sentences and 4 items. JSON format: {"summary":"...", "items":[]}`;
  // You'll insert your specific AI fetch call here like in your original app.js
  console.log("AI Prompt Generated for:", c);
}

function toggleUnit() { useCelsius = !useCelsius; refreshWeather(); }

detectLocation(); // Auto-run on start
