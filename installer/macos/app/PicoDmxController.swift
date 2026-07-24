import Cocoa
import Darwin
import WebKit

private let productName = "WiFiPicoDMX"
private let serviceLabel = "com.picodmx.controller.server"

private enum ExitChoice {
    case exitOnly
    case exitAndStopServer
    case cancel
}

private struct ControllerConfig: Codable, Equatable {
    var port: Int = 8090
    var allowLAN: Bool = false

    var listenAddress: String { allowLAN ? "0.0.0.0" : "127.0.0.1" }
    var localURL: URL { URL(string: "http://127.0.0.1:\(port)/")! }
}

private final class ControllerPaths {
    let home = FileManager.default.homeDirectoryForCurrentUser
    lazy var support = home.appendingPathComponent("Library/Application Support/Pico DMX Controller", isDirectory: true)
    lazy var data = support.appendingPathComponent("data", isDirectory: true)
    lazy var backups = support.appendingPathComponent("backups", isDirectory: true)
    lazy var logs = support.appendingPathComponent("logs", isDirectory: true)
    lazy var config = support.appendingPathComponent("config.json")
    lazy var versionState = support.appendingPathComponent(".installed-version")
    lazy var launchAgents = home.appendingPathComponent("Library/LaunchAgents", isDirectory: true)
    lazy var launchAgent = launchAgents.appendingPathComponent("\(serviceLabel).plist")

    let resources = Bundle.main.resourceURL!
    lazy var appRoot = resources.appendingPathComponent("app", isDirectory: true)
    lazy var php = resources.appendingPathComponent("runtime/php")
    lazy var router = resources.appendingPathComponent("support/router.php")
}

