Unicode True
RequestExecutionLevel admin
SetCompressor /SOLID lzma

!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "nsDialogs.nsh"

!ifndef STAGE_DIR
  !error "STAGE_DIR must be supplied by build_installer.ps1"
!endif
!ifndef PRODUCT_VERSION
  !error "PRODUCT_VERSION must be supplied by build_installer.ps1"
!endif
!ifndef OUTPUT_FILE
  !error "OUTPUT_FILE must be supplied by build_installer.ps1"
!endif

!define PRODUCT_NAME "Pico DMX Controller"
!define SERVICE_NAME "PicoDmxController"
!define DEFAULT_PORT "8090"

Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "${OUTPUT_FILE}"
InstallDir "$PROGRAMFILES64\${PRODUCT_NAME}"
InstallDirRegKey HKLM "Software\PicoDmxController" "InstallDir"

Var ListenAddress
Var DataDir
Var ProductPort
Var ExistingPort
Var PortInput
Var PortOwnerPid
Var PortOwnerName
Var PortOwnerService

!define MUI_ABORTWARNING
!define MUI_ICON "${STAGE_DIR}\app\assets\favicon.ico"
!define MUI_UNICON "${STAGE_DIR}\app\assets\favicon.ico"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "${STAGE_DIR}\LICENSE"
!insertmacro MUI_PAGE_DIRECTORY
Page custom PortPageCreate PortPageLeave
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_TEXT "Open Pico DMX Controller"
!define MUI_FINISHPAGE_RUN_FUNCTION LaunchController
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

!insertmacro MUI_LANGUAGE "English"

Function .onInit
    SetShellVarContext all
    StrCpy $ListenAddress "127.0.0.1"
    StrCpy $DataDir "$APPDATA\${PRODUCT_NAME}\data"
    StrCpy $ProductPort "${DEFAULT_PORT}"
    StrCpy $ExistingPort ""
    ReadRegStr $0 HKLM "Software\PicoDmxController" "Port"
    ${If} $0 != ""
        StrCpy $ProductPort $0
        StrCpy $ExistingPort $0
    ${EndIf}
FunctionEnd

Function PortPageCreate
    !insertmacro MUI_HEADER_TEXT "Controller port" "Choose the local HTTP port used by the Pico DMX Controller."
    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
        Abort
    ${EndIf}

    ${NSD_CreateLabel} 0 4u 100% 24u "HTTP port (1024-65535):"
    Pop $0
    ${NSD_CreateNumber} 0 28u 90u 13u "$ProductPort"
    Pop $PortInput
    ${NSD_SetTextLimit} $PortInput 5
    ${NSD_CreateLabel} 0 52u 100% 40u "The default is 8090. Change it when that port is already used or when the customer's network policy requires another port."
    Pop $0

    nsDialogs::Show
FunctionEnd

