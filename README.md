# MessageVault – JPay Message Backup Tool

**MessageVault** is a Chrome extension plus a Windows Native Messaging Host that automatically extracts and stores **JPay messages** on your local machine or in your Google Drive account.

Since JPay does not offer message export or bulk download tools, MessageVault provides a way for people to preserve communication history with incarcerated loved ones.

---

## Features

- **One-click message extraction** directly from JPay’s web interface  
- **Save destination choice**: local computer or Google Drive  
- **Google Drive folder selection** from the extension popup  
- **Native Windows integration** via Chrome Native Messaging for local saves  
- **Native Messaging Host Installer** that sets everything up for you  

# Setup

## Chrome Extension

1. Open `chrome://extensions`  
2. Enable **Developer mode**  
3. Click **Load unpacked**  
4. Select the `messageVault/extension` folder  
5. **Save the extension ID** — you’ll need it when configuring the native host

### Optional: Enable Google Drive Saving

To use Google Drive as the save destination:

1. Create a Google Cloud project and configure an OAuth client for a Chrome extension.
2. In `extension/manifest.json`, replace:

```json
"client_id": "REPLACE_WITH_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com"
```

with your real OAuth client ID.
3. Keep the Drive scope as:

```json
"https://www.googleapis.com/auth/drive"
```

4. Reload the unpacked extension.
5. In the popup, set **Save To** = **Google Drive**, then either:
    - Click **Use My Drive Root**, or
    - Search and select any existing folder in your Google Drive.
6. On the first Google Drive save, Chrome prompts for Google sign-in/consent.

Drive saves are organized under the selected parent folder as:

```
<Prisoner>/<sent|received>/<Year>/<Month>/<timestamp>.txt
```

## Windows Native Messaging Host

The native host is built using **PyInstaller**:

```bash
messageVault\nativeHost> pyinstaller --onefile main.py --distpath [Destination Folder] --name MessageVault
```

### 1. Configure the Host Manifest

Edit `com.ashvinpai.messagevault.json` so the **allowed_origins** field includes the Chrome extension ID you recorded earlier.

Also edit the **path** field to point to your generated executable.

```
{
    "name": "com.ashvinpai.messagevault",
    "description": "Host for MessageVault Windows native messaging",
    "path": "C:\\path\\to\\MessageVault.exe",
    "type": "stdio",
    "allowed_origins": [
        "chrome-extension://<your-extension-id>/"
    ]
}
```

### 2. Register the Native Host (User-Level)

Create a `.reg` file containing:

```reg
Windows Registry Editor Version 5.00
[HKEY_CURRENT_USER\Software\Google\Chrome\NativeMessagingHosts\com.ashvinpai.messagevault]
@="C:\\path\\to\\com.ashvinpai.messagevault.json"
```

Double-click the file to add the registry entry, then confirm it via Registry Editor.

For more details, see Chrome’s official documentation:
https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging

# Installer 

MessageVault includes an Inno Setup script that automates:

- Installing the native host to `C:\Program Files\`
- Registering the host under **HKEY_LOCAL_MACHINE** (system-wide)
- Copying all required binaries and manifest files

## Steps to Generate the Installer

1. Download and install Inno Setup:
https://jrsoftware.org/isinfo.php
2. Place the following files in the same directory:
    - `MessageVault.exe`
    - `com.ashvinpai.messagevault.json`
    - `MessageVaultSetup.iss`
3. Open `MessageVaultSetup.iss` in the Inno Setup editor.
4. Click **Build → Compile**.

The installer will be created at:

```
..\Output\MessageVaultInstaller.exe
```

Run the installer and the MessageVault native host will be fully configured.

# Notes
- Manual setup installs the host **per user**
- The installer sets it up **system-wide**
- MessageVault stores all data **locally** in `C:\Users\<user>\Documents\MessageVault\`
- When Google Drive destination is selected, data is uploaded to the user’s Google Drive account