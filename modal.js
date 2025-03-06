// Inject the content script when the modal is opened
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const activeTab = tabs[0].id;

  // Inject the content script
  chrome.scripting.executeScript({
    target: { tabId: activeTab },
    files: ["content.js"],
  });
});

// Listen for messages from the content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "showModal") {
    updateModal(message.data);
  }
});

// Function to update the modal with new data
function updateModal(data) {
  const { last_mean, avg_mean, best_mean, worst_mean, avg_top5 } = data;

  // Update the DOM with the received data
  document.getElementById("last-mean").textContent = last_mean.toFixed(2);
  document.getElementById("avg-mean").textContent = avg_mean.toFixed(2);
  document.getElementById("best-mean").textContent = best_mean.toFixed(2);
  document.getElementById("worst-mean").textContent = worst_mean.toFixed(2);

  const tbody = document.querySelector("#top5-table tbody");

  tbody.innerHTML = "";
  avg_top5.forEach((item) => {
    const row = document.createElement("tr");

    const locationCell = document.createElement("td");
    locationCell.textContent = item.location; // Safe assignment
    row.appendChild(locationCell);

    const valueCell = document.createElement("td");
    valueCell.textContent = item.value.toFixed(2); // Safe assignment
    row.appendChild(valueCell);

    tbody.appendChild(row);
  });
}

// Handle toggle button click
document
  .getElementById("excludeCN-toggle")
  .addEventListener("change", (event) => {
    const excludeCN = event.target.checked;

    // Send a message to the content script to recalculate with the new excludeCN value
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0].id;

      chrome.scripting.executeScript({
        target: { tabId: activeTab },
        func: recalculatePingData,
        args: [excludeCN],
      });
    });
  });

// Function to recalculate ping data
function recalculatePingData(excludeCN) {
  const last_pings = document.querySelectorAll('td[id^="ping-"][id$="-last"]');
  const avg_pings = document.querySelectorAll('td[id^="ping-"][id$="-avg"]');
  const best_pings = document.querySelectorAll('td[id^="ping-"][id$="-best"]');
  const worst_pings = document.querySelectorAll(
    'td[id^="ping-"][id$="-worst"]'
  );

  function filterCN(elements) {
    return excludeCN
      ? Array.from(elements).filter((td) => !td.id.startsWith("ping-CN_"))
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

  // Send the updated data to the modal
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
