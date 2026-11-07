import UIKit
import Capacitor
import GoogleSignIn
import CryptoKit

// A real SDK bridge; configuration comes only from the reviewed app bundle, never web caller input.
@objc(LumenGoogleAuthPlugin)
final class LumenGoogleAuthPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "LumenGoogleAuthPlugin"
    let jsName = "LumenGoogleAuth"
    let pluginMethods = ["signIn", "restore", "signOut", "revoke", "cancel"].map {
        CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise)
    }
    private var generation = 0
    private var operation = false
    private var pending: CAPPluginCall?
    private let vault = NativeSessionVault()
    private var configuration: [String: String]? {
        guard let c = Bundle.main.object(forInfoDictionaryKey: "LumenTestServices") as? [String: String],
              c["mode"] == "isolated-test", c["projectId"] != "the-model-router",
              c["bundleId"] == "io.github.seifonyx.lumen.demo", c["signedBundleId"] == Bundle.main.bundleIdentifier,
              c["iosClientId"]?.hasSuffix(".apps.googleusercontent.com") == true else { return nil }
        return c
    }
    private func allowed(_ call: CAPPluginCall) -> Bool {
        guard configuration != nil else {
            let test = (Bundle.main.object(forInfoDictionaryKey: "LumenTestServices") as? [String: String])?["mode"] == "isolated-test"
            call.reject(test ? "Test sign-in configuration does not match this installed app." : "Real sign-in is disabled in the offline demo.", test ? "AUTH_CONFIG" : "OFFLINE_DEMO"); return false
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
            let code = (error as NSError?)?.code
            if code == -4 { call.resolve(["signedIn": false]); return }
            GIDSignIn.sharedInstance.signOut()
            call.reject(code == -5 ? "Google sign-in canceled." : "Google sign-in could not be completed.", code == -5 ? "AUTH_CANCELED" : "AUTH_FAILED"); return
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
            guard let ticket = self.begin(call), let presenter = self.bridge?.viewController else { return }
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
          c["mode"] == "isolated-test", url.scheme == c["callbackScheme"] else { return false }
    guard url.host == nil || url.host == "", url.path == "/oauth2callback", url.fragment == nil,
          let parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
          parts.queryItems?.filter({ $0.name == "state" }).count == 1 else { return true }
    _ = GIDSignIn.sharedInstance.handle(url) // SDK/AppAuth checks pending state, nonce and PKCE; no manual token trust.
    return true
}
