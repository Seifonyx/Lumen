import UIKit
import WebKit
import Capacitor

// The CapacitorHttp setting disables fetch patching, not direct native RPC calls.
// Replace the built-in HTTP bridge too, so demonstration traffic cannot bypass WebKit's policy.
@objc(OfflineHttpPlugin)
final class OfflineHttpPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "OfflineHttpPlugin"
    let jsName = "CapacitorHttp"
    let pluginMethods: [CAPPluginMethod] = ["request", "get", "post", "put", "patch", "delete"].compactMap {
        CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise)
    }
    @objc func request(_ call: CAPPluginCall) { call.reject("Native networking is unavailable in this offline demo.", "OFFLINE_DEMO") }
    @objc func get(_ call: CAPPluginCall) { request(call) }
    @objc func post(_ call: CAPPluginCall) { request(call) }
    @objc func put(_ call: CAPPluginCall) { request(call) }
    @objc func patch(_ call: CAPPluginCall) { request(call) }
    @objc func delete(_ call: CAPPluginCall) { request(call) }
}

// Retain Capacitor's lifecycle, dialogs and scroll delegation, while denying external navigation and capture.
final class OfflineDelegate: NSObject, WKNavigationDelegate, WKUIDelegate {
    weak var navigation: WKNavigationDelegate?
    weak var ui: WKUIDelegate?
    override func responds(to selector: Selector!) -> Bool {
        super.responds(to: selector) || navigation?.responds(to: selector) == true || ui?.responds(to: selector) == true
    }
    override func forwardingTarget(for selector: Selector!) -> Any? {
        if navigation?.responds(to: selector) == true { return navigation }
        if ui?.responds(to: selector) == true { return ui }
        return super.forwardingTarget(for: selector)
    }
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url, url.scheme == "capacitor", url.host == "localhost",
              !url.path.hasPrefix("/_capacitor_http_interceptor_") else {
            decisionHandler(.cancel)
            return
        }
        if navigation?.responds(to: NSSelectorFromString("webView:decidePolicyForNavigationAction:decisionHandler:")) == true {
            navigation?.webView?(webView, decidePolicyFor: action, decisionHandler: decisionHandler)
        } else {
            decisionHandler(.allow)
        }
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? { nil }
    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) { decisionHandler(.deny) }
    func webView(_ webView: WKWebView, requestDeviceOrientationAndMotionPermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, decisionHandler: @escaping (WKPermissionDecision) -> Void) { decisionHandler(.deny) }
}

@objc(DemoViewController)
final class DemoViewController: CAPBridgeViewController, WKScriptMessageHandler {
    private let offlineDelegate = OfflineDelegate()
    private let smoke = ProcessInfo.processInfo.arguments.contains("--demo-smoke")
    override func capacitorDidLoad() {
        NSLog("LumenDemo custom controller loaded")
        bridge?.registerPluginInstance(OfflineHttpPlugin())
        guard let webView = webView else { return }
        offlineDelegate.navigation = webView.navigationDelegate
        offlineDelegate.ui = webView.uiDelegate
        webView.navigationDelegate = offlineDelegate
        webView.uiDelegate = offlineDelegate
        webView.allowsBackForwardNavigationGestures = false
        let controller = webView.configuration.userContentController
        controller.add(self, name: "nativeDownload")
        if smoke {
            // Diagnostic: proves the launch argument reached the app (Simulator evidence, smoke builds only).
            let marker = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("smoke-launched.txt")
            try? Data("launched".utf8).write(to: marker)
            NSLog("LumenDemo smoke mode")
            controller.add(self, name: "nativeSmoke")
            controller.addUserScript(WKUserScript(source: "window.__nativeSmoke=true;", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
    }
    // No document loads until WebKit has installed a default-deny network rule.
    override func viewDidLoad() {
        let rules = #"[{"trigger":{"url-filter":"^https?://"},"action":{"type":"block"}},{"trigger":{"url-filter":"^wss?://"},"action":{"type":"block"}}]"#
        WKContentRuleListStore.default().compileContentRuleList(forIdentifier: "LumenOfflineDemo", encodedContentRuleList: rules) { [weak self] rule, _ in
            guard let self = self else { return }
            guard let rule = rule else {
                let label = UILabel(frame: self.view.bounds)
                label.text = "Offline protection could not load. Relaunch Lumen Demo."
                label.numberOfLines = 0
                self.view.addSubview(label)
                return
            }
            self.finishLoading(rule)
        }
    }
    private func finishLoading(_ rule: WKContentRuleList) {
        webView?.configuration.userContentController.add(rule)
        super.viewDidLoad()
    }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, message.frameInfo.securityOrigin.protocol == "capacitor",
              message.frameInfo.securityOrigin.host == "localhost", let data = message.body as? [String: Any] else { return }
        if message.name == "nativeSmoke", smoke {
            let directory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            if let stage = data["stage"] as? String, stage.range(of: "^[a-z-]+$", options: .regularExpression) != nil {
                let image = UIGraphicsImageRenderer(bounds: view.bounds).image { _ in view.drawHierarchy(in: view.bounds, afterScreenUpdates: true) }
                try? image.pngData()?.write(to: directory.appendingPathComponent(stage + ".png"))
            }
            if data["done"] as? Bool == true, let json = try? JSONSerialization.data(withJSONObject: data, options: .prettyPrinted) {
                try? json.write(to: directory.appendingPathComponent("native-smoke.json"))
            }
        }
        if message.name == "nativeDownload", let name = data["name"] as? String,
           let base64 = data["data"] as? String, base64.count <= 14_000_000,
           let bytes = Data(base64Encoded: base64), bytes.count <= 10_000_000 {
            let safeName = URL(fileURLWithPath: name).lastPathComponent
            guard !safeName.isEmpty, !safeName.hasPrefix(".") else { return }
            let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
            do {
                try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
                let file = folder.appendingPathComponent(safeName)
                try bytes.write(to: file)
                let sheet = UIActivityViewController(activityItems: [file], applicationActivities: nil)
                sheet.popoverPresentationController?.sourceView = view
                sheet.completionWithItemsHandler = { _, _, _, _ in try? FileManager.default.removeItem(at: folder) }
                present(sheet, animated: true)
            } catch { /* Export remains local. The demo guide records its size limit. */ }
        }
    }
}
