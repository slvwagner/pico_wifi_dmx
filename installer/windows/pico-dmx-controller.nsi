Unicode True
RequestExecutionLevel admin
SetCompressor /SOLID lzma

!include "MUI2.nsh"
!include "LogicLib.nsh"

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
!define PRODUCT_PORT "8090"

Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "${OUTPUT_FILE}"
InstallDir "$PROGRAMFILES64\${PRODUCT_NAME}"
InstallDirRegKey HKLM "Software\PicoDmxController" "InstallDir"

Var ListenAddress
Var DataDir

!define MUI_ABORTWARNING
!define MUI_ICON "${STAGE_DIR}\app\assets\favicon.ico"
!define MUI_UNICON "${STAGE_DIR}\app\assets\favicon.ico"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "${STAGE_DIR}\LICENSE"
!insertmacro MUI_PAGE_DIRECTORY
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
FunctionEnd

Section /o "Allow access from iPads and PCs on the private network" SEC_LAN
    StrCpy $ListenAddress "0.0.0.0"
SectionEnd

Section "-Pico DMX Controller" SEC_CORE
    SetShellVarContext all

    nsExec::ExecToLog '"$INSTDIR\runtime\apache\bin\httpd.exe" -k stop -n "${SERVICE_NAME}"'
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

    nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\support\configure_install.ps1" -InstallDir "$INSTDIR" -DataDir "$DataDir" -ListenAddress "$ListenAddress" -Port ${PRODUCT_PORT}'
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
        nsExec::ExecToLog 'netsh advfirewall firewall add rule name="${PRODUCT_NAME}" dir=in action=allow protocol=TCP localport=${PRODUCT_PORT} profile=private program="$INSTDIR\runtime\apache\bin\httpd.exe"'
    ${Else}
        nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="${PRODUCT_NAME}"'
    ${EndIf}

    WriteRegStr HKLM "Software\PicoDmxController" "InstallDir" "$INSTDIR"
    WriteRegStr HKLM "Software\PicoDmxController" "Version" "${PRODUCT_VERSION}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\PicoDmxController" "DisplayName" "${PRODUCT_NAME}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\PicoDmxController" "DisplayVersion" "${PRODUCT_VERSION}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\PicoDmxController" "Publisher" "Pico DMX"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\PicoDmxController" "InstallLocation" "$INSTDIR"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\PicoDmxController" "UninstallString" '"$INSTDIR\Uninstall.exe"'
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\PicoDmxController" "NoModify" 1
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\PicoDmxController" "NoRepair" 1

    WriteUninstaller "$INSTDIR\Uninstall.exe"
    CreateDirectory "$SMPROGRAMS\${PRODUCT_NAME}"
    CreateShortcut "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk" "$INSTDIR\shell\PicoDmxShell.exe" '--url http://localhost:${PRODUCT_PORT}/' "$INSTDIR\shell\PicoDmxShell.exe"
    CreateShortcut "$SMPROGRAMS\${PRODUCT_NAME}\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
    CreateShortcut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\shell\PicoDmxShell.exe" '--url http://localhost:${PRODUCT_PORT}/' "$INSTDIR\shell\PicoDmxShell.exe"
SectionEnd

Function LaunchController
    Exec '"$INSTDIR\shell\PicoDmxShell.exe" --url http://localhost:${PRODUCT_PORT}/'
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
