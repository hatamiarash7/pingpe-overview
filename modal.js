// The most recent raw per-location rows streamed from the page, kept so the
// Exclude China toggle can re-filter without a re-injection.
let latestRows = null;

// The most recent computed dataset (filtered + aggregated), kept so exports
// and comparisons have data.
let latestData = null;

// A previously saved run to diff against, and whether compare mode is on.
let baseline = null;
let compareMode = false;

// Whether China nodes are dropped before aggregating.
let excludeCN = true;

// How many locations the highest-latency list shows (5 / 10 / 15).
let topCount = 5;

// Inject the content script into the active tab to (re)compute stats.
function requestStats() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];

    // Restricted pages (chrome://, the web store, the new-tab page, …)
    // can't be scripted, so injecting there throws. Guard for a normal
    // web page and show guidance instead of failing silently.
    if (!tab || !tab.url || !/^https?:/.test(tab.url)) {
      showMessage("not_ping");
      return;
    }

    chrome.scripting
      .executeScript({
        target: { tabId: tab.id },
        files: ["content.js"],
      })
      .catch(() => showMessage("not_ping"));
  });
}

// Listen for messages from the content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action !== "showModal") return;

  if (message.status === "ok" && message.rows) {
    latestRows = message.rows;
    render();
  } else {
    latestRows = null;
    latestData = null;
    showMessage(message.status);
  }
});

const STATUS_MESSAGES = {
  not_ping: "Open a ping.pe ping page to see statistics.",
  empty: "Waiting for ping results…",
  error: "Couldn't read the ping table on this page.",
};

// Toggle between the stats view and a centered status message.
function showMessage(status) {
  document.getElementById("stats-view").hidden = true;
  document.getElementById("count-badge").hidden = true;

  const messageEl = document.getElementById("message");
  messageEl.hidden = false;
  messageEl.textContent = STATUS_MESSAGES[status] || STATUS_MESSAGES.error;
}

// Arithmetic mean of a numeric array.
const mean = (values) => values.reduce((sum, n) => sum + n, 0) / values.length;

// Linear-interpolated percentile (p in 0..100) of a numeric array.
function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const rank = (p / 100) * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  return sorted[low] + (sorted[high] - sorted[low]) * (rank - low);
}

// Apply the Exclude China filter to the raw rows and aggregate them. The
// filtering lives here (not in the content script) so the toggle is instant.
function computeData(rows) {
  const filtered = excludeCN ? rows.filter((r) => !r.cn) : rows;
  if (filtered.length === 0) return null;

  const avgValues = filtered.map((r) => r.avg);

  return {
    count: filtered.length,
    last_mean: mean(filtered.map((r) => r.last)),
    avg_mean: mean(avgValues),
    best_mean: mean(filtered.map((r) => r.best)),
    worst_mean: mean(filtered.map((r) => r.worst)),
    avg_median: percentile(avgValues, 50),
    avg_p95: percentile(avgValues, 95),
    rows: filtered,
  };
}

// Recompute from the latest raw rows and either render or show a message.
function render() {
  if (!latestRows) return;
  latestData = computeData(latestRows);
  if (!latestData) {
    showMessage("empty");
    return;
  }
  showStats(latestData);
}

// Classify a latency value so it can be colour-coded in the UI.
function health(ms) {
  if (ms < 100) return "good";
  if (ms < 250) return "warn";
  return "bad";
}

// The baseline to diff against, or null when compare is off / unavailable.
function activeBaseline() {
  return compareMode && baseline ? baseline : null;
}

// Fill a delta element with an arrow + magnitude. For latency lower is
// better, so a drop is coloured "good" and a rise "bad" regardless of the
// arrow direction. Hidden when there is nothing to compare against.
function setDelta(id, current, base, suffix) {
  const el = document.getElementById(id);
  if (base == null || current == null) {
    el.hidden = true;
    return;
  }

  const diff = current - base;
  el.hidden = false;

  if (Math.abs(diff) < 0.5) {
    el.className = el.className.replace(/\b(good|bad|neutral)\b/g, "").trim() +
      " neutral";
    el.textContent = "±0" + (suffix || "");
    return;
  }

  const improved = diff < 0;
  el.className = el.className.replace(/\b(good|bad|neutral)\b/g, "").trim() +
    (improved ? " good" : " bad");
  el.textContent =
    (improved ? "▼ " : "▲ ") + Math.abs(diff).toFixed(1) + (suffix || "");
}

