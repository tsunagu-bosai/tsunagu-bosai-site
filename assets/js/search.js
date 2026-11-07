(() => {
  "use strict";

  const DATA_URL = "../../assets/data/facilities-official.csv";
  const MAX_RESULTS = 100;

  const form = document.getElementById("facility-search-form");
  const keywordInput = document.getElementById("search-keyword");
  const prefectureSelect = document.getElementById("search-prefecture");
  const categorySelect = document.getElementById("search-category");
  const nearbyButton = document.getElementById("facility-search-nearby");
  const resetButton = document.getElementById("facility-search-reset");
  const status = document.getElementById("facility-search-status");
  const results = document.getElementById("facility-search-results");

  let facilities = [];

  const categoryLabels = {
    public_toilet: "公衆トイレ",
    facility_with_toilet: "バリアフリー関連施設",
  };

  const equipmentLabels = {
    wheelchair_toilet: "車いす対応トイレ",
    multipurpose_toilet: "多目的トイレ",
    ostomate: "オストメイト",
    baby_bed: "ベビーベッド",
    baby_chair: "ベビーチェア",
    adult_bed: "大型ベッド",
    nursing_space: "授乳スペース",
    diaper_changing_space: "おむつ交換スペース",
  };

  function parseCsv(text) { return window.FacilitySearchCommon.parseCsv(text); }

  function escapeHtml(value) { return window.FacilitySearchCommon.escapeHtml(value); }

  function safeUrl(value) { return window.FacilitySearchCommon.safeUrl(value); }

  function normalize(value) { return window.FacilitySearchCommon.normalize(value); }

  function getCoordinates(item) { return window.FacilitySearchCommon.getCoordinates(item); }

  function getDistanceMeters(latitude1, longitude1, latitude2, longitude2) { return window.FacilitySearchCommon.getDistanceMeters(latitude1, longitude1, latitude2, longitude2); }

  function formatDistance(distanceMeters) { return window.FacilitySearchCommon.formatDistance(distanceMeters); }

  function loadPrefectures() {
    const prefectures = new Map();

    for (const item of facilities) {
      const code = String(item.prefecture_code || "").trim();
      const name = String(item.prefecture_name || "").trim();

      if (!code || !name) {
        continue;
      }

      if (!prefectures.has(code)) {
        prefectures.set(code, name);
      }
    }

    const sorted = [...prefectures.entries()]
      .sort(([codeA], [codeB]) => Number(codeA) - Number(codeB));

    for (const [, name] of sorted) {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      prefectureSelect.appendChild(option);
    }
  }

  function getEquipmentHtml(item) {
    const available = [];
    const unavailable = [];

    for (const [key, label] of Object.entries(equipmentLabels)) {
      const value = normalize(item[key]);

      if (value === "yes") {
        available.push(label);
      } else if (value === "no") {
        unavailable.push(label);
      }
    }

    let html = "";

    if (available.length > 0) {
      html += `
        <div class="facility-equipment">
          <strong>確認できる設備</strong>
          <div class="facility-tags">
            ${available
              .map(
                (label) =>
                  `<span class="facility-tag available">${escapeHtml(label)}</span>`
              )
              .join("")}
          </div>
        </div>
      `;
    }

    if (unavailable.length > 0) {
      html += `
        <details class="facility-unavailable">
          <summary>元データ上「なし」と確認できる設備</summary>
          <div class="facility-tags">
            ${unavailable
              .map(
                (label) =>
                  `<span class="facility-tag unavailable">${escapeHtml(label)}</span>`
              )
              .join("")}
          </div>
        </details>
      `;
    }

    return html;
  }

  function getMapUrl(item) {
    const latRaw = String(item.latitude || "").trim();
    const lngRaw = String(item.longitude || "").trim();

    if (latRaw && lngRaw) {
      const coordinates = getCoordinates(item);

      if (coordinates) {
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${coordinates.latitude},${coordinates.longitude}`
        )}`;
      }
    }

    const name = String(item.name || "").trim();
    const address = String(item.address || "").trim();

    const query = [name, address]
      .filter(Boolean)
      .join(" ")
      .trim();

    if (!query) {
      return "";
    }

    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      query
    )}`;
  }

  function getLocationLabel(item) {
    const prefecture = String(item.prefecture_name || "").trim();
    const municipality = String(item.municipality_name || "").trim();

    if (!municipality) {
      return prefecture;
    }

    if (prefecture && municipality.startsWith(prefecture)) {
      return municipality;
    }

    return [prefecture, municipality].filter(Boolean).join(" ");
  }

  function renderResult(item, distanceMeters = null) {
    const sourceUrl = safeUrl(item.source_urls);
    const licenseUrl = safeUrl(item.license_urls);
    const mapUrl = getMapUrl(item);
    const location = getLocationLabel(item);

    return `
      <article class="facility-result-card">

        <div class="facility-result-header">
          <span class="facility-result-category">
            ${escapeHtml(categoryLabels[item.facility_category] || item.facility_category)}
          </span>

          <h2>${escapeHtml(item.name || "名称不明")}</h2>
        </div>

        <div class="facility-result-body">

          ${
            location
              ? `<p class="facility-result-location">${escapeHtml(location)}</p>`
              : ""
          }

          ${
            item.address
              ? `<p class="facility-result-address">${escapeHtml(item.address)}</p>`
              : ""
          }

          ${
            Number.isFinite(distanceMeters)
              ? `<p class="facility-result-distance">${escapeHtml(formatDistance(distanceMeters))}</p>`
              : ""
          }

          ${getEquipmentHtml(item)}

          <div class="facility-result-actions">

            ${
              mapUrl
                ? `
                  <a
                    href="${mapUrl}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="facility-result-button"
                  >
                    地図で見る
                  </a>
                `
                : ""
            }

            ${
              sourceUrl
                ? `
                  <a
                    href="${escapeHtml(sourceUrl)}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="facility-result-button secondary"
                  >
                    公開元を見る
                  </a>
                `
                : ""
            }

          </div>

          <details class="facility-source-details">
            <summary>出典・ライセンス</summary>

            <dl>
              ${
                item.source_names
                  ? `
                    <div>
                      <dt>出典</dt>
                      <dd>${escapeHtml(item.source_names)}</dd>
                    </div>
                  `
                  : ""
              }

              ${
                item.attributions
                  ? `
                    <div>
                      <dt>出典表記</dt>
                      <dd>${escapeHtml(item.attributions)}</dd>
                    </div>
                  `
                  : ""
              }

              ${
                item.licenses
                  ? `
                    <div>
                      <dt>ライセンス</dt>
                      <dd>
                        ${
                          licenseUrl
                            ? `
                              <a
                                href="${escapeHtml(licenseUrl)}"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                ${escapeHtml(item.licenses)}
                              </a>
                            `
                            : escapeHtml(item.licenses)
                        }
                      </dd>
                    </div>
                  `
                  : ""
              }
            </dl>
          </details>

        </div>
      </article>
    `;
  }

  function runSearch({ currentLocation = null } = {}) {
    const keyword = normalize(keywordInput.value);
    const prefecture = prefectureSelect.value;
    const category = categorySelect.value;
    const isNearbySearch = currentLocation !== null;

    if (!isNearbySearch && !keyword && !prefecture && !category) {
      status.textContent = "検索条件を入力してください。";
      results.innerHTML = "";
      return;
    }

    const matches = facilities
      .filter((item) => {
        if (prefecture && item.prefecture_name !== prefecture) {
          return false;
        }

        if (category && item.facility_category !== category) {
          return false;
        }

        if (keyword) {
          const target = normalize([
            item.name,
            item.prefecture_name,
            item.municipality_name,
            item.address,
          ].join(" "));

          if (!target.includes(keyword)) {
            return false;
          }
        }

        return true;
      })
      .map((item) => {
        if (!isNearbySearch) {
          return { item, distanceMeters: null };
        }

        const coordinates = getCoordinates(item);
        if (!coordinates) {
          return null;
        }

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

    if (isNearbySearch) {
      matches.sort((a, b) => a.distanceMeters - b.distanceMeters);
    }

    if (matches.length === 0) {
      status.textContent = isNearbySearch
        ? "現在地から距離を計算できる施設は見つかりませんでした。"
        : "該当する施設は見つかりませんでした。";
      results.innerHTML = "";
      return;
    }

    const shown = matches.slice(0, MAX_RESULTS);

    if (isNearbySearch) {
      const conditionText = keyword || prefecture || category
        ? "指定した条件に合う施設を"
        : "施設を";

      if (matches.length > MAX_RESULTS) {
        status.textContent =
          `${conditionText}現在地から近い順に${MAX_RESULTS}件表示しています。` +
          `（距離を計算できた施設：${matches.length.toLocaleString("ja-JP")}件）`;
      } else {
        status.textContent =
          `${conditionText}現在地から近い順に表示しています。` +
          `（${matches.length.toLocaleString("ja-JP")}件）`;
      }
    } else if (matches.length > MAX_RESULTS) {
      status.textContent =
        `${matches.length.toLocaleString("ja-JP")}件見つかりました。` +
        `先頭${MAX_RESULTS}件を表示しています。条件を追加すると絞り込めます。`;
    } else {
      status.textContent =
        `${matches.length.toLocaleString("ja-JP")}件見つかりました。`;
    }

    results.innerHTML = shown
      .map(({ item, distanceMeters }) => renderResult(item, distanceMeters))
      .join("");
  }

  function getCurrentLocation() { return window.FacilitySearchCommon.getCurrentLocation(); }

  function getLocationErrorMessage(error) { return window.FacilitySearchCommon.getLocationErrorMessage(error); }

  async function loadData() {
    status.textContent = "施設データを読み込んでいます…";

    try {
      const response = await fetch(DATA_URL, {
        cache: "no-cache",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const text = await response.text();
      facilities = parseCsv(text);

      loadPrefectures();

      status.textContent =
        `${facilities.length.toLocaleString("ja-JP")}件の施設データを読み込みました。` +
        "検索条件を入力してください。";
    } catch (error) {
      console.error(error);

      status.textContent =
        "施設データを読み込めませんでした。時間をおいて再度お試しください。";
      results.innerHTML = "";
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    runSearch();
  });

  nearbyButton.addEventListener("click", async () => {
    if (facilities.length === 0) {
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

    status.textContent =
      `${facilities.length.toLocaleString("ja-JP")}件の施設データを読み込みました。` +
      "検索条件を入力してください。";

    keywordInput.focus();
  });

  loadData();
})();