private final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate {
    private let paths = ControllerPaths()
    private var config = ControllerConfig()
    private var window: NSWindow!
    private var webView: WKWebView!
    private var statusLabel: NSTextField!
    private var terminationApproved = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.appearance = NSAppearance(named: .darkAqua)
        buildMenu()
        buildWindow()

        let hadConfig = FileManager.default.fileExists(atPath: paths.config.path)
        config = loadConfig()
        preparePersistentStorage()
        createUpgradeSnapshotIfNeeded()

        if !hadConfig && !showSettings(initialSetup: true) {
            terminationApproved = true
            NSApp.terminate(nil)
            return
        }

        installAndStartLaunchAgent()
        openControllerWhenReady()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        false
    }

    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        if terminationApproved {
            return .terminateNow
        }

        switch showExitChoice() {
        case .exitOnly:
            terminationApproved = true
            return .terminateNow
        case .exitAndStopServer:
            stopLaunchAgent()
            terminationApproved = true
            return .terminateNow
        case .cancel:
            return .terminateCancel
        }
    }

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        if terminationApproved {
            return true
        }
        NSApp.terminate(nil)
        return false
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        window.makeKeyAndOrderFront(nil)
        return true
    }

    private func buildMenu() {
        let main = NSMenu()
        let applicationItem = NSMenuItem()
        main.addItem(applicationItem)
        let applicationMenu = NSMenu()
        applicationMenu.addItem(withTitle: "About \(productName)", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        applicationMenu.addItem(NSMenuItem.separator())
        let settingsItem = applicationMenu.addItem(withTitle: "Controller Settings…", action: #selector(openSettings), keyEquivalent: ",")
        settingsItem.target = self
        let reloadItem = applicationMenu.addItem(withTitle: "Reload Controller", action: #selector(reloadController), keyEquivalent: "r")
        reloadItem.target = self
        let fullScreenItem = applicationMenu.addItem(withTitle: "Toggle Full Screen", action: #selector(toggleFullScreen), keyEquivalent: "f")
        fullScreenItem.target = self
        fullScreenItem.keyEquivalentModifierMask = [.command, .control]
        applicationMenu.addItem(NSMenuItem.separator())
        applicationMenu.addItem(withTitle: "Quit \(productName)", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        applicationItem.submenu = applicationMenu
        NSApp.mainMenu = main
    }

    private func buildWindow() {
        let frame = NSRect(x: 0, y: 0, width: 1280, height: 820)
        window = NSWindow(
            contentRect: frame,
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        window.title = productName
        window.titlebarAppearsTransparent = true
        window.backgroundColor = NSColor(calibratedWhite: 0.08, alpha: 1)
        window.minSize = NSSize(width: 860, height: 600)
        window.delegate = self
        window.center()

        let content = NSView()
        content.translatesAutoresizingMaskIntoConstraints = false
        window.contentView = content

        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.navigationDelegate = self
        webView.underPageBackgroundColor = .clear

        statusLabel = NSTextField(labelWithString: "When closing, choose whether the controller server should keep running.")
        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        statusLabel.textColor = NSColor(calibratedWhite: 0.78, alpha: 1)
        statusLabel.backgroundColor = NSColor(calibratedWhite: 0.11, alpha: 1)
        statusLabel.alignment = .center

        content.addSubview(webView)
        content.addSubview(statusLabel)
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: content.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: content.trailingAnchor),
            webView.topAnchor.constraint(equalTo: content.topAnchor),
            webView.bottomAnchor.constraint(equalTo: statusLabel.topAnchor),
            statusLabel.leadingAnchor.constraint(equalTo: content.leadingAnchor),
            statusLabel.trailingAnchor.constraint(equalTo: content.trailingAnchor),
            statusLabel.bottomAnchor.constraint(equalTo: content.bottomAnchor),
            statusLabel.heightAnchor.constraint(equalToConstant: 24)
        ])
    }

    @objc private func openSettings() {
        _ = showSettings(initialSetup: false)
    }

    @objc private func reloadController() {
        webView.load(URLRequest(url: config.localURL))
    }

    @objc private func toggleFullScreen() {
        window.toggleFullScreen(nil)
    }

    private func showSettings(initialSetup: Bool) -> Bool {
        let alert = NSAlert()
        alert.messageText = initialSetup ? "Set up \(productName)" : "Controller Settings"
        alert.informativeText = "Choose an HTTP port from 1024 to 65535. Enable LAN access only for trusted iPads and PCs on the same private network."
        alert.alertStyle = .informational
        alert.addButton(withTitle: "Save")
        alert.addButton(withTitle: initialSetup ? "Quit" : "Cancel")

        let accessory = NSView(frame: NSRect(x: 0, y: 0, width: 430, height: 78))
        let portLabel = NSTextField(labelWithString: "HTTP port:")
        portLabel.frame = NSRect(x: 0, y: 50, width: 100, height: 22)
        let portField = NSTextField(string: String(config.port))
        portField.frame = NSRect(x: 105, y: 48, width: 110, height: 24)
        let lan = NSButton(checkboxWithTitle: "Allow access from trusted iPads and PCs", target: nil, action: nil)
        lan.frame = NSRect(x: 0, y: 10, width: 410, height: 24)
        lan.state = config.allowLAN ? .on : .off
        accessory.addSubview(portLabel)
        accessory.addSubview(portField)
        accessory.addSubview(lan)
        alert.accessoryView = accessory

        while alert.runModal() == .alertFirstButtonReturn {
            guard let port = Int(portField.stringValue), (1024...65535).contains(port) else {
                showError("The HTTP port must be a number from 1024 to 65535.")
                continue
            }
            let candidate = ControllerConfig(port: port, allowLAN: lan.state == .on)
            if (initialSetup || candidate.port != config.port) && !isPortAvailable(candidate.port) {
                showError("Port \(candidate.port) is already in use. Close the other application or choose another port.")
                continue
            }
            config = candidate
            do {
                try saveConfig()
                installAndStartLaunchAgent()
                openControllerWhenReady()
                return true
            } catch {
                showError("Could not save the controller settings: \(error.localizedDescription)")
            }
        }
        return false
    }

    private func preparePersistentStorage() {
        for directory in [paths.support, paths.data, paths.backups, paths.logs, paths.launchAgents] {
            try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        }
    }

    private func loadConfig() -> ControllerConfig {
        guard let contents = try? Data(contentsOf: paths.config),
              let decoded = try? JSONDecoder().decode(ControllerConfig.self, from: contents),
              (1024...65535).contains(decoded.port) else {
            return ControllerConfig()
        }
        return decoded
    }

    private func saveConfig() throws {
        preparePersistentStorage()
        let encoded = try JSONEncoder().encode(config)
        try encoded.write(to: paths.config, options: .atomic)
    }

    private func createUpgradeSnapshotIfNeeded() {
        let currentVersion = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "unknown"
        let previousVersion = (try? String(contentsOf: paths.versionState, encoding: .utf8))?.trimmingCharacters(in: .whitespacesAndNewlines)
        guard previousVersion != currentVersion else { return }

        if previousVersion != nil,
           let entries = try? FileManager.default.contentsOfDirectory(atPath: paths.data.path),
           !entries.isEmpty {
            let formatter = DateFormatter()
            formatter.dateFormat = "yyyyMMdd-HHmmss"
            formatter.locale = Locale(identifier: "en_US_POSIX")
            let destination = paths.backups.appendingPathComponent("before-\(currentVersion)-\(formatter.string(from: Date()))")
            try? FileManager.default.copyItem(at: paths.data, to: destination)
        }
        try? currentVersion.write(to: paths.versionState, atomically: true, encoding: .utf8)
    }

    private func installAndStartLaunchAgent() {
        preparePersistentStorage()
        let environment = [
            "PICO_DMX_APP_DIR": paths.appRoot.path,
            "PICO_DMX_DATA_DIR": paths.data.path,
            "PHP_CLI_SERVER_WORKERS": "4"
        ]
        let plist: [String: Any] = [
            "Label": serviceLabel,
            "ProgramArguments": [
                paths.php.path,
                "-d", "expose_php=0",
                "-d", "display_errors=0",
                "-d", "log_errors=1",
                "-S", "\(config.listenAddress):\(config.port)",
                paths.router.path
            ],
            "WorkingDirectory": paths.appRoot.path,
            "EnvironmentVariables": environment,
            "RunAtLoad": true,
            "KeepAlive": true,
            "ProcessType": "Background",
            "StandardOutPath": paths.logs.appendingPathComponent("server.log").path,
            "StandardErrorPath": paths.logs.appendingPathComponent("server-error.log").path
        ]

        do {
            let data = try PropertyListSerialization.data(fromPropertyList: plist, format: .xml, options: 0)
            try data.write(to: paths.launchAgent, options: .atomic)
            try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: paths.launchAgent.path)
            let domain = "gui/\(getuid())"
            _ = run("/bin/launchctl", ["bootout", domain, paths.launchAgent.path])
            let result = run("/bin/launchctl", ["bootstrap", domain, paths.launchAgent.path])
            if result != 0 {
                showError("The controller server could not be started. Check \(paths.logs.path) for details.")
            }
        } catch {
            showError("The controller service could not be configured: \(error.localizedDescription)")
        }
    }

    private func stopLaunchAgent() {
        let domain = "gui/\(getuid())"
        _ = run("/bin/launchctl", ["bootout", domain, paths.launchAgent.path])
    }

    private func showExitChoice() -> ExitChoice {
        let alert = NSAlert()
        alert.alertStyle = .informational
        alert.messageText = "How should \(productName) exit?"
        alert.informativeText = "Exit only keeps the server running for iPads and other operator devices.\n\nExit and stop server disconnects those devices."
        alert.addButton(withTitle: "Exit only")
        alert.addButton(withTitle: "Exit and stop server")
        alert.addButton(withTitle: "Cancel")

        switch alert.runModal() {
        case .alertFirstButtonReturn:
            return .exitOnly
        case .alertSecondButtonReturn:
            return .exitAndStopServer
        default:
            return .cancel
        }
    }

    private func run(_ executable: String, _ arguments: [String]) -> Int32 {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: executable)
        process.arguments = arguments
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice
        do {
            try process.run()
            process.waitUntilExit()
            return process.terminationStatus
        } catch {
            return -1
        }
    }

    private func isPortAvailable(_ port: Int) -> Bool {
        let descriptor = socket(AF_INET, SOCK_STREAM, 0)
        guard descriptor >= 0 else { return false }
        defer { Darwin.close(descriptor) }
        var address = sockaddr_in()
        address.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
        address.sin_family = sa_family_t(AF_INET)
        address.sin_port = in_port_t(port).bigEndian
        address.sin_addr = in_addr(s_addr: inet_addr("127.0.0.1"))
        return withUnsafePointer(to: &address) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                bind(descriptor, $0, socklen_t(MemoryLayout<sockaddr_in>.size)) == 0
            }
        }
    }

    private func openControllerWhenReady(attempt: Int = 0) {
        let request = URLRequest(url: config.localURL, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 1)
        URLSession.shared.dataTask(with: request) { [weak self] _, response, _ in
            DispatchQueue.main.async {
                guard let self else { return }
                if let http = response as? HTTPURLResponse, (200..<500).contains(http.statusCode) {
                    self.statusLabel.stringValue = self.config.allowLAN
                        ? "Server online on port \(self.config.port) · trusted LAN access enabled"
                        : "Server online on port \(self.config.port) · local access only"
                    self.webView.load(URLRequest(url: self.config.localURL))
                } else if attempt < 30 {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                        self.openControllerWhenReady(attempt: attempt + 1)
                    }
                } else {
                    self.statusLabel.stringValue = "Server did not start; check Controller Settings and the server log."
                }
            }
        }.resume()
    }

    private func showError(_ message: String) {
        let alert = NSAlert()
        alert.alertStyle = .critical
        alert.messageText = productName
        alert.informativeText = message
        alert.runModal()
    }
}

let application = NSApplication.shared
let delegate = AppDelegate()
application.delegate = delegate
application.setActivationPolicy(.regular)
application.run()
