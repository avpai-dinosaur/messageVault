# MessageVault Privacy Policy
**Last updated:** [02/20/2026]

MessageVault is a Chrome extension designed to help users save their JPay messages to their local computer or to their own Google Drive account. We take privacy seriously and collect **no personal data** beyond what is necessary for the extension to function.

---

## 1. Information Collected

### 1.1 Data accessed on JPay pages
When the user is viewing a message on the JPay website, MessageVault temporarily accesses:

- Message text  
- Message metadata displayed on the page (date, sender/recipient, etc.)

This data is accessed **only when the user chooses to save a message**.

### 1.2 No data is collected from other websites
MessageVault only runs on `https://www.jpay.com/*`.  
It does not track browsing activity, monitor other tabs, or access any other websites.

---

## 2. How Data Is Used
The accessed message data is used **only** to:

- Save the message to a file on the user’s local computer via a user-installed native messaging host.
- Save the message to the user’s Google Drive account when the user selects Google Drive as destination.

MessageVault does **not** transmit data to the developer.
When Google Drive destination is selected, data is transmitted to Google APIs solely to write files in the user’s own Drive.

---

## 3. Native Messaging
MessageVault uses a Windows native host application installed by the user.  
This host is used **only** to:

- Write message content to local files  
- Read previously saved backup files when requested by the user

The native host:

- Does **not** access other system files  
- Does **not** collect analytics  
- Does **not** send any data off the device

The only data sent to the host is the message content the user chooses to save.

---

## 4. Google Drive Integration (Optional)
If the user selects Google Drive as the save destination, MessageVault uses Google OAuth and Google Drive API access to:

- Authenticate the user with Google
- List folders for user selection
- Create folders/files in the selected Drive location

MessageVault requests the Drive scope `https://www.googleapis.com/auth/drive`.

This scope allows the extension to list and select existing folders in the user’s Google Drive and create files/folders at the user-selected destination.

---

## 5. No Data Sharing
MessageVault:

- Does **not** sell or rent information  
- Does **not** share information with third parties except Google services when user-selected Drive saving is used  
- Does **not** use analytics or tracking tools  
- Does **not** transmit data to the developer

Data stays on the user’s local device unless the user opts into Google Drive saving.

---

## 6. Permission Usage

### Host Permission: `https://www.jpay.com/*`
Required to detect and extract message content when the user is viewing a JPay message page.  
No other websites are accessed.

---

### `tabs` Permission
Used only to read the URL of the active tab to determine whether the user is on a supported JPay page.  
Browsing history is not tracked or stored.

---

### `storage` Permission
Used to store user preferences such as selected save destination and selected Google Drive parent folder.

---

### `identity` Permission
Used to sign in the user with Google when Google Drive destination is selected.

---

### `nativeMessaging` Permission
Used to communicate with a user-installed native Windows host that writes backup files to disk.  
No external transmission occurs through native messaging.

---

### Host Permission: `https://www.googleapis.com/*`
Used only for Google Drive API calls when the user chooses Google Drive saving.

---

## 7. Children’s Privacy
MessageVault is not intended for use by children under 13 and does not knowingly collect personal information from children.

---

## 8. Changes to This Policy
Any changes to this privacy policy will be published in the extension’s listing and repository.

---
