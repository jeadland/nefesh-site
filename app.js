const views = document.querySelectorAll('.view');
const navLinks = document.querySelectorAll('.nav-link');
const updatedEl = document.getElementById('updated');

const settings = {
  diaspora: true,
  candle: 18,
  havdalah: 72,
  location: null,
  geo: null,
};

function loadSettings() {
  const saved = JSON.parse(localStorage.getItem('nefesh_settings') || '{}');
  Object.assign(settings, saved);
  updateSettingsUI();
}

function saveSettings() {
  localStorage.setItem('nefesh_settings', JSON.stringify(settings));
}

function updateSettingsUI() {
  document.getElementById('diaspora').classList.toggle('active', settings.diaspora);
  document.getElementById('israel').classList.toggle('active', !settings.diaspora);
  document.getElementById('candle-setting').value = settings.candle;
  document.getElementById('havdalah-setting').value = settings.havdalah;
  document.getElementById('location-input').value = settings.location || '';
}

function switchView(viewId) {
  views.forEach(v => v.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
  navLinks.forEach(l => l.classList.toggle('active', l.dataset.view === viewId));
}

navLinks.forEach(link => link.addEventListener('click', () => switchView(link.dataset.view)));

// Settings handlers

document.getElementById('diaspora').onclick = () => { settings.diaspora = true; saveSettings(); updateSettingsUI(); refreshData(); };
document.getElementById('israel').onclick = () => { settings.diaspora = false; saveSettings(); updateSettingsUI(); refreshData(); };
document.getElementById('candle-setting').onchange = e => { settings.candle = parseInt(e.target.value, 10); saveSettings(); refreshData(); };
document.getElementById('havdalah-setting').onchange = e => { settings.havdalah = parseInt(e.target.value, 10); saveSettings(); refreshData(); };

document.getElementById('set-location').onclick = async () => {
  const loc = document.getElementById('location-input').value.trim();
  if (!loc) return;
  const geo = await geocodeLocation(loc);
  if (geo) {
    settings.location = geo.display;
    settings.geo = geo;
    saveSettings();
    refreshData();
  }
};

document.getElementById('detect-location').onclick = () => {
  if (!navigator.geolocation) return alert('Geolocation not supported');
  navigator.geolocation.getCurrentPosition(async (pos) => {
    settings.geo = {
      lat: pos.coords.latitude,
      lon: pos.coords.longitude,
      tzid: Intl.DateTimeFormat().resolvedOptions().timeZone,
      display: 'Current location'
    };
    settings.location = 'Current location';
    saveSettings();
    refreshData();
  }, () => alert('Unable to detect location. Try manual input.'));
};

async function geocodeLocation(query) {
  // Use Open-Meteo geocoding (free, no key)
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.results || !data.results.length) {
    alert('Location not found. Try city or ZIP.');
    return null;
  }
  const r = data.results[0];
  return {
    lat: r.latitude,
    lon: r.longitude,
    tzid: r.timezone,
    display: `${r.name}, ${r.country_code}`
  };
}

function setText(id, text) { document.getElementById(id).textContent = text; }

function formatCountdown(ms) {
  if (ms < 0) return '—';
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

async function fetchHebcal() {
  const geo = settings.geo;
  if (!geo) return null;
  const base = 'https://www.hebcal.com/shabbat?cfg=json';
  const url = `${base}&latitude=${geo.lat}&longitude=${geo.lon}&tzid=${geo.tzid}&b=${settings.candle}&m=${settings.havdalah}`;
  const res = await fetch(url);
  return res.json();
}

async function fetchHoliday() {
  const geo = settings.geo;
  if (!geo) return null;
  const url = `https://www.hebcal.com/hebcal?cfg=json&v=1&maj=on&min=on&mod=on&ss=on&yt=H&geo=pos&latitude=${geo.lat}&longitude=${geo.lon}&tzid=${geo.tzid}&lg=he-x-NoNikud`;
  const res = await fetch(url);
  return res.json();
}

function updateCountdown(nextTime, label) {
  const now = new Date();
  const target = new Date(nextTime);
  const ms = target - now;
  setText('countdown', formatCountdown(ms));
  setText('next-moment', label + ' • ' + target.toLocaleString());
}

function findNextHoliday(items) {
  const now = Date.now();
  for (const item of items) {
    const t = new Date(item.date).getTime();
    if (t > now) return item;
  }
  return null;
}

function describeParsha(name) {
  if (!name) return '—';
  return 'Weekly Torah reading and themes for the upcoming Shabbat.';
}

function handleShabbat(data) {
  if (!data || !data.items) return;
  const candle = data.items.find(i => i.category === 'candles');
  const havdalah = data.items.find(i => i.category === 'havdalah');
  const parsha = data.items.find(i => i.category === 'parashat');

  if (candle && havdalah) {
    const now = new Date();
    const nextMoment = new Date(candle.date) > now ? candle : { ...candle, date: candle.date };
    updateCountdown(nextMoment.date, 'Candle lighting');
    setText('zmanim', `Candle lighting: ${new Date(candle.date).toLocaleTimeString()} • Havdalah: ${new Date(havdalah.date).toLocaleTimeString()}`);
  }

  if (parsha) {
    setText('parsha', parsha.hebrew ? `${parsha.hebrew} (${parsha.title})` : parsha.title);
    setText('parsha-desc', describeParsha(parsha.title));
  }
}

function handleHoliday(data) {
  if (!data || !data.items) return;
  const next = findNextHoliday(data.items.filter(i => i.category === 'holiday'));
  if (!next) return;
  setText('holiday', next.hebrew ? `${next.hebrew} (${next.title})` : next.title);
  setText('holiday-desc', 'A holy day on the Jewish calendar.');
  setText('holiday-date', `Starts: ${new Date(next.date).toLocaleDateString()}`);
  const ms = new Date(next.date) - new Date();
  setText('holiday-countdown', `Countdown: ${formatCountdown(ms)}`);
}

async function refreshData() {
  if (!settings.geo) {
    setText('location', 'Set your location in Settings');
    return;
  }
  setText('location', settings.location);
  const shabbat = await fetchHebcal();
  const holiday = await fetchHoliday();
  handleShabbat(shabbat);
  handleHoliday(holiday);
  const now = new Date();
  updatedEl.textContent = `Updated ${now.toLocaleTimeString()}`;
  localStorage.setItem('nefesh_cache', JSON.stringify({ shabbat, holiday, updated: now.toISOString() }));
}

function loadCache() {
  const cache = JSON.parse(localStorage.getItem('nefesh_cache') || 'null');
  if (!cache) return;
  handleShabbat(cache.shabbat);
  handleHoliday(cache.holiday);
  updatedEl.textContent = `Updated ${new Date(cache.updated).toLocaleTimeString()}`;
}

loadSettings();
loadCache();
refreshData();

// Update countdown every minute
setInterval(() => {
  const cache = JSON.parse(localStorage.getItem('nefesh_cache') || 'null');
  if (!cache || !cache.shabbat) return;
  const candle = cache.shabbat.items.find(i => i.category === 'candles');
  if (candle) updateCountdown(candle.date, 'Candle lighting');
}, 60000);
