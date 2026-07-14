const DEFAULT_SETTINGS = {
    wallpaperInterval: 300000,
    clockFormat: '12',
    clockStyle: 'digital',
    clockFont: 'grotesk',
    tempUnits: 'c',
    pomodoroWork: 25,
    pomodoroBreak: 5,
    pomodoroLongBreak: 15
};

const STORAGE_KEY = 'anical-settings';

const AppSettings = Object.assign({}, DEFAULT_SETTINGS);

function loadAppSettings() {

    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) return;

    try {
        Object.assign(AppSettings, JSON.parse(saved));
    } catch (err) {
        console.warn('anical: could not parse saved settings, falling back to defaults');
    }
}

function saveAppSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(AppSettings));
}

function bindSetting(selectId, key, transform) {

    const el = document.getElementById(selectId);

    if (!el) return;

    el.value = AppSettings[key];

    el.addEventListener('change', () => {

        AppSettings[key] = transform ? transform(el.value) : el.value;
        saveAppSettings();

        document.dispatchEvent(new CustomEvent('settings-changed', { detail: { key } }));
    });
}

loadAppSettings();

bindSetting('setting-interval', 'wallpaperInterval', Number);
bindSetting('setting-clock-style', 'clockStyle');
bindSetting('setting-clock-font', 'clockFont');
bindSetting('setting-format', 'clockFormat');
bindSetting('setting-units', 'tempUnits');
bindSetting('setting-pomo-work', 'pomodoroWork', Number);
bindSetting('setting-pomo-break', 'pomodoroBreak', Number);

document.getElementById('settings-close').addEventListener('click', () => {
    document.getElementById('settings-panel').classList.remove('open');
});

/* ---------- clock.js ---------- */

// Handles both clock faces (digital text and the analog SVG dial),
// the date line beneath it, and the typeface swap for the digital face.

const clockDigital = document.getElementById('clock-digital');
const clockAnalog = document.getElementById('clock-analog');
const dateElement = document.getElementById('date');

const dialTicks = document.getElementById('dial-ticks');
const handHour = document.getElementById('hand-hour');
const handMinute = document.getElementById('hand-minute');
const handSecond = document.getElementById('hand-second');

function buildDialTicks() {

    for (let i = 0; i < 12; i++) {

        const angle = i * 30;
        const isMajor = i % 3 === 0;
        const outer = isMajor ? 82 : 86;

        const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        tick.setAttribute('x1', '100');
        tick.setAttribute('y1', String(100 - outer));
        tick.setAttribute('x2', '100');
        tick.setAttribute('y2', String(100 - 92));
        tick.setAttribute('class', isMajor ? 'dial-tick major' : 'dial-tick');
        tick.setAttribute('transform', `rotate(${angle} 100 100)`);

        dialTicks.appendChild(tick);
    }
}

function applyClockStyle() {

    const analog = AppSettings.clockStyle === 'analog';

    clockAnalog.style.display = analog ? 'block' : 'none';
    clockDigital.style.display = analog ? 'none' : 'block';
}

function applyClockFont() {

    clockDigital.classList.remove('clock-font-grotesk', 'clock-font-mono', 'clock-font-serif');
    clockDigital.classList.add(`clock-font-${AppSettings.clockFont}`);
}

function renderDigitalClock(now) {

    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');

    if (AppSettings.clockFormat === '24') {
        clockDigital.textContent = `${String(hours).padStart(2, '0')}:${minutes}`;
        return;
    }

    const suffix = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;

    clockDigital.textContent = `${hours}:${minutes} ${suffix}`;
}

function renderAnalogClock(now) {

    const hours = now.getHours() % 12;
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    const hourDeg = (hours + minutes / 60) * 30;
    const minuteDeg = (minutes + seconds / 60) * 6;
    const secondDeg = seconds * 6;

    handHour.setAttribute('transform', `rotate(${hourDeg} 100 100)`);
    handMinute.setAttribute('transform', `rotate(${minuteDeg} 100 100)`);
    handSecond.setAttribute('transform', `rotate(${secondDeg} 100 100)`);
}

function tickClock() {

    const now = new Date();

    renderDigitalClock(now);
    renderAnalogClock(now);

    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateElement.textContent = now.toLocaleDateString(undefined, dateOptions);
}

buildDialTicks();
applyClockStyle();
applyClockFont();
tickClock();
setInterval(tickClock, 1000);