// Render the computed statistics into the popup.
function showStats(data) {
  document.getElementById("message").hidden = true;
  document.getElementById("stats-view").hidden = false;

  const badge = document.getElementById("count-badge");
  badge.hidden = false;
  badge.textContent = `${data.count} nodes`;

  const hero = document.getElementById("avg-mean");
  hero.textContent = data.avg_mean.toFixed(2);
  hero.parentElement.className = "hero-value " + health(data.avg_mean);

  document.getElementById("avg-median").textContent = data.avg_median.toFixed(2);
  document.getElementById("avg-p95").textContent = data.avg_p95.toFixed(2);
  document.getElementById("last-mean").textContent = data.last_mean.toFixed(2);
  document.getElementById("best-mean").textContent = data.best_mean.toFixed(2);
  document.getElementById("worst-mean").textContent = data.worst_mean.toFixed(2);

  const base = activeBaseline();
  setDelta("hero-delta", data.avg_mean, base && base.avg_mean, " vs baseline");
  setDelta("last-delta", data.last_mean, base && base.last_mean);
  setDelta("best-delta", data.best_mean, base && base.best_mean);
  setDelta("worst-delta", data.worst_mean, base && base.worst_mean);

  document.getElementById("top5-heading").textContent = base
    ? "Biggest changes"
    : "Highest latency";

  renderTopList();
}

// Render the list, either the N highest-latency locations or, in compare
// mode, the N locations that moved the most versus the baseline. Slicing
// happens here (not in the content script) so it stays instant.
function renderTopList() {
  if (!latestData) return;

  const list = document.getElementById("top5-list");
  const base = activeBaseline();
  list.classList.toggle("compare", !!base);
  list.innerHTML = "";

  const entries = base
    ? compareEntries(latestData.rows, base.rows)
    : [...latestData.rows]
        .sort((a, b) => b.avg - a.avg)
        .map((r) => ({ location: r.location, avg: r.avg }));

  const top = entries.slice(0, topCount);
  const scale = latestData.rows.reduce((m, r) => Math.max(m, r.avg), 1);

  top.forEach((item) => {
    list.appendChild(base ? compareRow(item) : latencyRow(item, scale));
  });
}

// A row for the normal (non-compare) list: location, value, spectrum bar.
function latencyRow(item, scale) {
  const li = document.createElement("li");

  const loc = document.createElement("span");
  loc.className = "loc";
  loc.textContent = item.location;

  const val = document.createElement("span");
  val.className = "val";
  val.textContent = `${item.avg.toFixed(2)} ms`;

  const bar = document.createElement("div");
  bar.className = "bar";
  const fill = document.createElement("span");
  fill.className = health(item.avg);
  fill.style.width = Math.max(4, (item.avg / scale) * 100) + "%";
  bar.appendChild(fill);

  li.append(loc, val, bar);
  return li;
}

// A row for compare mode: location (+ new/gone tag), value, delta chip.
function compareRow(item) {
  const li = document.createElement("li");

  const loc = document.createElement("span");
  loc.className = "loc";
  loc.textContent = item.location;
  if (item.tag) {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = item.tag;
    loc.appendChild(tag);
  }

  const val = document.createElement("span");
  val.className = "val";
  val.textContent = item.avg == null ? "—" : `${item.avg.toFixed(2)} ms`;

  const delta = document.createElement("span");
  if (item.delta == null) {
    delta.className = "delta neutral";
    delta.textContent = "";
  } else if (Math.abs(item.delta) < 0.5) {
    delta.className = "delta neutral";
    delta.textContent = "±0";
  } else {
    const improved = item.delta < 0;
    delta.className = "delta " + (improved ? "good" : "bad");
    delta.textContent =
      (improved ? "▼ " : "▲ ") + Math.abs(item.delta).toFixed(1);
  }

  li.append(loc, val, delta);
  return li;
}

