import UIKit
import Capacitor
import GoogleSignIn
import CryptoKit

// A real SDK bridge; configuration comes only from the reviewed app bundle, never web caller input.
@objc(LumenGoogleAuthPlugin)
final class LumenGoogleAuthPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "LumenGoogleAuthPlugin"
    let jsName = "LumenGoogleAuth"
    // CAPPluginMethod has a failable initializer; Capacitor requires a non-optional method array.
    let pluginMethods: [CAPPluginMethod] = ["signIn", "restore", "signOut", "revoke", "cancel"].compactMap {
        CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise)
    }
    private var generation = 0
    private var operation = false
    private var pending: CAPPluginCall?
    private let vault = NativeSessionVault()
    private var configuration: [String: String]? {
        guard let c = Bundle.main.object(forInfoDictionaryKey: "LumenTestServices") as? [String: String],
              ((c["mode"] == "isolated-test" && c["projectId"] != "the-model-router") || (c["mode"] == "account-connected" && c["projectId"] == "the-model-router")),
              c["bundleId"] == "io.github.seifonyx.lumen.demo", c["signedBundleId"] == Bundle.main.bundleIdentifier,
              c["iosClientId"]?.hasSuffix(".apps.googleusercontent.com") == true else { return nil }
        return c
    }
    private func allowed(_ call: CAPPluginCall) -> Bool {
        if let c = Bundle.main.object(forInfoDictionaryKey: "LumenTestServices") as? [String: String],
           ["isolated-test", "account-connected"].contains(c["mode"] ?? ""), c["signedBundleId"] != Bundle.main.bundleIdentifier {
            call.reject("Installed signing identity does not match the approved sign-in configuration.", "AUTH_SIGNING"); return false
        }
        guard configuration != nil else {
            let test = (Bundle.main.object(forInfoDictionaryKey: "LumenTestServices") as? [String: String]).map { ["isolated-test", "account-connected"].contains($0["mode"] ?? "") } == true
            call.reject(test ? "Sign-in configuration does not match this installed app." : "Real sign-in is disabled in the offline demo.", test ? "AUTH_CONFIG" : "OFFLINE_DEMO"); return false
        }
        let c = configuration!
        let schemes = (Bundle.main.object(forInfoDictionaryKey: "CFBundleURLTypes") as? [[String: Any]])?
            .flatMap { $0["CFBundleURLSchemes"] as? [String] ?? [] } ?? []
        let expected = c["iosClientId"]!.components(separatedBy: ".").reversed().joined(separator: ".")
        guard c["callbackScheme"] == expected, schemes.contains(expected) else {
            call.reject("The configured Google callback is not registered in this app.", "AUTH_CALLBACK_CONFIG"); return false
        }
        guard bridge?.webView?.url?.scheme == "capacitor", bridge?.webView?.url?.host == "localhost" else {
            call.reject("Untrusted authentication caller.", "AUTH_ORIGIN"); return false
        }
        return true
    }
    private func begin(_ call: CAPPluginCall) -> Int? {
        guard allowed(call) else { return nil }
        guard !operation else { call.reject("Close the current Google sign-in before trying again.", "AUTH_BUSY"); return nil }
        operation = true; generation += 1; pending = call
        let c = configuration!
        GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: c["iosClientId"]!, serverClientID: c["webClientId"])
        return generation
    }
    private func complete(_ user: GIDGoogleUser?, _ error: Error?, _ ticket: Int, _ nonce: String?) {
        operation = false
        guard ticket == generation else { GIDSignIn.sharedInstance.signOut(); return }
        guard let call = pending else { return }; pending = nil
        guard error == nil, let user = user, let owner = user.userID, let token = user.idToken?.tokenString else {
            // Do not expose SDK error details, callback URLs or credentials to logs/UI.
            let sdkError = error as NSError?
            let code = sdkError?.domain == "com.google.GIDSignIn" ? sdkError?.code : nil
            if code == -4, nonce == nil { call.resolve(["signedIn": false]); return }
            GIDSignIn.sharedInstance.signOut()
            let failure: String
            if code == -5 { failure = "AUTH_CANCELED" }
            else if code == -2 { failure = "AUTH_STORAGE" }
            else if code == -6 { failure = "AUTH_GOOGLE_POLICY" }
            else if sdkError?.domain == NSURLErrorDomain || (sdkError?.userInfo[NSUnderlyingErrorKey] as? NSError)?.domain == NSURLErrorDomain { failure = "AUTH_GOOGLE_NETWORK" }
            else { failure = "AUTH_GOOGLE" }
            call.reject("Google sign-in could not be completed.", failure); return
        }
        do {
            let raw: String?
            if let nonce = nonce { raw = nonce } else { raw = try vault.read(owner: owner).flatMap { String(data: $0, encoding: .utf8) } }
            if let nonce = nonce { try vault.store(owner: owner, data: Data(nonce.utf8)) }
            var result: [String: Any] = ["signedIn": true, "idToken": token]
            if let raw = raw { result["rawNonce"] = raw }
            call.resolve(result) // Short-lived credential, memory-only. SDK owns durable Google tokens in Keychain.
        } catch {
            GIDSignIn.sharedInstance.signOut(); call.reject("Secure session storage is unavailable.", "AUTH_STORAGE")
        }
    }
    @objc func signIn(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let presenter = self.bridge?.viewController else { call.reject("Google sign-in cannot be presented.", "AUTH_PRESENTATION"); return }
            guard let ticket = self.begin(call) else { return }
            let nonce = UUID().uuidString + UUID().uuidString
            let hash = SHA256.hash(data: Data(nonce.utf8)).map { String(format: "%02x", $0) }.joined()
            GIDSignIn.sharedInstance.signIn(withPresenting: presenter, hint: nil, additionalScopes: nil, nonce: hash) { result, error in
                self.complete(result?.user, error, ticket, nonce)
            }
        }
    }
    @objc func restore(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let ticket = self.begin(call) else { return }
            GIDSignIn.sharedInstance.restorePreviousSignIn { user, error in self.complete(user, error, ticket, nil) }
        }
    }
    private func invalidate() {
        generation += 1; pending?.reject("Sign-in canceled.", "AUTH_CANCELED"); pending = nil
        if let owner = GIDSignIn.sharedInstance.currentUser?.userID { try? vault.forget(owner: owner) }
        GIDSignIn.sharedInstance.signOut()
        // Google SDK exposes system-sheet cancellation to its UI. Keep the operation lock until its callback.
    }
    @objc func cancel(_ call: CAPPluginCall) { DispatchQueue.main.async { guard self.allowed(call) else { return }; self.invalidate(); call.resolve() } }
    @objc func signOut(_ call: CAPPluginCall) { cancel(call) }
    @objc func revoke(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.allowed(call), !self.operation else { if self.operation { call.reject("Close Google sign-in first.", "AUTH_BUSY") }; return }
            self.operation = true; self.generation += 1
            let ticket = self.generation
            let owner = GIDSignIn.sharedInstance.currentUser?.userID
            self.pending = call
            GIDSignIn.sharedInstance.disconnect { error in
                self.operation = false
                guard ticket == self.generation else { return }
                self.pending = nil
                if error != nil { call.reject("Google access could not be revoked. Try again.", "AUTH_REVOKE") }
                else {
                    if let owner = owner { try? self.vault.forget(owner: owner) }
                    call.resolve()
                }
            }
        }
    }
}

// Consume SDK-owned callbacks even if invalid/replayed; never forward credential-bearing URLs to Canvas.
func LumenHandleGoogleURL(_ url: URL) -> Bool {
    guard let c = Bundle.main.object(forInfoDictionaryKey: "LumenTestServices") as? [String: String],
          ((c["mode"] == "isolated-test" && c["projectId"] != "the-model-router") || (c["mode"] == "account-connected" && c["projectId"] == "the-model-router")), url.scheme == c["callbackScheme"] else { return false }
    guard url.host == nil || url.host == "", url.path == "/oauth2callback", url.fragment == nil,
          let parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
          parts.queryItems?.filter({ $0.name == "state" }).count == 1 else { return true }
    _ = GIDSignIn.sharedInstance.handle(url) // SDK/AppAuth checks pending state, nonce and PKCE; no manual token trust.
    return true
}
