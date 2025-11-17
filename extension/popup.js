// popup.js

const grabBtn = document.getElementById('grabBtn');
const statusDiv = document.getElementById('status');
const statusLabel = document.getElementById('statusLabel');
const statusDetails = document.getElementById('statusDetails');

grabBtn.disabled = true;

chrome.tabs.query({ active: true, currentWindow: true}, ([tab]) => {
    const url = (tab && tab.url || '').toLowerCase();
    const isMessagePage =
        url.includes("jpay.com/incomingmailview.aspx?encletterid=")
        || url.includes("jpay.com/sentmailview.aspx?encletterid=");
    if (isMessagePage) {
        grabBtn.disabled = false;
    }

    grabBtn.addEventListener('click', () => {
        console.debug("popup clicked");
        chrome.tabs.sendMessage(tab.id, {type: 'GRAB_MESSAGE'}, (response) => {
            console.debug("Response from content.js:", response);
        });
    });
});

const bgPort = chrome.runtime.connect({ name: "popup" });
bgPort.onMessage.addListener((msg) => {
    console.debug("Received from background.js:", msg);

    // Normalize values
    const status = (msg && msg.status) ? msg.status : null;
    const details = msg && (msg.filePath || msg.error) ? (msg.filePath || msg.error) : '';

    if (!status) {
        statusLabel.textContent = "No action yet";
        statusDetails.textContent = "";
        statusDiv.className = "empty";
        return;
    }

    statusLabel.textContent = status.toUpperCase();
    statusDetails.textContent = details;

    // Apply color class
    statusDiv.className = ""; // reset
    if (status === "saved") statusDiv.classList.add("saved");
    else if (status === "exists") statusDiv.classList.add("exists");
    else if (status === "error") statusDiv.classList.add("error");
});