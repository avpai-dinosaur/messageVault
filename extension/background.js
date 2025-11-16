// background.js

let popupPort = null;
chrome.runtime.onConnect.addListener((p) => {
    if (p.name === "popup") {
        popupPort = p;
        popupPort.onDisconnect.addListener(() => {
            popupPort = null;
        });
    }
});

const port = chrome.runtime.connectNative("message_vault_host");
port.onMessage.addListener((msg) => {
    console.debug("Received from native host:", msg);
    if (popupPort) {
        popupPort.postMessage(msg);
    }
});
port.onDisconnect.addListener(() => {
    console.error("Disconnected from native host");
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'GRABBED_MESSAGE') {
        console.debug("Received message:", msg);
        if (port) {
            try {
                port.postMessage(msg);
            } catch (e) {
                console.error("Error sending message to native host:", e);
            }
        }
        sendResponse({ status: "received by background.js"});
    }
    else if (msg.type === "OPEN_POPUP") {
        chrome.action.openPopup()
            .then(() => {
                console.debug("Popup opened successfully via openPopup()");
            })
            .catch((err) => {
                console.warn("openPopup() failed, falling back to window", err);
                chrome.windows.create({
                    url: chrome.runtime.getURL("popup.html"),
                    type: "popup",
                    width: 400,
                    height: 600
                });
            });
    }
});

