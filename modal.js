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
    const { last_mean, avg_mean, best_mean, worst_mean, avg_top5 } =
      message.data;

    // Update the DOM with the received data
    document.getElementById("last-mean").textContent = last_mean.toFixed(2);
    document.getElementById("avg-mean").textContent = avg_mean.toFixed(2);
    document.getElementById("best-mean").textContent = best_mean.toFixed(2);
    document.getElementById("worst-mean").textContent = worst_mean.toFixed(2);

    const tbody = document.querySelector("#top5-table tbody");
    tbody.innerHTML = avg_top5
      .map(
        (item) => `
            <tr>
                <td>${item.location}</td>
                <td>${item.value.toFixed(2)}</td>
            </tr>
        `
      )
      .join("");
  }
});
