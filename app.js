// ─── WEATHER DATA MAPS ───────────────────────────────────────
const WI={0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',51:'🌦️',53:'🌦️',55:'🌧️',61:'🌧️',63:'🌧️',65:'🌧️',71:'🌨️',73:'🌨️',75:'❄️',80:'🌦️',81:'🌧️',82:'⛈️',95:'⛈️',96:'⛈️',99:'⛈️'};
const WD={0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Foggy',48:'Icy fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',61:'Light rain',63:'Moderate rain',65:'Heavy rain',71:'Light snow',73:'Moderate snow',75:'Heavy snow',80:'Rain showers',81:'Heavy showers',82:'Violent showers',95:'Thunderstorm',96:'Thunderstorm',99:'Thunderstorm'};
const DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DSHORT=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];

let useCelsius=true, currentData=null, currentCity='', currentLat=43.6532, currentLon=-79.3832;
const API = '/api/weather';

const toF = c => Math.round(c * 9/5 + 32);
const fmt = c => useCelsius ? Math.round(c)+'°C' : toF(c)+'°F';
const fmtS = c => useCelsius ? Math.round(c)+'°' : toF(c)+'°';

function toggleUnit(){ 
  useCelsius=!useCelsius; 
  if(currentData) refreshWeather(); 
}

// ─── LOCATION & SEARCH ────────────────────────────────────────
async function detectLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(async (position) => {
      currentLat = position.coords.latitude;
      currentLon = position.coords.longitude;
      
      const res = await fetch(`${API}?type=search&q=${currentLat},${currentLon}`);
      const info = await res.json();
      currentCity = info.city || "Current Location";
      
      refreshWeather();
    }, () => {
      alert("Please enable location access for precise weather.");
    }, { enableHighAccuracy: true });
  }
}

async function refreshWeather() {
  const [forecastRes, alertRes] = await Promise.all([
    fetch(`${API}?type=forecast&lat=${currentLat}&lon=${currentLon}`),
    fetch(`${API}?type=alerts&lat=${currentLat}&lon=${currentLon}`)
  ]);
  
  currentData = await forecastRes.json();
  const alertData = await alertRes.json();
  
  render(currentData, currentCity, alertData.alerts);
}

// ─── RENDER ──────────────────────────────────────────────────
function render(d, city, alerts) {
  const c = d.current;
  const banner = document.getElementById('alertBanner');
  
  // Update Alert Banner
  if (alerts && alerts.length > 0) {
    banner.innerHTML = `<span>⚠️ ${alerts[0].title}</span>`;
    banner.style.display = 'flex';
  } else {
    banner.style.display = 'none';
  }

  document.getElementById('mainContent').innerHTML = `
    <div class="hero">
      <div class="hero-city">${city}</div>
      <div class="hero-main">
        <div class="hero-temp-wrap">
          <div class="hero-temp">${useCelsius ? Math.round(c.temperature_2m) : toF(c.temperature_2m)}</div>
          <div class="hero-unit">${useCelsius ? '°C' : '°F'}</div>
        </div>
        <div class="hero-desc">${WD[c.weather_code]}</div>
      </div>
      <div class="hero-stats">
        <div class="hs"><div class="hs-l">Wind</div><div class="hs-v">${Math.round(c.wind_speed_10m)} km/h</div></div>
        <div class="hs"><div class="hs-l">Humidity</div><div class="hs-v">${Math.round(c.relative_humidity_2m)}%</div></div>
      </div>
    </div>
  `;
}

// Init
detectLocation();
