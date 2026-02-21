// content.js

console.debug("content.js loaded");

function logMessage(options = {}) {
    // Grab the timestamp element
    const timestampElement = document.getElementById("lblDate");
    if (!timestampElement) {
        console.error("Timestamp element not found.");
        return;
    }
    const timestamp = timestampElement.innerText;
    const date = new Date(timestamp);
    const timestampISO = date.toISOString();

    // Grab the message body
    const messageBodyElement = document.getElementById("lblLetter");
    if (!messageBodyElement) {
        console.error("Message body element not found.");
        return;
    }
    const messageText = messageBodyElement.innerText;

    // Determine message type from URL
    const url = window.location.href;
    let messageType = "unknown";
    let prisonerName = null;
    if (url.includes("SentMailView.aspx")) {
        messageType = "sent";
        const prisonerElement = document.getElementById("lblTo");
        if (prisonerElement) {
            prisonerName = prisonerElement.innerText;
        }
        else {
            console.error("Prisoner name element not found for sent message.");
            return;
        }
    } else if (url.includes("IncomingMailView.aspx")) {
        messageType = "received";
        const prisonerElement = document.getElementById("lblFrom");
        if (prisonerElement) {
            prisonerName = prisonerElement.innerText;
        }
        else {
            console.error("Prisoner name element not found for received message.");
            return;
        }
    }
    else {
        console.error("Could not determine message type from URL.");
        return;
    }

    let message = {
        type: 'GRABBED_MESSAGE',
        text: messageText,
        timestamp: timestampISO,
        messageType: messageType,
        prisonerName: prisonerName.trim(),
        destination: options.destination === 'drive' ? 'drive' : 'local',
        driveParentFolderId: options.driveParentFolderId || null,
        driveParentFolderName: options.driveParentFolderName || null
    }
    console.debug("Extracted message:", message);
    chrome.runtime.sendMessage(message, (response) => {
        console.debug("Background response:", response);
    });
    return message;
}

function isMessagePage() {
    const url = window.location.href.toLowerCase();
    return url.includes("jpay.com/incomingmailview.aspx?encletterid=") || 
        url.includes("jpay.com/sentmailview.aspx?encletterid=");
}

console.debug("Page check:", window.location.href, "->", isMessagePage());
if (isMessagePage()) {
    console.debug("JPay message page detected. Requesting popup...");
    chrome.runtime.sendMessage({type: "OPEN_POPUP"});

    if (!window.hasGrabMessageListener) {
        // Protect against reinjections of script
        window.hasGrabMessageListener = true;

        chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
            if (msg.type === 'GRAB_MESSAGE') {
                console.debug("Logging message...");
                sendResponse({ message: logMessage(msg), status: 'done' });
            }
        });
    }
}
else {
    console.debug("Not a JPay message page. Extension disabled.");
}