// Wrapped in an IIFE because the popup re-injects this file into the same
// isolated world on every open/refresh; top-level declarations would
// otherwise throw "Identifier already declared" on the second run.
(() => {
// ping.pe tags every metric cell with an id of the form
// `ping-<LOCATION>-<metric>`, e.g. `ping-CN_Beijing-avg`. We group those
// cells back into one row per location so the popup can filter and
// aggregate them however it likes.
const METRIC_ID = /^ping-(.+)-(last|avg|best|worst)$/;

function extractPingData() {
  // Bail out early when the popup is opened on a page that isn't ping.pe.
  if (location.hostname !== "ping.pe") {
    send({ action: "showModal", status: "not_ping" });
    return;
  }

  const byLocation = new Map();

  document.querySelectorAll('td[id^="ping-"]').forEach((td) => {
    const match = td.id.match(METRIC_ID);
    if (!match) return;

    const [, name, metric] = match;
    const value = parseFloat(td.textContent.trim());
    if (isNaN(value)) return;

    if (!byLocation.has(name)) {
      // `cn` mirrors the historical `id.startsWith("ping-CN")` test so the
      // popup's "Exclude China" toggle keeps filtering the same nodes.
      byLocation.set(name, { location: name, cn: name.startsWith("CN") });
    }
    byLocation.get(name)[metric] = value;
  });

  // Keep only fully-populated rows so a half-rendered table never skews the
  // aggregates the popup computes.
  const rows = [...byLocation.values()].filter((r) =>
    ["last", "avg", "best", "worst"].every((m) => typeof r[m] === "number")
  );

  // No results have streamed in yet (or the page has none).
  if (rows.length === 0) {
    send({ action: "showModal", status: "empty" });
    return;
  }

  // The popup owns filtering (Exclude China) and aggregation so the toggle
  // stays instant; the content script just streams the raw per-location rows.
  send({ action: "showModal", status: "ok", rows });
}

// The popup may be closed while the observer is still running, which
// leaves no receiver; swallow that expected error.
function send(message) {
  try {
    chrome.runtime.sendMessage(message).catch(() => {});
  } catch (_) {
    /* ignore */
  }
}

// Recompute whenever ping.pe appends or updates a result row, so the popup
// reflects locations as they stream in rather than a single early snapshot.
// Throttled rather than debounced: ping.pe mutates the table continuously
// while results arrive, so a trailing debounce would keep resetting and
// never fire until the stream paused. This guarantees an update at most
// every 500ms even during a steady stream.
function watchForUpdates() {
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      extractPingData();
    }, 500);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// The script is re-injected every time the popup opens; only wire up the
// observer once, but always emit a fresh snapshot.
extractPingData();
if (!window.__pingpeWatching) {
  window.__pingpeWatching = true;
  watchForUpdates();
}
})();
