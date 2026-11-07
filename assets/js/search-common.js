(() => {
  "use strict";

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let value = "";
    let quoted = false;
    text = String(text).replace(/^\uFEFF/, "");

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];
      if (quoted) {
        if (char === '"' && next === '"') { value += '"'; i += 1; }
        else if (char === '"') quoted = false;
        else value += char;
      } else if (char === '"') quoted = true;
      else if (char === ",") { row.push(value); value = ""; }
      else if (char === "\n") { row.push(value); rows.push(row); row = []; value = ""; }
      else if (char !== "\r") value += char;
    }
    if (value.length || row.length) { row.push(value); rows.push(row); }
    const header = rows.shift() || [];
    return rows.filter((cells) => cells.some((cell) => cell !== "")).map((cells) => {
      const record = {};
      header.forEach((key, index) => { record[key] = cells[index] ?? ""; });
      return record;
    });
  }

  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function safeUrl(value) {
    try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.href : ""; }
    catch { return ""; }
  }

  function normalize(value) {
    return String(value ?? "").normalize("NFKC").toLowerCase().trim();
  }

  function getCoordinates(item) {
    const latitude = Number(String(item.latitude || "").trim());
    const longitude = Number(String(item.longitude || "").trim());
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 || (latitude === 0 && longitude === 0)) return null;
    return { latitude, longitude };
  }

  function getDistanceMeters(lat1, lon1, lat2, lon2) {
    const radians = (degrees) => degrees * Math.PI / 180;
    const dLat = radians(lat2 - lat1);
    const dLon = radians(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
    return 12742000 * Math.asin(Math.sqrt(a));
  }

  function formatDistance(meters) {
    if (meters < 1000) return `現在地から約${Math.max(1, Math.round(meters))}m`;
    if (meters < 10000) return `現在地から約${(meters / 1000).toFixed(1)}km`;
    return `現在地から約${Math.round(meters / 1000)}km`;
  }

  function matchesCategories(record, selected) {
    if (selected.has("water") && record.record_type === "water") return true;
    if (selected.has("discount") && ["discount", "chain_discount"].includes(record.record_type)) return true;
    const categories = record.categories || [];
    return categories.some((category) => selected.has(category));
  }

  function getCurrentLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error("Geolocation is not supported")); return; }
      navigator.geolocation.getCurrentPosition((position) => resolve({
        latitude: position.coords.latitude, longitude: position.coords.longitude,
      }), reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
    });
  }

  function getLocationErrorMessage(error) {
    if (error?.code === 1) return "位置情報の利用が許可されていません。ブラウザの設定を確認してください。";
    if (error?.code === 2) return "現在地を取得できませんでした。電波状況や端末の位置情報設定を確認してください。";
    if (error?.code === 3) return "現在地の取得に時間がかかっています。もう一度お試しください。";
    return "現在地を取得できませんでした。このブラウザでは位置情報を利用できない可能性があります。";
  }

  window.FacilitySearchCommon = { parseCsv, escapeHtml, safeUrl, normalize, getCoordinates, getDistanceMeters, formatDistance, matchesCategories, getCurrentLocation, getLocationErrorMessage };
})();