document.addEventListener('settings-changed', (e) => {

    if (e.detail.key === 'clockFormat') tickClock();
    if (e.detail.key === 'clockStyle') applyClockStyle();
    if (e.detail.key === 'clockFont') applyClockFont();
});

/* ---------- wallpaper.js ---------- */

// Cross-fades between the two wallpaper <img> elements on a timer,
// and re-rolls the photo whenever the window is resized.

const wallpaperA = document.getElementById('wallpaper');
const wallpaperB = document.getElementById('wallpaper2');

let showingA = true;
let wallpaperTimer = null;

function changeWallpaper() {

    const uniqueTime = new Date().getTime();
    const width = window.innerWidth;
    const height = window.innerHeight;
    const url = `https://picsum.photos/${width}/${height}?random=${uniqueTime}`;

    const incoming = showingA ? wallpaperB : wallpaperA;
    const outgoing = showingA ? wallpaperA : wallpaperB;

    incoming.onload = () => {
        incoming.classList.add('active');
        outgoing.classList.remove('active');
        showingA = !showingA;
    };

    incoming.src = url;
}

function restartWallpaperTimer() {

    if (wallpaperTimer) {
        clearInterval(wallpaperTimer);
        wallpaperTimer = null;
    }

    if (AppSettings.wallpaperInterval > 0) {
        wallpaperTimer = setInterval(changeWallpaper, AppSettings.wallpaperInterval);
    }
}

restartWallpaperTimer();

let resizeTimer;

window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(changeWallpaper, 500);
});

document.addEventListener('settings-changed', (e) => {

    if (e.detail.key === 'wallpaperInterval') restartWallpaperTimer();
});

/* ---------- weather.js ---------- */

// Current conditions (shown under the clock) and the 5-day outlook
// (shown in the forecast panel). Both come from a single Open-Meteo
// request so the location lookup only happens once per refresh.

const weatherIconUse = document.getElementById('weather-icon-use');
const weatherTemp = document.getElementById('weather-temp');
const forecastList = document.getElementById('forecast-list');

let lastWeather = null;
let lastForecast = null;

function weatherIconId(code) {

    if (code === 0) return 'icon-weather-clear';
    if (code > 0 && code < 4) return 'icon-forecast';
    if (code === 45 || code === 48) return 'icon-weather-fog';
    if (code >= 51 && code <= 67) return 'icon-weather-rain';
    if (code >= 71 && code <= 77) return 'icon-weather-snow';
    if (code >= 80 && code <= 82) return 'icon-weather-rain';
    if (code >= 95) return 'icon-weather-storm';

    return 'icon-weather-unknown';
}

function formatTemp(celsius) {

    const value = AppSettings.tempUnits === 'f' ? (celsius * 9 / 5 + 32) : celsius;
    const unit = AppSettings.tempUnits === 'f' ? '°F' : '°C';

    return `${Math.round(value)}${unit}`;
}

function renderCurrentWeather() {

    if (!lastWeather) return;

    weatherIconUse.setAttribute('href', `#${weatherIconId(lastWeather.code)}`);
    weatherTemp.textContent = formatTemp(lastWeather.temp);
}

function renderForecast() {

    if (!lastForecast) return;

    forecastList.innerHTML = '';

    lastForecast.forEach((day) => {

        const row = document.createElement('div');
        row.className = 'forecast-day';

        const label = document.createElement('span');
        label.className = 'forecast-day-label';
        label.textContent = day.label;

        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        icon.setAttribute('class', 'forecast-day-icon');
        const iconUse = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        iconUse.setAttribute('href', `#${weatherIconId(day.code)}`);
        icon.appendChild(iconUse);

        const temps = document.createElement('span');
        temps.className = 'forecast-day-temps';
        temps.innerHTML = `<span class="hi">${formatTemp(day.max)}</span><span class="lo">${formatTemp(day.min)}</span>`;

        row.append(label, icon, temps);
        forecastList.appendChild(row);
    });
}

async function fetchWeather(lat, lon) {

    try {

        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;
        const response = await fetch(url);
        const data = await response.json();

        lastWeather = { temp: data.current.temperature_2m, code: data.current.weather_code };

        lastForecast = data.daily.time.slice(0, 5).map((iso, i) => ({
            label: i === 0 ? 'Today' : new Date(iso).toLocaleDateString(undefined, { weekday: 'short' }),
            code: data.daily.weather_code[i],
            max: data.daily.temperature_2m_max[i],
            min: data.daily.temperature_2m_min[i]
        }));

        renderCurrentWeather();
        renderForecast();

    } catch (error) {

        weatherTemp.textContent = 'Weather unavailable';
        forecastList.innerHTML = '<p class="panel-empty">Forecast unavailable</p>';
    }
}