Function PortPageLeave
    ${NSD_GetText} $PortInput $ProductPort
    ${If} $ProductPort == ""
        MessageBox MB_ICONEXCLAMATION "Enter an HTTP port from 1024 to 65535."
        Abort
    ${EndIf}

    IntCmp $ProductPort 1024 check_port_max invalid_port check_port_max

    check_port_max:
        IntCmp $ProductPort 65535 port_in_range port_in_range invalid_port

    invalid_port:
        MessageBox MB_ICONEXCLAMATION "The HTTP port must be a number from 1024 to 65535."
        Abort

    port_in_range:
        InitPluginsDir
        File /oname=$PLUGINSDIR\test_port.ps1 "${STAGE_DIR}\support\test_port.ps1"
        File /oname=$PLUGINSDIR\port_owner.ps1 "${STAGE_DIR}\support\port_owner.ps1"

        nsExec::ExecToStack '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\test_port.ps1" -Port $ProductPort'
        Pop $0
        Pop $1
        ${If} $0 == 0
            Return
        ${EndIf}

        nsExec::ExecToStack '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\port_owner.ps1" -Port $ProductPort -InfoPath "$PLUGINSDIR\port-owner.ini"'
        Pop $0
        Pop $1
        ${If} $0 != 10
            MessageBox MB_ICONEXCLAMATION "Port $ProductPort is in use, but setup could not identify its owner. Close the application manually or choose another port."
            Abort
        ${EndIf}

        ReadINIStr $PortOwnerPid "$PLUGINSDIR\port-owner.ini" "Owner" "ProcessId"
        ReadINIStr $PortOwnerName "$PLUGINSDIR\port-owner.ini" "Owner" "ProcessName"
        ReadINIStr $PortOwnerService "$PLUGINSDIR\port-owner.ini" "Owner" "ServiceName"

        ${If} $PortOwnerService == "${SERVICE_NAME}"
            StrCpy $3 "Pico DMX Controller is already running on port $ProductPort.$\r$\n$\r$\nSetup must close its application window and stop its server before upgrading. Close it now and continue?"
            StrCpy $4 "1"
        ${ElseIf} $PortOwnerService != ""
            MessageBox MB_ICONEXCLAMATION "Port $ProductPort is used by Windows service '$PortOwnerService' (process $PortOwnerName, PID $PortOwnerPid). Setup will not stop an unrelated Windows service. Stop it manually or choose another port."
            Abort
        ${Else}
            StrCpy $3 "Port $ProductPort is used by $PortOwnerName (PID $PortOwnerPid).$\r$\n$\r$\nSave any work first. Close it now and continue?"
            StrCpy $4 "0"
        ${EndIf}

        MessageBox MB_ICONQUESTION|MB_YESNO "$3" IDYES close_port_owner
        Abort

    close_port_owner:
        ${If} $4 == "1"
            nsExec::ExecToLog 'taskkill /IM "PicoDmxShell.exe" /T /F'
        ${EndIf}
        nsExec::ExecToStack '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\port_owner.ps1" -Port $ProductPort -InfoPath "$PLUGINSDIR\port-owner.ini" -ExpectedProcessId $PortOwnerPid -Stop'
        Pop $0
        Pop $1
        ${If} $0 != 0
            MessageBox MB_ICONEXCLAMATION "Setup could not close $PortOwnerName or release port $ProductPort. Close it manually or choose another port."
            Abort
        ${EndIf}

        nsExec::ExecToStack '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\test_port.ps1" -Port $ProductPort'
        Pop $0
        Pop $1
        ${If} $0 != 0
            MessageBox MB_ICONEXCLAMATION "Port $ProductPort is still in use. Close the application manually or choose another port."
            Abort
        ${EndIf}
FunctionEnd

Section /o "Allow access from iPads and PCs on the private network" SEC_LAN
    StrCpy $ListenAddress "0.0.0.0"
SectionEnd

