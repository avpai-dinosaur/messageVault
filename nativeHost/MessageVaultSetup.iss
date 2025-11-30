; -----------------------------------------------------------
; MessageVault Installer (Inno Setup)
; -----------------------------------------------------------

#define AppName "MessageVault"
#define AppPublisher "Ashvin Pai"
#define AppVersion "1.0.0"
#define GuiExeName "MessageVault.exe"
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
; Native host executable → Program Files\MessageVault\MVNativeHost.exe
Source: "MVNativeHost.exe"; \
    DestDir: "{app}"; \
    Flags: ignoreversion

; Native messaging manifest → Program Files\MessageVault\com.ashvinpai.messagevault.json
Source: "com.ashvinpai.messagevault.json"; \
    DestDir: "{app}"; \
    Flags: ignoreversion

; GUI application -> Program Files\MessageVault\MessageVault.exe
Source: "MessageVault.exe"; \
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
Name: "{group}\{#AppName}"; Filename: "{app}\{#GuiExeName}"

[Run]
; Nothing to run automatically after install,
; native host is triggered by Chrome itself

[UninstallDelete]
; Manifest should clean up itself

[Code]
function InitializeUninstall(): Boolean;
var
  ResultCode: Integer;
begin
  ResultCode := MsgBox(
    'Before uninstalling MessageVault, please make sure the Chrome extension is disabled.' + #13#10 +
    'Uninstalling while the extension is enabled may cause issues.' + #13#10#13#10 +
    'Do you want to continue with the uninstall?',
    mbConfirmation,
    MB_YESNO
  );

  if ResultCode = IDNO then
  begin
    Result := False;
  end
  else
  begin
    Result := True;
  end;
end;
