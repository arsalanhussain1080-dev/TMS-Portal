#ifndef PortalRole
  #define PortalRole "Student"
#endif

[Setup]
AppId=TmsPortal-{#PortalRole}
AppName=TMS {#PortalRole}
AppVersion=1.0
DefaultDirName={localappdata}\Programs\TMS {#PortalRole}
DefaultGroupName=TMS {#PortalRole}
OutputDir=..\build\windows
OutputBaseFilename=TMS-{#PortalRole}-Windows-Setup
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
Compression=lzma2
SolidCompression=yes
SetupIconFile={#PortalRole}.ico
UninstallDisplayIcon={app}\TMS-{#PortalRole}.exe

[Files]
Source: "bin\Release\net48\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\TMS {#PortalRole}"; Filename: "{app}\TMS-{#PortalRole}.exe"
Name: "{autodesktop}\TMS {#PortalRole}"; Filename: "{app}\TMS-{#PortalRole}.exe"
