function extractPingData() {
  const last_pings = document.querySelectorAll('td[id^="ping-"][id$="-last"]');
  const avg_pings = document.querySelectorAll('td[id^="ping-"][id$="-avg"]');
  const best_pings = document.querySelectorAll('td[id^="ping-"][id$="-best"]');
  const worst_pings = document.querySelectorAll(
    'td[id^="ping-"][id$="-worst"]'
  );

  const excludeCN = true; // Set to `false` to disable filtering

  function filterCN(elements) {
    return excludeCN
      ? Array.from(elements).filter((td) => !td.id.startsWith("ping-CN"))
      : Array.from(elements);
  }

  const filtered_last = filterCN(last_pings);
  const filtered_avg = filterCN(avg_pings);
  const filtered_best = filterCN(best_pings);
  const filtered_worst = filterCN(worst_pings);

  function extractValues(elements) {
    return elements
      .map((td) => parseFloat(td.textContent.trim()))
      .filter((value) => !isNaN(value));
  }

  const last_values = extractValues(filtered_last);
  const avg_values = extractValues(filtered_avg);
  const best_values = extractValues(filtered_best);
  const worst_values = extractValues(filtered_worst);

  function calculateMean(values) {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  const last_mean = calculateMean(last_values);
  const avg_mean = calculateMean(avg_values);
  const best_mean = calculateMean(best_values);
  const worst_mean = calculateMean(worst_values);

  const data = {
    last_mean,
    avg_mean,
    best_mean,
    worst_mean,
    avg_top5: extractValuesWithLocations(filtered_avg)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5),
  };

  // Send the data to the modal
  chrome.runtime.sendMessage({ action: "showModal", data });
}

function extractValuesWithLocations(elements) {
  return elements
    .map((td) => {
      const value = parseFloat(td.textContent.trim());
      const location = td.id.split("-")[1];
      return !isNaN(value) ? { value, location } : null;
    })
    .filter((item) => item !== null);
}

// Run the extraction when the extension icon is clicked
extractPingData();
