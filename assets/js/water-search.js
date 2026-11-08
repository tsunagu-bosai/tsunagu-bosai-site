(() => {
  "use strict";

  const DATA_URL = "../../assets/data/water-search-facilities.json";
  const MAX_RESULTS = 100;
  const {
    escapeHtml,
    safeUrl,
    normalize,
    getCoordinates,
    getDistanceMeters,
    formatDistance,
    getCurrentLocation,
    getLocationErrorMessage,
  } = window.FacilitySearchCommon;

  const form = document.getElementById("water-search-form");
  const keywordInput = document.getElementById("water-keyword");
  const nearbyButton = document.getElementById("water-search-nearby");
  const resetButton = document.getElementById("water-search-reset");
  const status = document.getElementById("water-search-status");
  const results = document.getElementById("water-search-results");
  const summary = document.getElementById("water-search-summary");

  let records = [];
  let hasLoaded = false;

  function getSelectedCategories() {
    return new Set(
      [...form.querySelectorAll('input[name="category"]:checked')]
        .map((input) => input.value),
    );
  }

  function getMapUrl(item) {
    const coordinates = getCoordinates(item);
    if (coordinates) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${coordinates.latitude},${coordinates.longitude}`,
      )}`;
    }

    const query = [item.name, item.address].filter(Boolean).join(" ").trim();
    return query
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
      : "";
  }

  function getCategoryLabel(item) {
    return item.record_type === "water" ? "給水・給茶スポット" : "マイボトル割引サービス";
  }

  function matchesSelectedService(item, selected) {
    return item.record_type === "water"
      ? selected.has("water")
      : (item.record_type === "discount" || item.record_type === "chain_discount") && selected.has("discount");
  }

  function getServiceDetailsHtml(item) {
    if (item.record_type === "chain_discount" || item.service_id) {
      const source = safeUrl(item.official_service_source_url);
      return `
        <div class="water-service-details">
          <strong>割引内容</strong>
          <p>${escapeHtml(item.service_terms)}</p>
          <strong>利用条件</strong>
          <p>${escapeHtml(item.eligibility)}</p>
          <strong>対象範囲</strong>
          <p>${escapeHtml(item.scope)}</p>
          ${item.discount_content ? `<p>既存サービス記録：${escapeHtml(item.discount_content)}</p>` : ""}
          ${source ? `<p><a href="${escapeHtml(source)}" target="_blank" rel="noopener noreferrer">公式の制度案内</a></p>` : ""}
          ${item.record_type === "chain_discount" ? `<p class="water-unverified">この店舗の営業状況は未確認です。</p>` : ""}
        </div>
      `;
    }

    if (item.record_type === "discount") {
      return `
        <div class="facility-equipment water-service-details">
          <strong>サービス内容</strong>
          <p>${escapeHtml(item.discount_content || "内容は公開元をご確認ください。")}</p>
        </div>
      `;
    }

    const feeLabels = { free_refill: "無料", paid_refill: "有料", unknown: "料金未確認" };
    const hasFeeLabel = Object.prototype.hasOwnProperty.call(feeLabels, item.service_type);
    const feeLabel = hasFeeLabel ? feeLabels[item.service_type] : "料金・利用条件は公開元をご確認ください。";
    return `
      <div class="facility-equipment water-service-details">
        <strong>料金区分</strong>
        <p>${escapeHtml(feeLabel)}</p>
        <p class="water-unverified">掲載元資料に基づく区分です。現在の料金や営業状況を保証するものではありません。利用前に公開元をご確認ください。</p>
        ${item.seasonal === "true" ? `<p>季節利用：${escapeHtml(item.season_note || "季節による利用制限があります。")}</p>` : ""}
      </div>
    `;
  }

  function getSourceDetailsHtml(item) {
    if (item.record_type === "chain_discount") {
      return `
        <details class="facility-source-details">
          <summary>位置データの出典・ライセンス</summary>
          <dl>
            <div><dt>出典</dt><dd>${escapeHtml(item.osm_attribution || "© OpenStreetMap contributors")}</dd></div>
            <div><dt>ライセンス</dt><dd><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">${escapeHtml(item.osm_license || "ODbL 1.0")}</a></dd></div>
          </dl>
        </details>
      `;
    }

    const sourceUrl = safeUrl(item.source_url);
    return `
      <details class="facility-source-details">
        <summary>出典・ライセンス</summary>
        <dl>
          ${item.source_names ? `<div><dt>出典</dt><dd>${escapeHtml(item.source_names)}</dd></div>` : ""}
          ${item.attributions ? `<div><dt>出典表記</dt><dd>${escapeHtml(item.attributions)}</dd></div>` : ""}
          ${item.licenses ? `<div><dt>ライセンス</dt><dd>${item.license_urls ? `<a href="${escapeHtml(safeUrl(item.license_urls))}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.licenses)}</a>` : escapeHtml(item.licenses)}</dd></div>` : ""}
          ${sourceUrl ? `<div><dt>公開元</dt><dd><a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">情報を確認する</a></dd></div>` : ""}
        </dl>
      </details>
    `;
  }

  function renderRecord(item, distanceMeters = null) {
    const coordinates = getCoordinates(item);
    const mapUrl = getMapUrl(item);
    const distanceHtml = Number.isFinite(distanceMeters)
      ? `<p class="facility-result-distance">${escapeHtml(formatDistance(distanceMeters))}</p>`
      : "";
    const addressHtml = item.address
      ? `<p class="facility-result-address">${escapeHtml(item.address)}</p>`
      : `<p class="water-no-address">住所情報はありません。座標から地図を開けます。</p>`;

    return `
      <article class="facility-result-card">
        <div class="facility-result-header">
          <span class="facility-result-category">${escapeHtml(getCategoryLabel(item))}</span>
          <h2>${escapeHtml(item.name || "名称不明")}</h2>
        </div>
        <div class="facility-result-body">
          ${addressHtml}
          ${distanceHtml}
          ${coordinates ? `<p class="facility-result-location">緯度 ${coordinates.latitude}・経度 ${coordinates.longitude}</p>` : ""}
          ${item.possible_duplicate ? `<p class="water-review-note">近くに既存店舗データがあります。距離だけでは同一店舗と判断せず、両方掲載しています。</p>` : ""}
          ${getServiceDetailsHtml(item)}
          <div class="facility-result-actions">
            ${mapUrl ? `<a href="${escapeHtml(mapUrl)}" target="_blank" rel="noopener noreferrer" class="facility-result-button">地図</a>` : ""}
            ${item.record_type === "chain_discount" || item.service_id
              ? `<a href="${escapeHtml(safeUrl(item.official_service_source_url))}" target="_blank" rel="noopener noreferrer" class="facility-result-button secondary">公式制度案内</a>`
              : safeUrl(item.source_url)
                ? `<a href="${escapeHtml(safeUrl(item.source_url))}" target="_blank" rel="noopener noreferrer" class="facility-result-button secondary">公開元を見る</a>`
                : ""}
          </div>
          ${getSourceDetailsHtml(item)}
        </div>
      </article>
    `;
  }

  function getSearchMatches(currentLocation = null) {
    const keyword = normalize(keywordInput.value);
    const categories = getSelectedCategories();

    const matches = records
      .filter((item) => {
        if (!matchesSelectedService(item, categories)) return false;
        if (!keyword) return true;
        return normalize([
          item.name,
          item.address,
          item.brand_name,
          item.discount_content,
          item.service_terms,
        ].join(" ")).includes(keyword);
      })
      .map((item) => {
        if (!currentLocation) return { item, distanceMeters: null };
        const coordinates = getCoordinates(item);
        if (!coordinates) return null;
        return {
          item,
          distanceMeters: getDistanceMeters(
            currentLocation.latitude,
            currentLocation.longitude,
            coordinates.latitude,
            coordinates.longitude,
          ),
        };
      })
      .filter(Boolean);

    if (currentLocation) {
      matches.sort((a, b) => a.distanceMeters - b.distanceMeters);
    }
    return matches;
  }

  function runSearch({ currentLocation = null } = {}) {
    const categories = getSelectedCategories();
    if (categories.size === 0) {
      status.textContent = "検索対象が選択されていません。給水・給茶スポットまたはマイボトル割引サービスを選択してください。";
      results.innerHTML = "";
      return;
    }

    const matches = getSearchMatches(currentLocation);
    if (matches.length === 0) {
      status.textContent = currentLocation
        ? "現在地から距離を計算できる施設は見つかりませんでした。"
        : "該当する施設は見つかりませんでした。";
      results.innerHTML = "";
      return;
    }

    const shown = matches.slice(0, MAX_RESULTS);
    const distanceLabel = currentLocation ? "現在地から近い順に" : "";
    status.textContent = matches.length > MAX_RESULTS
      ? `${matches.length.toLocaleString("ja-JP")}件見つかりました。${distanceLabel}${MAX_RESULTS}件を表示しています。条件を追加すると絞り込めます。`
      : `${matches.length.toLocaleString("ja-JP")}件見つかりました。${distanceLabel}表示しています。`;
    results.innerHTML = shown
      .map(({ item, distanceMeters }) => renderRecord(item, distanceMeters))
      .join("");
  }

  function getLoadedStatus() {
    return `${records.length.toLocaleString("ja-JP")}件の施設データを読み込みました。検索条件を入力してください。`;
  }

  async function loadData() {
    status.textContent = "施設データを読み込んでいます…";
    try {
      const response = await fetch(DATA_URL, { cache: "no-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      records = Array.isArray(data.records) ? data.records : [];

      const counts = {
        water: records.filter((record) => record.record_type === "water").length,
        existing: records.filter((record) => record.record_type === "discount").length,
        chain: records.filter((record) => record.record_type === "chain_discount").length,
      };
      const discounts = counts.existing + counts.chain;
      summary.innerHTML = `
        <div><strong>${counts.water.toLocaleString("ja-JP")}</strong><span>給水・給茶スポット</span></div>
        <div><strong>${discounts.toLocaleString("ja-JP")}</strong><span>割引サービス</span></div>
        <div><strong>${records.length.toLocaleString("ja-JP")}</strong><span>合計</span></div>
      `;
      hasLoaded = true;
      status.textContent = getLoadedStatus();
      results.innerHTML = "";
    } catch (error) {
      console.error(error);
      status.textContent = "施設データを読み込めませんでした。時間をおいて再度お試しください。";
      results.innerHTML = "";
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    runSearch();
  });

  nearbyButton.addEventListener("click", async () => {
    if (!hasLoaded) {
      status.textContent = "施設データの読み込み完了後にお試しください。";
      return;
    }

    nearbyButton.disabled = true;
    status.textContent = "現在地を取得しています…";
    try {
      const currentLocation = await getCurrentLocation();
      runSearch({ currentLocation });
    } catch (error) {
      console.error(error);
      status.textContent = getLocationErrorMessage(error);
      results.innerHTML = "";
    } finally {
      nearbyButton.disabled = false;
    }
  });

  resetButton.addEventListener("click", () => {
    form.reset();
    results.innerHTML = "";
    status.textContent = getLoadedStatus();
    keywordInput.focus();
  });

  loadData();
})();