Section "-Pico DMX Controller" SEC_CORE
    SetShellVarContext all

    nsExec::ExecToLog 'taskkill /IM "PicoDmxShell.exe" /T /F'
    nsExec::ExecToLog '"$INSTDIR\runtime\apache\bin\httpd.exe" -k stop -n "${SERVICE_NAME}"'
    nsExec::ExecToStack '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\test_port.ps1" -Port $ProductPort'
    Pop $0
    Pop $1
    ${If} $0 != 0
        nsExec::ExecToLog '"$INSTDIR\runtime\apache\bin\httpd.exe" -k start -n "${SERVICE_NAME}"'
        MessageBox MB_ICONSTOP "Port $ProductPort became unavailable. No application files were replaced; close the other application or choose another port."
        Abort
    ${EndIf}
    nsExec::ExecToLog '"$INSTDIR\runtime\apache\bin\httpd.exe" -k uninstall -n "${SERVICE_NAME}"'

    IfFileExists "$DataDir\*.*" 0 no_upgrade_backup
        CreateDirectory "$APPDATA\${PRODUCT_NAME}\backups\before-${PRODUCT_VERSION}"
        CopyFiles /SILENT "$DataDir\*.*" "$APPDATA\${PRODUCT_NAME}\backups\before-${PRODUCT_VERSION}"
        DetailPrint "Preserved a pre-upgrade data snapshot for version ${PRODUCT_VERSION}"
    no_upgrade_backup:

    SetOutPath "$INSTDIR"
    File /r "${STAGE_DIR}\app"
    File /r "${STAGE_DIR}\runtime"
    File /r "${STAGE_DIR}\shell"
    File /r "${STAGE_DIR}\support"
    File "${STAGE_DIR}\LICENSE"
    File "${STAGE_DIR}\VERSION"

    CreateDirectory "$DataDir"

    nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\support\configure_install.ps1" -InstallDir "$INSTDIR" -DataDir "$DataDir" -ListenAddress "$ListenAddress" -Port $ProductPort'
    Pop $0
    ${If} $0 != 0
        MessageBox MB_ICONSTOP "Could not create the web-server configuration (exit code $0)."
        Abort
    ${EndIf}

    IfFileExists "$INSTDIR\support\vc_redist.x64.exe" 0 +3
        ExecWait '"$INSTDIR\support\vc_redist.x64.exe" /install /quiet /norestart' $0
        DetailPrint "Visual C++ Runtime installer returned $0"

    nsExec::ExecToLog '"$INSTDIR\runtime\apache\bin\httpd.exe" -t -f "$INSTDIR\config\httpd.conf"'
    Pop $0
    ${If} $0 != 0
        MessageBox MB_ICONSTOP "The bundled web-server configuration is invalid (exit code $0)."
        Abort
    ${EndIf}

    nsExec::ExecToLog '"$INSTDIR\runtime\apache\bin\httpd.exe" -k install -n "${SERVICE_NAME}" -f "$INSTDIR\config\httpd.conf"'
    Pop $0
    ${If} $0 != 0
        MessageBox MB_ICONSTOP "Could not install the Pico DMX Windows service (exit code $0)."
        Abort
    ${EndIf}
    nsExec::ExecToLog '"$INSTDIR\runtime\apache\bin\httpd.exe" -k start -n "${SERVICE_NAME}"'

    SectionGetFlags ${SEC_LAN} $1
    IntOp $1 $1 & ${SF_SELECTED}
    ${If} $1 <> 0
        nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="${PRODUCT_NAME}"'
        nsExec::ExecToLog 'netsh advfirewall firewall add rule name="${PRODUCT_NAME}" dir=in action=allow protocol=TCP localport=$ProductPort profile=private program="$INSTDIR\runtime\apache\bin\httpd.exe"'
    ${Else}
        nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="${PRODUCT_NAME}"'
    ${EndIf}

    WriteRegStr HKLM "Software\PicoDmxController" "InstallDir" "$INSTDIR"
    WriteRegStr HKLM "Software\PicoDmxController" "Version" "${PRODUCT_VERSION}"
    WriteRegStr HKLM "Software\PicoDmxController" "Port" "$ProductPort"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\PicoDmxController" "DisplayName" "${PRODUCT_NAME}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\PicoDmxController" "DisplayVersion" "${PRODUCT_VERSION}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\PicoDmxController" "Publisher" "Pico DMX"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\PicoDmxController" "InstallLocation" "$INSTDIR"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\PicoDmxController" "UninstallString" '"$INSTDIR\Uninstall.exe"'
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\PicoDmxController" "NoModify" 1
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\PicoDmxController" "NoRepair" 1

    WriteUninstaller "$INSTDIR\Uninstall.exe"
    CreateDirectory "$SMPROGRAMS\${PRODUCT_NAME}"
    CreateShortcut "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk" "$INSTDIR\shell\PicoDmxShell.exe" '--url http://localhost:$ProductPort/' "$INSTDIR\shell\PicoDmxShell.exe"
    CreateShortcut "$SMPROGRAMS\${PRODUCT_NAME}\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
    CreateShortcut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\shell\PicoDmxShell.exe" '--url http://localhost:$ProductPort/' "$INSTDIR\shell\PicoDmxShell.exe"
SectionEnd

Function LaunchController
    Exec '"$INSTDIR\shell\PicoDmxShell.exe" --url http://localhost:$ProductPort/'
FunctionEnd

Section "Uninstall"
    SetShellVarContext all
    nsExec::ExecToLog '"$INSTDIR\runtime\apache\bin\httpd.exe" -k stop -n "${SERVICE_NAME}"'
    nsExec::ExecToLog '"$INSTDIR\runtime\apache\bin\httpd.exe" -k uninstall -n "${SERVICE_NAME}"'
    nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="${PRODUCT_NAME}"'

    Delete "$DESKTOP\${PRODUCT_NAME}.lnk"
    RMDir /r "$SMPROGRAMS\${PRODUCT_NAME}"
    RMDir /r "$INSTDIR"
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\PicoDmxController"
    DeleteRegKey HKLM "Software\PicoDmxController"

    MessageBox MB_ICONINFORMATION "Your shows and fixture data were preserved in:$\r$\n$APPDATA\${PRODUCT_NAME}\data"
SectionEnd
