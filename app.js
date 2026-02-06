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
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const rev = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
    settings.geo = {
      lat: pos.coords.latitude,
      lon: pos.coords.longitude,
      tzid: tz,
      display: rev || 'Current location'
    };
    settings.location = settings.geo.display;
    saveSettings();
    refreshData();
  }, () => alert('Unable to detect location. Try manual input.'));
};

async function reverseGeocode(lat, lon) {
  const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=en&format=json`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.results && data.results.length) {
      const r = data.results[0];
      return `${r.name}, ${r.country_code}`;
    }
  } catch (e) {}
  return null;
}

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

let PARSHA_SUMMARIES = {};
let HOLIDAY_SUMMARIES = {};

async function loadSummaries(){
  try {
    const [p,h] = await Promise.all([
      fetch('summaries_parsha.json').then(r=>r.json()),
      fetch('summaries_holidays.json').then(r=>r.json())
    ]);
    PARSHA_SUMMARIES = p;
    HOLIDAY_SUMMARIES = h;
  } catch (e) {
    PARSHA_SUMMARIES = {};
    HOLIDAY_SUMMARIES = {};
  }
}

function describeParsha(name) {
  if (!name) return '—';
  const key = name.split(' ')[0];
  return PARSHA_SUMMARIES[key] || 'Weekly Torah reading and themes for the upcoming Shabbat.';
}

function handleShabbat(data) {
  if (!data || !data.items) return;
  const candle = data.items.find(i => i.category === 'candles');
  const havdalah = data.items.find(i => i.category === 'havdalah');
  const parsha = data.items.find(i => i.category === 'parashat');

  if (candle && havdalah) {
    const now = new Date();
    const candleDate = new Date(candle.date);
    const havdalahDate = new Date(havdalah.date);
    if (now < candleDate) {
      updateCountdown(candle.date, 'Candle lighting');
      setText('next-moment', `Candle lighting • ${candleDate.toLocaleString()}`);
    } else if (now < havdalahDate) {
      updateCountdown(havdalah.date, 'Havdalah');
      setText('next-moment', `Havdalah • ${havdalahDate.toLocaleString()}`);
    } else {
      updateCountdown(candle.date, 'Next candle lighting');
      setText('next-moment', `Next candle lighting • ${candleDate.toLocaleString()}`);
    }
    setText('zmanim', `Candle lighting: ${candleDate.toLocaleTimeString()} • Havdalah: ${havdalahDate.toLocaleTimeString()}`);
  }

  if (parsha) {
    setText('parsha-he', parsha.hebrew || parsha.title);
    setText('parsha-en', parsha.title);
    setText('parsha-desc', describeParsha(parsha.title));
  }
}

function handleHoliday(data) {
  if (!data || !data.items) return;
  const holidays = data.items.filter(i => i.category === 'holiday');
  const next = findNextHoliday(holidays);
  if (!next) return;
  const title = next.title.replace(/\s*\(.*\)/, '');
  setText('holiday-he', next.hebrew || next.title);
  setText('holiday-en', title);
  setText('holiday-desc', HOLIDAY_SUMMARIES[title] || 'A holy day on the Jewish calendar.');
  setText('holiday-date', `Starts: ${new Date(next.date).toLocaleDateString()}`);
  const ms = new Date(next.date) - new Date();
  setText('holiday-countdown', `Countdown: ${formatCountdown(ms)}`);

  renderCalendar(holidays);
}

function renderCalendar(holidays) {
  const monthEl = document.getElementById('calendar-month');
  const yearEl = document.getElementById('calendar-year');
  if (!monthEl || !yearEl) return;
  const now = new Date();
  const inMonth = holidays.filter(h => {
    const d = new Date(h.date);
    return d > now && d < new Date(now.getFullYear(), now.getMonth() + 1, now.getDate() + 30);
  }).slice(0, 6);

  const inYear = holidays.filter(h => new Date(h.date) > now).slice(0, 12);

  const formatItem = (h) => {
    const title = h.title.replace(/\s*\(.*\)/, '');
    const heb = h.hebrew || '';
    const name = heb ? `${heb} — ${title}` : title;
    return `<div class="calendar-item"><span class="calendar-name">${name}</span><span class="calendar-date">${new Date(h.date).toLocaleDateString()}</span></div>`;
  };

  monthEl.innerHTML = inMonth.map(formatItem).join('') || 'No upcoming holidays found.';
  yearEl.innerHTML = inYear.map(formatItem).join('') || 'No upcoming holidays found.';
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
loadSummaries().then(refreshData);

// Update countdown every minute
setInterval(() => {
  const cache = JSON.parse(localStorage.getItem('nefesh_cache') || 'null');
  if (!cache || !cache.shabbat) return;
  const candle = cache.shabbat.items.find(i => i.category === 'candles');
  const havdalah = cache.shabbat.items.find(i => i.category === 'havdalah');
  const now = new Date();
  if (candle && havdalah) {
    const cd = new Date(candle.date);
    const hd = new Date(havdalah.date);
    if (now < cd) updateCountdown(candle.date, 'Candle lighting');
    else if (now < hd) updateCountdown(havdalah.date, 'Havdalah');
    else updateCountdown(candle.date, 'Next candle lighting');
  }
  if (cache.holiday && cache.holiday.items) handleHoliday(cache.holiday);
}, 60000);
