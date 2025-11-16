// popup.js

const grabBtn = document.getElementById('grabBtn');
const statusDiv = document.getElementById('status');
grabBtn.disabled = true;

chrome.tabs.query({ active: true, currentWindow: true}, ([tab]) => {
    const url = tab.url.toLowerCase();
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
})

const bgPort = chrome.runtime.connect({ name: "popup" });
bgPort.onMessage.addListener((msg) => {
    console.debug("Received from background.js:", msg);
    statusDiv.textContent = msg.status.toUpperCase() + (msg.filePath ? `: ${msg.filePath}` : '') + (msg.error ? ` - ${msg.error}` : '');
    
    // Apply color class
    statusDiv.className = "";
    if (msg.status === "saved") statusDiv.classList.add("saved");
    else if (msg.status === "exists") statusDiv.classList.add("exists");
    else if (msg.status === "error") statusDiv.classList.add("error");
});