// background.js

let popupPort = null;
let nativePort = null;

const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3";

chrome.runtime.onConnect.addListener((p) => {
    if (p.name === "popup") {
        popupPort = p;
        popupPort.onDisconnect.addListener(() => {
            popupPort = null;
        });
    }
});

function ensureNativePort() {
    if (nativePort) {
        return nativePort;
    }

    nativePort = chrome.runtime.connectNative("com.ashvinpai.messagevault");
    nativePort.onMessage.addListener((response) => {
        console.debug("Received from native host:", response);
        popupPort?.postMessage(response);
    });
    nativePort.onDisconnect.addListener(() => {
        console.error("Disconnected from native host");
        popupPort?.postMessage({ status: "error", error: "Disconnected from native host" });
        nativePort = null;
    });

    return nativePort;
}

function getAuthToken(interactive) {
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive }, (token) => {
            if (chrome.runtime.lastError || !token) {
                reject(new Error(chrome.runtime.lastError?.message || "Google auth failed."));
                return;
            }
            resolve(token);
        });
    });
}

function removeCachedToken(token) {
    return new Promise((resolve) => {
        chrome.identity.removeCachedAuthToken({ token }, () => resolve());
    });
}

async function driveRequest(path, options = {}, interactive = false, retryOn401 = true) {
    const token = await getAuthToken(interactive);

    const headers = {
        Authorization: `Bearer ${token}`,
        ...(options.headers || {})
    };

    const response = await fetch(`${DRIVE_API_BASE}/${path}`, {
        ...options,
        headers
    });

    if (response.status === 401 && retryOn401) {
        await removeCachedToken(token);
        return driveRequest(path, options, interactive, false);
    }

    if (!response.ok) {
        let errorText = "Google Drive request failed.";
        try {
            const json = await response.json();
            errorText = json?.error?.message || errorText;
        } catch {
            errorText = await response.text() || errorText;
        }
        throw new Error(errorText);
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
}

async function driveUploadMultipart(metadata, textContent, interactive = false, retryOn401 = true) {
    const token = await getAuthToken(interactive);
    const boundary = `messagevault_${Date.now()}`;

    const payload =
        `--${boundary}\r\n` +
        `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
        `${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\n` +
        `Content-Type: text/plain; charset=UTF-8\r\n\r\n` +
        `${textContent}\r\n` +
        `--${boundary}--`;

    const response = await fetch(`${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,name`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": `multipart/related; boundary=${boundary}`
        },
        body: payload
    });

    if (response.status === 401 && retryOn401) {
        await removeCachedToken(token);
        return driveUploadMultipart(metadata, textContent, interactive, false);
    }

    if (!response.ok) {
        let errorText = "Google Drive upload failed.";
        try {
            const json = await response.json();
            errorText = json?.error?.message || errorText;
        } catch {
            errorText = await response.text() || errorText;
        }
        throw new Error(errorText);
    }

    return response.json();
}

function sanitizeSegment(input, fallback) {
    const sanitized = (input || "")
        .replace(/[<>:"/\\|?*]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    return sanitized || fallback;
}

function escapeDriveQueryValue(input) {
    return String(input || "").replace(/'/g, "\\'");
}

async function findFolder(parentId, folderName) {
    const safeName = escapeDriveQueryValue(folderName);
    const safeParent = escapeDriveQueryValue(parentId);
    const params = new URLSearchParams({
        q: `mimeType='application/vnd.google-apps.folder' and trashed=false and name='${safeName}' and '${safeParent}' in parents`,
        fields: "files(id,name)",
        pageSize: "1"
    });
    const data = await driveRequest(`files?${params.toString()}`);
    return data?.files?.[0] || null;
}

async function createFolder(parentId, folderName) {
    const metadata = {
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId]
    };

    return driveRequest("files?fields=id,name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metadata)
    });
}

async function ensureFolder(parentId, folderName) {
    const existing = await findFolder(parentId, folderName);
    if (existing) {
        return existing;
    }
    return createFolder(parentId, folderName);
}

async function ensureFolderPath(parentId, segments) {
    let currentParent = parentId;
    for (const segment of segments) {
        const folder = await ensureFolder(currentParent, segment);
        currentParent = folder.id;
    }
    return currentParent;
}

function buildDriveLayout(message) {
    const messageDate = new Date(message.timestamp);
    if (Number.isNaN(messageDate.getTime())) {
        throw new Error("Invalid message timestamp.");
    }

    const prisonerName = sanitizeSegment(message.prisonerName, "Unknown");
    const messageType = message.messageType === "sent" ? "sent" : "received";
    const year = String(messageDate.getFullYear());
    const month = messageDate.toLocaleString("en-US", { month: "long" });
    const filename = `${message.timestamp.replace(/:/g, "-").slice(0, 16)}.txt`;

    return {
        segments: [prisonerName, messageType, year, month],
        filename
    };
}

async function findExistingFile(parentId, filename) {
    const safeName = escapeDriveQueryValue(filename);
    const safeParent = escapeDriveQueryValue(parentId);
    const params = new URLSearchParams({
        q: `trashed=false and name='${safeName}' and '${safeParent}' in parents`,
        fields: "files(id,name)",
        pageSize: "1"
    });
    const data = await driveRequest(`files?${params.toString()}`);
    return data?.files?.[0] || null;
}

async function saveMessageToDrive(message) {
    const parentId = message.driveParentFolderId;
    const parentName = message.driveParentFolderName || "My Drive";

    if (!parentId) {
        throw new Error("Google Drive parent folder is not selected.");
    }

    await getAuthToken(true);

    const layout = buildDriveLayout(message);
    const leafFolderId = await ensureFolderPath(parentId, layout.segments);
    const existingFile = await findExistingFile(leafFolderId, layout.filename);
    const relativePath = `${parentName}/${layout.segments.join("/")}/${layout.filename}`;

    if (existingFile) {
        return { status: "exists", filePath: relativePath };
    }

    await driveUploadMultipart({
        name: layout.filename,
        parents: [leafFolderId]
    }, message.text, true);

    return { status: "saved", filePath: relativePath };
}

async function listDriveFolders(query) {
    const filters = ["mimeType='application/vnd.google-apps.folder'", "trashed=false"];
    if (query) {
        filters.push(`name contains '${escapeDriveQueryValue(query)}'`);
    }

    const params = new URLSearchParams({
        q: filters.join(" and "),
        fields: "files(id,name)",
        pageSize: "50",
        orderBy: "name_natural"
    });

    const data = await driveRequest(`files?${params.toString()}`, {}, true);
    return data?.files || [];
}

function saveLocally(message) {
    const port = ensureNativePort();
    port.postMessage(message);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'GRABBED_MESSAGE') {
        console.debug("Received message:", msg);
        const destination = msg.destination === "drive" ? "drive" : "local";

        if (destination === "drive") {
            saveMessageToDrive(msg)
                .then((result) => {
                    popupPort?.postMessage(result);
                    sendResponse({ status: "received by background.js", destination });
                })
                .catch((error) => {
                    console.error("Error saving to Google Drive:", error);
                    popupPort?.postMessage({ status: "error", error: error.message || String(error) });
                    sendResponse({ status: "error", destination, error: error.message || String(error) });
                });
            return true;
        }

        try {
            saveLocally(msg);
            sendResponse({ status: "received by background.js", destination });
        } catch (error) {
            console.error("Error sending message to native host:", error);
            popupPort?.postMessage({ status: "error", error: error.message || String(error) });
            sendResponse({ status: "error", destination, error: error.message || String(error) });
        }
    }
    else if (msg.type === "DRIVE_LIST_FOLDERS") {
        listDriveFolders((msg.query || "").trim())
            .then((folders) => {
                sendResponse({ status: "ok", folders });
            })
            .catch((error) => {
                console.error("Error listing Drive folders:", error);
                sendResponse({ status: "error", error: error.message || String(error) });
            });
        return true;
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

