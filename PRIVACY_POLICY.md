# MessageVault Privacy Policy
**Last updated:** [11/20/2025]

MessageVault is a Chrome extension designed to help users save their JPay messages to their local computer. We take privacy seriously and collect **no personal data** beyond what is necessary for the extension to function.

---

## 1. Information Collected

### 1.1 Data accessed on JPay pages
When the user is viewing a message on the JPay website, MessageVault temporarily accesses:

- Message text  
- Message metadata displayed on the page (date, sender/recipient, etc.)

This data is accessed **only when the user chooses to save a message**.  
MessageVault does **not** collect, transmit, store, analyze, or share this information.

### 1.2 No data is collected from other websites
MessageVault only runs on `https://www.jpay.com/*`.  
It does not track browsing activity, monitor other tabs, or access any other websites.

---

## 2. How Data Is Used
The accessed message data is used **only** to:

- Save the message to a file on the user’s local computer via a user-installed native messaging host.

All data remains on the user’s device.  
No data is transmitted to the developer or any third party.

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

## 4. No Data Sharing
MessageVault:

- Does **not** sell or rent information  
- Does **not** share information with third parties  
- Does **not** use analytics or tracking tools  
- Does **not** transmit data off the device

All data stays local to the user's computer.

---

## 5. Permission Usage

### Host Permission: `https://www.jpay.com/*`
Required to detect and extract message content when the user is viewing a JPay message page.  
No other websites are accessed.

---

### `tabs` Permission
Used only to read the URL of the active tab to determine whether the user is on a supported JPay page.  
Browsing history is not tracked or stored.

---

### `nativeMessaging` Permission
Used to communicate with a user-installed native Windows host that writes backup files to disk.  
No external transmission occurs.

---

## 6. Children’s Privacy
MessageVault is not intended for use by children under 13 and does not knowingly collect personal information from children.

---

## 7. Changes to This Policy
Any changes to this privacy policy will be published in the extension’s listing and repository.

---