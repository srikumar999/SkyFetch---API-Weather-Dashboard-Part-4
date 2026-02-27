/* ===========================
   SkyFetch • Part 4
   OOP + Forecast + localStorage
   =========================== */

(function () {
  "use strict";

  const API_KEY = "YOUR_OPENWEATHER_API_KEY";
  const BASE_URL = "https://api.openweathermap.org/data/2.5";

  function WeatherApp() {
    // Form / input
    this.form = document.getElementById("searchForm");
    this.cityInput = document.getElementById("cityInput");
    this.searchBtn = document.getElementById("searchBtn");

    // UI
    this.statusText = document.getElementById("statusText");
    this.loader = document.getElementById("loader");

    this.welcome = document.getElementById("welcome");
    this.errorBox = document.getElementById("errorBox");

    this.currentWeatherEl = document.getElementById("currentWeather");
    this.cityNameEl = document.getElementById("cityName");
    this.dateTextEl = document.getElementById("dateText");
    this.descTextEl = document.getElementById("descText");
    this.weatherIconEl = document.getElementById("weatherIcon");
    this.tempTextEl = document.getElementById("tempText");

    this.metaRow = document.getElementById("metaRow");
    this.humidityTextEl = document.getElementById("humidityText");
    this.windTextEl = document.getElementById("windText");
    this.feelsTextEl = document.getElementById("feelsText");

    this.forecastGrid = document.getElementById("forecastGrid");

    // Recent searches
    this.recentContainer = document.getElementById("recentSearches");
    this.clearHistoryBtn = document.getElementById("clearHistoryBtn");

    // Storage keys
    this.RECENT_KEY = "recentSearches";
    this.LAST_CITY_KEY = "lastCity";

    // State
    this.recentSearches = [];

    this.init();
  }

  WeatherApp.prototype.init = function () {
    this.form.addEventListener("submit", (e) => {
      e.preventDefault();
      const city = this.cityInput.value.trim();
      if (!city) return;
      this.getWeather(city);
    });

    this.clearHistoryBtn.addEventListener("click", () => {
      this.clearHistory();
    });

    // Load saved searches
    this.loadRecentSearches();
    this.displayRecentSearches();

    // Auto-load last city
    this.loadLastCity();
  };

  WeatherApp.prototype.setLoading = function (isLoading) {
    if (isLoading) {
      this.loader.classList.remove("hidden");
      this.statusText.textContent = "Fetching weather...";
      this.searchBtn.disabled = true;
      this.cityInput.disabled = true;
    } else {
      this.loader.classList.add("hidden");
      this.statusText.textContent = "Ready.";
      this.searchBtn.disabled = false;
      this.cityInput.disabled = false;
    }
  };

  WeatherApp.prototype.showError = function (message) {
    this.errorBox.textContent = message;
    this.errorBox.classList.remove("hidden");
  };

  WeatherApp.prototype.clearError = function () {
    this.errorBox.textContent = "";
    this.errorBox.classList.add("hidden");
  };

  WeatherApp.prototype.toTitleCase = function (str) {
    return str
      .toLowerCase()
      .split(" ")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  };

  WeatherApp.prototype.formatDate = function (date) {
    const d = new Date(date);
    return d.toLocaleString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  WeatherApp.prototype.iconUrl = function (iconCode) {
    return `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
  };

  WeatherApp.prototype.fetchJson = async function (url) {
    const res = await fetch(url);
    if (!res.ok) {
      // Try to extract API error message if present
      let msg = `Request failed (${res.status})`;
      try {
        const data = await res.json();
        if (data && data.message) msg = data.message;
      } catch (_) {}
      throw new Error(msg);
    }
    return res.json();
  };

  WeatherApp.prototype.getWeather = async function (city) {
    if (!API_KEY || API_KEY === "YOUR_OPENWEATHER_API_KEY") {
      this.showError("Please set your OpenWeatherMap API key in app.js");
      return;
    }

    const cleanedCity = this.toTitleCase(city);
    this.clearError();
    this.setLoading(true);

    try {
      // Current + Forecast in parallel
      const currentUrl = `${BASE_URL}/weather?q=${encodeURIComponent(
        cleanedCity
      )}&appid=${API_KEY}&units=metric`;

      const forecastUrl = `${BASE_URL}/forecast?q=${encodeURIComponent(
        cleanedCity
      )}&appid=${API_KEY}&units=metric`;

      const [currentData, forecastData] = await Promise.all([
        this.fetchJson(currentUrl),
        this.fetchJson(forecastUrl),
      ]);

      this.renderCurrent(currentData);
      this.renderForecast(forecastData);

      // Hide welcome after successful fetch
      this.welcome.classList.add("hidden");

      // Save searches ONLY after success
      this.saveRecentSearch(cleanedCity);
      localStorage.setItem(this.LAST_CITY_KEY, cleanedCity);

      // Clear input nicely
      this.cityInput.value = "";

      this.statusText.textContent = "Updated successfully.";
    } catch (err) {
      const msg =
        typeof err?.message === "string" && err.message.trim()
          ? err.message
          : "Something went wrong. Please try again.";
      this.showError(
        `Could not fetch weather for "${this.toTitleCase(city)}". ${msg}`
      );
      this.statusText.textContent = "Error fetching weather.";
    } finally {
      this.setLoading(false);
    }
  };

  WeatherApp.prototype.renderCurrent = function (data) {
    // Defensive checks
    if (!data || !data.weather || !data.weather[0] || !data.main) {
      this.showError("Unexpected response from weather API.");
      return;
    }

    const weather = data.weather[0];
    const cityName = `${data.name}${data.sys?.country ? ", " + data.sys.country : ""}`;

    this.cityNameEl.textContent = cityName;
    this.dateTextEl.textContent = this.formatDate(Date.now());
    this.descTextEl.textContent = this.toTitleCase(weather.description || "—");

    this.weatherIconEl.src = this.iconUrl(weather.icon);
    this.weatherIconEl.alt = weather.main || "Weather";

    this.tempTextEl.textContent = `${Math.round(data.main.temp)}°C`;

    // Meta
    this.humidityTextEl.textContent = `${data.main.humidity}%`;
    this.windTextEl.textContent = `${Math.round(data.wind?.speed ?? 0)} m/s`;
    this.feelsTextEl.textContent = `${Math.round(data.main.feels_like)}°C`;

    this.currentWeatherEl.classList.remove("hidden");
    this.metaRow.classList.remove("hidden");
  };

  WeatherApp.prototype.pickDailyForecasts = function (list) {
    // OpenWeather forecast returns 3-hour steps for ~5 days.
    // Strategy: pick items closest to 12:00 each day.
    const byDay = new Map();

    for (const item of list) {
      const dt = new Date(item.dt * 1000);
      const dayKey = dt.toISOString().slice(0, 10); // YYYY-MM-DD
      const hour = dt.getHours();

      if (!byDay.has(dayKey)) {
        byDay.set(dayKey, item);
      } else {
        const existing = byDay.get(dayKey);
        const existingHour = new Date(existing.dt * 1000).getHours();

        // Choose the forecast closer to 12:00
        if (Math.abs(hour - 12) < Math.abs(existingHour - 12)) {
          byDay.set(dayKey, item);
        }
      }
    }

    // Convert to array sorted by date, limit 5 days
    return Array.from(byDay.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(0, 5)
      .map((entry) => entry[1]);
  };

  WeatherApp.prototype.renderForecast = function (forecastData) {
    this.forecastGrid.innerHTML = "";

    if (!forecastData || !Array.isArray(forecastData.list)) {
      this.showError("Unexpected response from forecast API.");
      return;
    }

    const daily = this.pickDailyForecasts(forecastData.list);

    daily.forEach((item) => {
      const dt = new Date(item.dt * 1000);
      const day = dt.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      });

      const icon = item.weather?.[0]?.icon;
      const desc = item.weather?.[0]?.description || "—";
      const temp = item.main?.temp;

      const card = document.createElement("div");
      card.className = "fcard";

      const left = document.createElement("div");
      left.className = "f-left";

      const dayEl = document.createElement("div");
      dayEl.className = "f-day";
      dayEl.textContent = day;

      const descEl = document.createElement("div");
      descEl.className = "f-desc";
      descEl.textContent = this.toTitleCase(desc);

      left.appendChild(dayEl);
      left.appendChild(descEl);

      const right = document.createElement("div");
      right.style.display = "grid";
      right.style.justifyItems = "end";
      right.style.gap = "4px";

      const img = document.createElement("img");
      img.className = "icon";
      img.style.width = "48px";
      img.style.height = "48px";
      img.src = icon ? this.iconUrl(icon) : "";
      img.alt = "Forecast icon";

      const tempEl = document.createElement("div");
      tempEl.className = "f-temp";
      tempEl.textContent =
        typeof temp === "number" ? `${Math.round(temp)}°C` : "—";

      right.appendChild(img);
      right.appendChild(tempEl);

      card.appendChild(left);
      card.appendChild(right);

      this.forecastGrid.appendChild(card);
    });
  };

  // ===== localStorage: recent searches =====

  WeatherApp.prototype.loadRecentSearches = function () {
    try {
      const raw = localStorage.getItem(this.RECENT_KEY);
      this.recentSearches = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(this.recentSearches)) this.recentSearches = [];
    } catch (_) {
      this.recentSearches = [];
    }
  };

  WeatherApp.prototype.saveRecentSearch = function (city) {
    const titleCity = this.toTitleCase(city);

    // Remove duplicates
    this.recentSearches = this.recentSearches.filter(
      (c) => c.toLowerCase() !== titleCity.toLowerCase()
    );

    // Add to front
    this.recentSearches.unshift(titleCity);

    // Limit to 5
    if (this.recentSearches.length > 5) {
      this.recentSearches = this.recentSearches.slice(0, 5);
    }

    localStorage.setItem(this.RECENT_KEY, JSON.stringify(this.recentSearches));
    this.displayRecentSearches();
  };

  WeatherApp.prototype.displayRecentSearches = function () {
    this.recentContainer.innerHTML = "";

    if (!this.recentSearches.length) {
      const empty = document.createElement("div");
      empty.style.color = "rgba(232, 238, 252, 0.55)";
      empty.style.fontSize = "13px";
      empty.textContent = "No recent searches yet.";
      this.recentContainer.appendChild(empty);
      return;
    }

    // Important: Use .bind(this) in the forEach callback!
    this.recentSearches.forEach(
      function (city) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "pill";
        btn.textContent = city;

        btn.addEventListener("click", () => {
          this.getWeather(city);
        });

        this.recentContainer.appendChild(btn);
      }.bind(this)
    );
  };

  WeatherApp.prototype.loadLastCity = function () {
    const last = localStorage.getItem(this.LAST_CITY_KEY);
    if (last && last.trim()) {
      // Optional welcome tweak
      this.statusText.textContent = `Loading last searched city: ${last}`;
      this.getWeather(last);
    } else {
      this.statusText.textContent = "Search a city to view weather.";
    }
  };

  WeatherApp.prototype.clearHistory = function () {
    localStorage.removeItem(this.RECENT_KEY);
    localStorage.removeItem(this.LAST_CITY_KEY);
    this.recentSearches = [];
    this.displayRecentSearches();

    // Reset UI (optional clean reset)
    this.forecastGrid.innerHTML = "";
    this.currentWeatherEl.classList.add("hidden");
    this.metaRow.classList.add("hidden");
    this.welcome.classList.remove("hidden");

    this.clearError();
    this.statusText.textContent = "History cleared.";
  };

  // Boot
  new WeatherApp();
})();