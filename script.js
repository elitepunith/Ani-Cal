const wallpaperA = document.getElementById('wallpaper');
const wallpaperB = document.getElementById('wallpaper2');

const clockElement = document.getElementById('clock');
const dateElement = document.getElementById('date');
const weatherElement = document.getElementById('weather');

const settingsToggle = document.getElementById('settings-toggle');
const settingsPanel = document.getElementById('settings-panel');
const settingsClose = document.getElementById('settings-close');

const intervalSelect = document.getElementById('setting-interval');
const formatSelect = document.getElementById('setting-format');
const unitsSelect = document.getElementById('setting-units');

const settings = {
    interval: 300000,
    format: '12',
    units: 'c'
};

function loadSettings() {

    const saved = localStorage.getItem('anical-settings');

    if (saved) {
        Object.assign(settings, JSON.parse(saved));
    }

    intervalSelect.value = settings.interval;
    formatSelect.value = settings.format;
    unitsSelect.value = settings.units;
}

function saveSettings() {
    localStorage.setItem('anical-settings', JSON.stringify(settings));
}

loadSettings();


settingsToggle.addEventListener('click', () => {
    settingsPanel.classList.toggle('open');
});

settingsClose.addEventListener('click', () => {
    settingsPanel.classList.remove('open');
});

intervalSelect.addEventListener('change', () => {
    settings.interval = Number(intervalSelect.value);
    saveSettings();
    restartWallpaperTimer();
});

formatSelect.addEventListener('change', () => {
    settings.format = formatSelect.value;
    saveSettings();
    updateClock();
});

unitsSelect.addEventListener('change', () => {
    settings.units = unitsSelect.value;
    saveSettings();
    if (lastWeather) {
        renderWeather(lastWeather.temp, lastWeather.code);
    }
});


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

    if (settings.interval > 0) {
        wallpaperTimer = setInterval(changeWallpaper, settings.interval);
    }
}

restartWallpaperTimer();

let resizeTimer;

window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(changeWallpaper, 500);
});


function updateClock() {

    const now = new Date();

    let hours = now.getHours();
    let minutes = now.getMinutes();
    minutes = minutes < 10 ? '0' + minutes : minutes;

    if (settings.format === '24') {
        hours = hours < 10 ? '0' + hours : hours;
        clockElement.textContent = `${hours}:${minutes}`;
    } else {
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        clockElement.textContent = `${hours}:${minutes} ${ampm}`;
    }

    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateElement.textContent = now.toLocaleDateString(undefined, dateOptions);
}

updateClock();
setInterval(updateClock, 1000);

function getWeatherEmoji(code) {

    if (code === 0) return '☀️';
    if (code > 0 && code < 4) return '⛅';
    if (code === 45 || code === 48) return '🌫️';
    if (code >= 51 && code <= 67) return '🌧️';
    if (code >= 71 && code <= 77) return '❄️';
    if (code >= 95) return '🌩️';
    return '🌡️';
}

let lastWeather = null;

function renderWeather(tempC, code) {

    const emoji = getWeatherEmoji(code);
    const temp = settings.units === 'f' ? Math.round(tempC * 9 / 5 + 32) : Math.round(tempC);
    const unit = settings.units === 'f' ? '°F' : '°C';

    weatherElement.textContent = `${emoji} ${temp}${unit}`;
}

async function fetchWeather(lat, lon) {

    try {

        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`);
        const data = await response.json();

        lastWeather = { temp: data.current.temperature_2m, code: data.current.weather_code };
        renderWeather(lastWeather.temp, lastWeather.code);

    } catch (error) {

        weatherElement.textContent = "Weather unavailable";
    }
}

function loadLocationAndWeather() {

    if (navigator.geolocation) {

        navigator.geolocation.getCurrentPosition(
            (position) => {
                fetchWeather(position.coords.latitude, position.coords.longitude);
            },
            () => {
                fetchWeather(13.43, 79.55);
            }
        );
    } else {
        fetchWeather(13.43, 79.55);
    }
}

loadLocationAndWeather();
setInterval(loadLocationAndWeather, 1800000);

if ('serviceWorker' in navigator) {

    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js');
    });
}