// Merge current and baseline rows into comparison entries, sorted by the
// magnitude of change; new locations then gone locations sink to the end.
function compareEntries(current, baseRows) {
  const baseByLoc = new Map(baseRows.map((r) => [r.location, r]));
  const currentByLoc = new Map(current.map((r) => [r.location, r]));

  const entries = current.map((r) => {
    const b = baseByLoc.get(r.location);
    return {
      location: r.location,
      avg: r.avg,
      delta: b ? r.avg - b.avg : null,
      tag: b ? null : "new",
    };
  });

  for (const b of baseRows) {
    if (!currentByLoc.has(b.location)) {
      entries.push({ location: b.location, avg: null, delta: null, tag: "gone" });
    }
  }

  const rank = (e) =>
    e.tag === "gone" ? -2 : e.tag === "new" ? -1 : Math.abs(e.delta);
  return entries.sort((a, b) => rank(b) - rank(a));
}

// --- Exclude China -----------------------------------------------------

document
  .getElementById("excludeCN-toggle")
  .addEventListener("change", (event) => {
    excludeCN = event.target.checked;
    chrome.storage.local.set({ excludeCN });
    render();
  });

// --- List size preset --------------------------------------------------

const PRESETS = [5, 10, 15];

function setTopCount(count, persist) {
  topCount = PRESETS.includes(count) ? count : 5;

  for (const b of document.getElementById("top-count").children) {
    const active = parseInt(b.dataset.count, 10) === topCount;
    b.classList.toggle("active", active);
    b.setAttribute("aria-selected", active ? "true" : "false");
  }

  renderTopList();
  if (persist) chrome.storage.local.set({ topCount });
}

document.getElementById("top-count").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-count]");
  if (button) setTopCount(parseInt(button.dataset.count, 10), true);
});

// --- Snapshot & compare ------------------------------------------------

// Human-friendly age of the baseline, e.g. "just now" / "2h ago".
function relativeTime(ts) {
  const seconds = Math.round((Date.now() - ts) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

// Reflect the current baseline in the compare bar and re-render.
function refreshCompareUI() {
  const bar = document.getElementById("compare-bar");
  bar.hidden = !baseline;

  if (baseline) {
    document.getElementById("baseline-age").textContent =
      "baseline · " + relativeTime(baseline.ts);
  }

  document.getElementById("compare-check").checked = compareMode && !!baseline;
  if (latestData) showStats(latestData);
}

function saveBaseline() {
  if (!latestData) return;
  baseline = { ts: Date.now(), ...latestData };
  chrome.storage.local.set({ baseline });
  refreshCompareUI();
}

function clearBaseline() {
  baseline = null;
  compareMode = false;
  chrome.storage.local.remove("baseline");
  chrome.storage.local.set({ compare: false });
  refreshCompareUI();
}

document.getElementById("save-baseline").addEventListener("click", saveBaseline);
document.getElementById("clear-baseline").addEventListener("click", clearBaseline);
document.getElementById("compare-check").addEventListener("change", (event) => {
  compareMode = event.target.checked;
  chrome.storage.local.set({ compare: compareMode });
  if (latestData) showStats(latestData);
});

// --- Export ------------------------------------------------------------

// Trigger a browser download for the given text content.
function download(filename, mime, content) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportCsv() {
  if (!latestData) return;
  const header = "location,last,avg,best,worst";
  const lines = latestData.rows.map((r) =>
    [r.location, r.last, r.avg, r.best, r.worst].join(",")
  );
  download("pingpe.csv", "text/csv", [header, ...lines].join("\n"));
}

function exportJson() {
  if (!latestData) return;
  download("pingpe.json", "application/json", JSON.stringify(latestData.rows, null, 2));
}

document.getElementById("refresh").addEventListener("click", requestStats);
document.getElementById("export-csv").addEventListener("click", exportCsv);
document.getElementById("export-json").addEventListener("click", exportJson);

// --- Startup -----------------------------------------------------------

// Restore saved preferences (Exclude China, list size, baseline, compare
// state) before the first render.
chrome.storage.local.get(
  { excludeCN: true, topCount: 5, baseline: null, compare: false },
  (stored) => {
    excludeCN = stored.excludeCN;
    baseline = stored.baseline;
    compareMode = stored.compare;
    document.getElementById("excludeCN-toggle").checked = excludeCN;
    setTopCount(stored.topCount, false);
    refreshCompareUI();
  }
);

// Inject only after the message listener is registered, so the content
// script's first snapshot is never missed.
requestStats();