function loadLocationAndWeather() {

    if (!navigator.geolocation) {
        fetchWeather(13.43, 79.55);
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => fetchWeather(position.coords.latitude, position.coords.longitude),
        () => fetchWeather(13.43, 79.55)
    );
}

loadLocationAndWeather();
setInterval(loadLocationAndWeather, 1800000);

document.addEventListener('settings-changed', (e) => {

    if (e.detail.key !== 'tempUnits') return;

    renderCurrentWeather();
    renderForecast();
});

/* ---------- calendar.js ---------- */

// A plain month-grid calendar. No events or data source, just a
// glanceable "what day is it / what's coming up this week" view.

const calMonthLabel = document.getElementById('cal-month-label');
const calGrid = document.getElementById('cal-grid');
const calPrev = document.getElementById('cal-prev');
const calNext = document.getElementById('cal-next');

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const calCursor = new Date();
calCursor.setDate(1);

function renderCalendar() {

    calMonthLabel.textContent = calCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    calGrid.innerHTML = '';

    WEEKDAY_LABELS.forEach((label) => {
        const cell = document.createElement('div');
        cell.className = 'cal-weekday';
        cell.textContent = label;
        calGrid.appendChild(cell);
    });

    const firstOfMonth = new Date(calCursor.getFullYear(), calCursor.getMonth(), 1);
    const startOffset = firstOfMonth.getDay();
    const daysInMonth = new Date(calCursor.getFullYear(), calCursor.getMonth() + 1, 0).getDate();
    const today = new Date();

    for (let i = 0; i < startOffset; i++) {
        calGrid.appendChild(document.createElement('div'));
    }

    for (let day = 1; day <= daysInMonth; day++) {

        const cell = document.createElement('div');
        cell.className = 'cal-day';
        cell.textContent = day;

        const isToday = today.getFullYear() === calCursor.getFullYear()
            && today.getMonth() === calCursor.getMonth()
            && today.getDate() === day;

        if (isToday) cell.classList.add('today');

        calGrid.appendChild(cell);
    }
}

calPrev.addEventListener('click', () => {
    calCursor.setMonth(calCursor.getMonth() - 1);
    renderCalendar();
});

calNext.addEventListener('click', () => {
    calCursor.setMonth(calCursor.getMonth() + 1);
    renderCalendar();
});

renderCalendar();

/* ---------- pomodoro.js ---------- */

// Focus timer. Cycles work -> short break -> work -> ... -> long break
// every 4th session. The ring is a single SVG circle whose dash offset
// we animate instead of redrawing anything.

const pomoTimeLabel = document.getElementById('pomo-time');
const pomoModeLabel = document.getElementById('pomo-mode');
const pomoStartBtn = document.getElementById('pomo-start');
const pomoResetBtn = document.getElementById('pomo-reset');
const pomoSessionsLabel = document.getElementById('pomo-sessions');
const pomoRing = document.getElementById('pomo-ring');

const RING_RADIUS = 54;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

let pomoMode = 'work';
let pomoSecondsLeft = AppSettings.pomodoroWork * 60;
let pomoTotalSeconds = pomoSecondsLeft;
let pomoRunning = false;
let pomoInterval = null;
let sessionsCompleted = 0;

pomoRing.style.strokeDasharray = String(RING_CIRCUMFERENCE);

function pomoDurationFor(mode) {

    if (mode === 'work') return AppSettings.pomodoroWork * 60;
    if (mode === 'break') return AppSettings.pomodoroBreak * 60;

    return AppSettings.pomodoroLongBreak * 60;
}

function renderPomodoro() {

    const minutes = String(Math.floor(pomoSecondsLeft / 60)).padStart(2, '0');
    const seconds = String(pomoSecondsLeft % 60).padStart(2, '0');

    pomoTimeLabel.textContent = `${minutes}:${seconds}`;
    pomoModeLabel.textContent = pomoMode === 'work' ? 'Focus' : (pomoMode === 'break' ? 'Short break' : 'Long break');
    pomoSessionsLabel.textContent = `Sessions: ${sessionsCompleted}`;

    const progress = 1 - (pomoSecondsLeft / pomoTotalSeconds);
    pomoRing.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - progress));
}

