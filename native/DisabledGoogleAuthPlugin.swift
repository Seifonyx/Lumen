import Foundation
import Capacitor

// Zero-dependency offline bridge: preserve the smoke-test API without linking GoogleSignIn.
// Never present an auth UI, open a URL, or access the network in an offline IPA.
@objc(LumenGoogleAuthPlugin)
final class LumenGoogleAuthPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "LumenGoogleAuthPlugin"
    let jsName = "LumenGoogleAuth"
    // CAPPluginMethod has a failable initializer; Capacitor requires a non-optional method array.
    let pluginMethods: [CAPPluginMethod] = ["signIn", "restore", "signOut", "revoke", "cancel"].compactMap {
        CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise)
    }
    private func reject(_ call: CAPPluginCall) {
        call.reject("Real sign-in is disabled in the offline demo.", "OFFLINE_DEMO")
    }
    @objc func signIn(_ call: CAPPluginCall) { reject(call) }
    @objc func restore(_ call: CAPPluginCall) { reject(call) }
    @objc func signOut(_ call: CAPPluginCall) { reject(call) }
    @objc func revoke(_ call: CAPPluginCall) { reject(call) }
    @objc func cancel(_ call: CAPPluginCall) { reject(call) }
}

// The offline SceneDelegate forwards no external OAuth callbacks.
func LumenHandleGoogleURL(_ url: URL) -> Bool { return false }
