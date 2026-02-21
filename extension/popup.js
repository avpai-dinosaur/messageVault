// popup.js

const grabBtn = document.getElementById('grabBtn');
const destinationSelect = document.getElementById('destinationSelect');
const driveControls = document.getElementById('driveControls');
const useRootBtn = document.getElementById('useRootBtn');
const driveFolderSearch = document.getElementById('driveFolderSearch');
const searchFoldersBtn = document.getElementById('searchFoldersBtn');
const driveFolderResults = document.getElementById('driveFolderResults');
const selectFolderBtn = document.getElementById('selectFolderBtn');
const driveFolderName = document.getElementById('driveFolderName');
const statusDiv = document.getElementById('status');
const statusLabel = document.getElementById('statusLabel');
const statusDetails = document.getElementById('statusDetails');

let activeTabId = null;
let saveDestination = 'local';
let driveParentFolderId = null;
let driveParentFolderName = null;

grabBtn.disabled = true;

function setStatus(status, details = '') {
    const normalized = status || null;
    if (!normalized) {
        statusLabel.textContent = 'No action yet';
        statusDetails.textContent = '';
        statusDiv.className = 'empty';
        return;
    }

    statusLabel.textContent = normalized.toUpperCase();
    statusDetails.textContent = details;

    statusDiv.className = '';
    if (normalized === 'saved') statusDiv.classList.add('saved');
    else if (normalized === 'exists') statusDiv.classList.add('exists');
    else if (normalized === 'error') statusDiv.classList.add('error');
    else statusDiv.classList.add('info');
}

function renderDriveControls() {
    driveControls.style.display = saveDestination === 'drive' ? 'flex' : 'none';
}

function renderSelectedFolder() {
    if (driveParentFolderId && driveParentFolderName) {
        driveFolderName.textContent = `Selected: ${driveParentFolderName}`;
    } else {
        driveFolderName.textContent = 'No folder selected.';
    }
}

function persistSettings() {
    chrome.storage.local.set({
        saveDestination,
        driveParentFolderId,
        driveParentFolderName
    });
}

function loadSettings(callback) {
    chrome.storage.local.get(
        ['saveDestination', 'driveParentFolderId', 'driveParentFolderName'],
        (stored) => {
            saveDestination = stored.saveDestination === 'drive' ? 'drive' : 'local';
            driveParentFolderId = stored.driveParentFolderId || null;
            driveParentFolderName = stored.driveParentFolderName || null;

            destinationSelect.value = saveDestination;
            renderDriveControls();
            renderSelectedFolder();
            callback();
        }
    );
}

loadSettings(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        activeTabId = tab && tab.id ? tab.id : null;
    const url = (tab && tab.url || '').toLowerCase();
    const isMessagePage =
        url.includes("jpay.com/incomingmailview.aspx?encletterid=")
        || url.includes("jpay.com/sentmailview.aspx?encletterid=");
    if (isMessagePage) {
        grabBtn.disabled = false;
    }

        if (!isMessagePage) {
            setStatus('info', 'Open a supported JPay message page to enable saving.');
        }

    grabBtn.addEventListener('click', () => {
        console.debug("popup clicked");
            if (!activeTabId) {
                setStatus('error', 'Could not identify active tab.');
                return;
            }

            if (saveDestination === 'drive' && !driveParentFolderId) {
                setStatus('error', 'Select a Google Drive parent folder first.');
                return;
            }

            setStatus('info', saveDestination === 'drive' ? 'Saving to Google Drive...' : 'Saving locally...');

        chrome.tabs.sendMessage(activeTabId, {
            type: 'GRAB_MESSAGE',
            destination: saveDestination,
            driveParentFolderId,
            driveParentFolderName
        }, (response) => {
            console.debug("Response from content.js:", response);
                if (chrome.runtime.lastError) {
                    setStatus('error', chrome.runtime.lastError.message || 'Failed to message content script.');
                }
        });
    });
    });
});

destinationSelect.addEventListener('change', () => {
    saveDestination = destinationSelect.value === 'drive' ? 'drive' : 'local';
    renderDriveControls();
    persistSettings();
});

useRootBtn.addEventListener('click', () => {
    driveParentFolderId = 'root';
    driveParentFolderName = 'My Drive';
    renderSelectedFolder();
    persistSettings();
    setStatus('info', 'Parent folder set to My Drive root.');
});

searchFoldersBtn.addEventListener('click', () => {
    const query = (driveFolderSearch.value || '').trim();
    setStatus('info', 'Searching Drive folders...');

    chrome.runtime.sendMessage({
        type: 'DRIVE_LIST_FOLDERS',
        query
    }, (response) => {
        if (chrome.runtime.lastError) {
            setStatus('error', chrome.runtime.lastError.message || 'Drive folder search failed.');
            return;
        }

        if (!response || response.status !== 'ok') {
            setStatus('error', (response && response.error) || 'Drive folder search failed.');
            return;
        }

        driveFolderResults.innerHTML = '';
        const folders = response.folders || [];
        folders.forEach((folder) => {
            const option = document.createElement('option');
            option.value = folder.id;
            option.textContent = folder.name;
            driveFolderResults.appendChild(option);
        });

        setStatus('info', folders.length ? `Found ${folders.length} folder(s).` : 'No folders found.');
    });
});

selectFolderBtn.addEventListener('click', () => {
    const selected = driveFolderResults.selectedOptions[0];
    if (!selected) {
        setStatus('error', 'Choose a folder from search results first.');
        return;
    }

    driveParentFolderId = selected.value;
    driveParentFolderName = selected.textContent;
    renderSelectedFolder();
    persistSettings();
    setStatus('info', `Selected folder: ${driveParentFolderName}`);
});

const bgPort = chrome.runtime.connect({ name: "popup" });
bgPort.onMessage.addListener((msg) => {
    console.debug("Received from background.js:", msg);

    const status = (msg && msg.status) ? msg.status : null;
    const details = msg && (msg.filePath || msg.error) ? (msg.filePath || msg.error) : '';
    setStatus(status, details);
});