function playChime() {

    try {

        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.frequency.value = 660;
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);

        osc.start();
        osc.stop(ctx.currentTime + 0.8);

    } catch (err) {
        // no audio output available, fail quietly
    }
}

function advancePomodoroMode() {

    if (pomoMode === 'work') {
        sessionsCompleted++;
        pomoMode = (sessionsCompleted % 4 === 0) ? 'longBreak' : 'break';
    } else {
        pomoMode = 'work';
    }

    pomoSecondsLeft = pomoDurationFor(pomoMode);
    pomoTotalSeconds = pomoSecondsLeft;
}

function tickPomodoro() {

    pomoSecondsLeft--;

    if (pomoSecondsLeft <= 0) {
        playChime();
        advancePomodoroMode();
    }

    renderPomodoro();
}

function togglePomodoro() {

    pomoRunning = !pomoRunning;
    pomoStartBtn.textContent = pomoRunning ? 'Pause' : 'Start';

    if (pomoRunning) {
        pomoInterval = setInterval(tickPomodoro, 1000);
    } else {
        clearInterval(pomoInterval);
    }
}

function resetPomodoro() {

    pomoRunning = false;
    clearInterval(pomoInterval);

    pomoStartBtn.textContent = 'Start';
    pomoMode = 'work';
    pomoSecondsLeft = pomoDurationFor('work');
    pomoTotalSeconds = pomoSecondsLeft;

    renderPomodoro();
}

pomoStartBtn.addEventListener('click', togglePomodoro);
pomoResetBtn.addEventListener('click', resetPomodoro);

renderPomodoro();

document.addEventListener('settings-changed', (e) => {

    if (e.detail.key !== 'pomodoroWork' && e.detail.key !== 'pomodoroBreak') return;
    if (pomoRunning) return;

    resetPomodoro();
});

/* ---------- battery.js ---------- */

// Small always-on badge in the corner. Hides itself on browsers that
// don't expose the Battery Status API (Firefox, Safari) rather than
// showing a broken "N/A". The meter itself is a real SVG rect whose
// width tracks the charge level, not a swapped-out icon.

const batteryBadge = document.getElementById('battery-badge');
const batteryFill = document.getElementById('battery-fill');
const batteryBolt = document.getElementById('battery-bolt');
const batteryLabel = document.getElementById('battery-label');

const FILL_MAX_WIDTH = 17;

async function initBattery() {

    if (!('getBattery' in navigator)) {
        batteryBadge.style.display = 'none';
        return;
    }

    try {

        const battery = await navigator.getBattery();

        const render = () => {

            const percent = Math.round(battery.level * 100);

            batteryFill.setAttribute('width', String((percent / 100) * FILL_MAX_WIDTH));
            batteryBolt.style.display = battery.charging ? 'block' : 'none';
            batteryLabel.textContent = `${percent}%`;
        };

        render();
        battery.addEventListener('levelchange', render);
        battery.addEventListener('chargingchange', render);

    } catch (err) {
        batteryBadge.style.display = 'none';
    }
}

initBattery();

/* ---------- dock.js ---------- */

// Every panel shares the same open/close behaviour, so it's driven
// generically off the data-panel attribute rather than one listener
// per button.

const dockButtons = document.querySelectorAll('.dock-btn');
const panels = document.querySelectorAll('.panel');

function closeAllPanels(except) {

    panels.forEach((panel) => {
        if (panel !== except) panel.classList.remove('open');
    });

    dockButtons.forEach((btn) => {
        if (btn.dataset.panel !== except?.id) btn.classList.remove('active');
    });
}

dockButtons.forEach((btn) => {

    btn.addEventListener('click', (e) => {

        e.stopPropagation();

        const panel = document.getElementById(btn.dataset.panel);
        const wasOpen = panel.classList.contains('open');

        closeAllPanels(null);

        panel.classList.toggle('open', !wasOpen);
        btn.classList.toggle('active', !wasOpen);
    });
});

document.addEventListener('click', (e) => {

    if (e.target.closest('.panel') || e.target.closest('.dock-btn')) return;

    closeAllPanels(null);
});

/* ---------- sw-register.js ---------- */

if ('serviceWorker' in navigator) {

    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js');
    });
}