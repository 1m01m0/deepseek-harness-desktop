import AppKit
import WebKit
import Darwin
import Sparkle

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate {
    private var window: NSWindow!
    private var webView: WKWebView!
    private var serverTask: Process?
    private var readyPort: Int?
    private var updater: SPUStandardUpdaterController!

    // MARK: - App lifecycle

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Sparkle 自动检查更新（SUFeedURL/SUPublicEDKey 在 Info.plist）；
        // 菜单栏「检查更新…」提供手动检查。
        updater = SPUStandardUpdaterController(
            startingUpdater: true,
            updaterDelegate: nil,
            userDriverDelegate: nil
        )
        buildMenu()
        makeWindow()
        NSApp.activate(ignoringOtherApps: true)
        startServer()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    func applicationWillTerminate(_ notification: Notification) {
        stopServer()
    }

    // MARK: - Bundled resources

    private var resources: URL { Bundle.main.resourceURL! }

    private var nodeBinary: URL {
        resources.appendingPathComponent("runtime/node/bin/node")
    }

    private var dshEntry: URL {
        resources.appendingPathComponent("dsh/node_modules/@deepseek-ai/dsh/lib/bin.js")
    }

    private var dshHome: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        return base.appendingPathComponent("DeepSeek Harness/dsh")
    }

    // MARK: - Window

    private func makeWindow() {
        let rect = NSRect(x: 0, y: 0, width: 1280, height: 820)
        window = NSWindow(
            contentRect: rect,
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "DeepSeek Harness"
        window.minSize = NSSize(width: 860, height: 560)
        window.center()
        window.isReleasedWhenClosed = false

        let config = WKWebViewConfiguration()
        webView = WKWebView(frame: rect, configuration: config)
        webView.autoresizingMask = [.width, .height]
        webView.navigationDelegate = self
        window.contentView = webView
        window.makeKeyAndOrderFront(nil)
    }

    private func buildMenu() {
        let mainMenu = NSMenu()
        let appItem = NSMenuItem()
        mainMenu.addItem(appItem)
        let appMenu = NSMenu()
        appMenu.addItem(NSMenuItem(
            title: "关于 DeepSeek Harness",
            action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)),
            keyEquivalent: ""
        ))
        appMenu.addItem(.separator())
        let checkUpdateItem = NSMenuItem(
            title: "检查更新…",
            action: #selector(AppDelegate.checkForUpdates(_:)),
            keyEquivalent: ""
        )
        checkUpdateItem.target = self
        appMenu.addItem(checkUpdateItem)
        appMenu.addItem(.separator())
        appMenu.addItem(NSMenuItem(
            title: "退出 DeepSeek Harness",
            action: #selector(NSApplication.terminate(_:)),
            keyEquivalent: "q"
        ))
        appItem.submenu = appMenu

        // WKWebView 通过 responder chain 处理编辑命令：菜单栏里必须有「编辑」
        // 菜单把 ⌘Z/⌘X/⌘C/⌘V/⌘A 路由到 undo:/cut:/copy:/paste:/selectAll:，
        // 否则键盘快捷键全部失效（只能靠网页自身的右键菜单）。
        let editItem = NSMenuItem()
        mainMenu.addItem(editItem)
        let editMenu = NSMenu(title: "编辑")
        editMenu.addItem(withTitle: "撤销", action: Selector(("undo:")), keyEquivalent: "z")
        editMenu.addItem(withTitle: "重做", action: Selector(("redo:")), keyEquivalent: "Z")
        editMenu.addItem(.separator())
        editMenu.addItem(withTitle: "剪切", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "复制", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "粘贴", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(.separator())
        editMenu.addItem(withTitle: "全选", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editItem.submenu = editMenu

        NSApp.mainMenu = mainMenu
    }

    @objc private func checkForUpdates(_ sender: Any?) {
        updater.checkForUpdates(sender)
    }

    // MARK: - Server lifecycle

    private func startServer() {
        guard serverTask == nil else { return }
        readyPort = nil
        showSplash("正在启动 DeepSeek Harness…")

        do {
            try FileManager.default.createDirectory(at: dshHome, withIntermediateDirectories: true)
        } catch {
            showError("无法创建数据目录 \(dshHome.path)：\(error.localizedDescription)")
            return
        }
        guard FileManager.default.isExecutableFile(atPath: nodeBinary.path) else {
            showError("缺少内置 Node 运行时：\(nodeBinary.path)")
            return
        }
        guard FileManager.default.fileExists(atPath: dshEntry.path) else {
            showError("缺少 dsh 运行时：\(dshEntry.path)")
            return
        }

        let nodeDir = resources.appendingPathComponent("runtime/node/bin").path
        var env = ProcessInfo.processInfo.environment
        env["DSH_HOME"] = dshHome.path
        env["DSH_TELEMETRY_DISABLED"] = "1"
        env["PATH"] = "\(nodeDir):/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin"

        let pipe = Pipe()
        let proc = Process()
        proc.executableURL = nodeBinary
        proc.arguments = [dshEntry.path, "web", "--port", "0"]
        proc.currentDirectoryURL = FileManager.default.homeDirectoryForCurrentUser
        proc.environment = env
        proc.standardOutput = pipe
        proc.standardError = pipe

        proc.terminationHandler = { [weak self] proc in
            DispatchQueue.main.async {
                guard let self else { return }
                self.serverTask = nil
                let hadServed = self.readyPort != nil
                self.readyPort = nil
                if hadServed {
                    self.showError("DeepSeek Harness 服务已停止（退出码 \(proc.terminationStatus)）。")
                } else {
                    self.showError("DeepSeek Harness 服务启动失败（退出码 \(proc.terminationStatus)）。")
                }
            }
        }

        do {
            try proc.run()
        } catch {
            showError("无法启动服务：\(error.localizedDescription)")
            return
        }
        serverTask = proc
        watchForReadiness(pipe: pipe)
    }

    private func watchForReadiness(pipe: Pipe) {
        var buffer = ""
        pipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard let self else { return }
            if data.isEmpty {
                handle.readabilityHandler = nil
                return
            }
            buffer += String(data: data, encoding: .utf8) ?? ""
            guard let port = Self.parsePort(from: buffer) else { return }
            DispatchQueue.main.async {
                guard self.serverTask != nil, self.readyPort == nil else { return }
                self.readyPort = port
                self.loadServer()
            }
        }
    }

    private static func parsePort(from text: String) -> Int? {
        guard let range = text.range(of: #"http://127\.0\.0\.1:\d+"#, options: .regularExpression) else {
            return nil
        }
        let match = text[range]
        guard let portString = match.split(separator: ":").last else { return nil }
        return Int(portString)
    }

    private func loadServer() {
        guard let port = readyPort else { return }
        webView.load(URLRequest(url: URL(string: "http://127.0.0.1:\(port)/")!))
    }

    private func stopServer() {
        guard let proc = serverTask else { return }
        proc.terminate()  // SIGTERM — dsh disposes its tree and exits 0
        for _ in 0..<50 {
            if !proc.isRunning { break }
            usleep(100_000)
        }
        if proc.isRunning {
            kill(proc.processIdentifier, SIGKILL)
            proc.waitUntilExit()
        }
        serverTask = nil
    }

    // MARK: - Splash / error pages

    private func showSplash(_ message: String) {
        loadInlinePage("""
        <div class="msg">\(htmlEscaped(message))</div>
        """)
    }

    private func showError(_ message: String) {
        loadInlinePage("""
        <div class="msg">\(htmlEscaped(message))</div>
        <a href="dsh://retry">重新启动</a>
        """)
    }

    private func loadInlinePage(_ body: String) {
        let html = """
        <!DOCTYPE html><html><head><meta charset="utf-8">
        <style>
          body { font-family: -apple-system, "PingFang SC", sans-serif; background: #fafafa;
                 color: #222; display: flex; align-items: center; justify-content: center;
                 height: 100vh; margin: 0; }
          .msg { font-size: 14px; color: #555; text-align: center; max-width: 520px;
                 margin-bottom: 18px; word-break: break-all; }
          a { display: inline-block; padding: 8px 18px; border-radius: 6px;
              background: #1f6feb; color: #fff; text-decoration: none; font-size: 14px; }
        </style></head><body>\(body)</body></html>
        """
        if let data = html.data(using: .utf8) {
            webView.load(data, mimeType: "text/html", characterEncodingName: "utf-8", baseURL: URL(fileURLWithPath: "/"))
        }
    }

    private func htmlEscaped(_ text: String) -> String {
        text
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\"", with: "&quot;")
    }

    // MARK: - WKNavigationDelegate

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }
        if url.scheme == "dsh" {
            if url.host == "retry" { startServer() }
            decisionHandler(.cancel)
            return
        }
        if let scheme = url.scheme?.lowercased(),
           (scheme == "http" || scheme == "https"),
           url.host != "127.0.0.1", url.host != "localhost" {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
