; -----------------------------------------------------------
; MessageVault Installer (Inno Setup)
; -----------------------------------------------------------

#define AppName "MessageVault"
#define AppPublisher "Ashvin Pai"
#define AppVersion "1.0.0"
#define AppExeName "MessageVault.exe"
#define GuiExeName "MessageVaultGUI.exe"
#define HostName "com.ashvinpai.messagevault"

[Setup]
AppName={#AppName}
AppVersion={#AppVersion}
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
OutputBaseFilename=MessageVaultInstaller
ArchitecturesInstallIn64BitMode=x64compatible
Compression=lzma
SolidCompression=yes
DisableDirPage=yes
DisableProgramGroupPage=yes
PrivilegesRequired=admin

[Files]
; Native host executable → Program Files\MessageVault\MessageVault.exe
Source: "MessageVault.exe"; \
    DestDir: "{app}"; \
    Flags: ignoreversion

; Native messaging manifest → Program Files\MessageVault\com.ashvinpai.messagevault.json
Source: "com.ashvinpai.messagevault.json"; \
    DestDir: "{app}"; \
    Flags: ignoreversion

; GUI application -> Program Files\MessageVault\MessageVaultGUI.exe
Source: "MessageVaultGUI.exe"; \
    DestDir: "{app}"; \
    Flags: ignoreversion

[Registry]
Root: HKLM; \
    Subkey: "Software\Google\Chrome\NativeMessagingHosts\{#HostName}"; \
    ValueType: string; \
    ValueName: ""; \
    ValueData: "{app}\com.ashvinpai.messagevault.json"; \
    Flags: uninsdeletekey

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExeName}"
Name: "{group}\{#AppName}"; Filename: "{app}\{#GuiExeName}"

[Run]
; Nothing to run automatically after install,
; native host is triggered by Chrome itself

[UninstallDelete]
; Manifest should clean up itself
