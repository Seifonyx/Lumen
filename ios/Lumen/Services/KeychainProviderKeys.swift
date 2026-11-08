import Foundation
import Security
import LumenCore

@MainActor final class KeychainProviderKeys: ProviderKeyStore {
    private let service = "io.github.seifonyx.lumen.provider-keys"
    private func query(providerID: String, accountID: String) -> [String: Any] {
        [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
         kSecAttrAccount as String: accountID + ":" + providerID,
         kSecUseDataProtectionKeychain as String: true]
    }
    func key(providerID: String, accountID: String) throws -> String? {
        var query = query(providerID: providerID, accountID: accountID)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var value: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &value)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = value as? Data, let key = String(data: data, encoding: .utf8) else { throw KeychainError(status: status) }
        return key
    }
    func setKey(_ key: String?, providerID: String, accountID: String) throws {
        let query = query(providerID: providerID, accountID: accountID)
        guard let key else {
            let status = SecItemDelete(query as CFDictionary)
            guard status == errSecSuccess || status == errSecItemNotFound else { throw KeychainError(status: status) }
            return
        }
        let attributes: [String: Any] = [kSecValueData as String: Data(key.utf8),
                                         kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
        let status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            let status = SecItemAdd(query.merging(attributes) { _, new in new } as CFDictionary, nil)
            guard status == errSecSuccess else { throw KeychainError(status: status) }
        } else if status != errSecSuccess { throw KeychainError(status: status) }
    }
    func migrateLegacyKey(defaults: UserDefaults = .standard) {
        guard let key = defaults.string(forKey: "lumen.api-key"), !key.isEmpty else { return }
        do {
            try setKey(key, providerID: "legacy", accountID: "device")
            defaults.removeObject(forKey: "lumen.api-key")
        } catch { /* Keep the only copy until Keychain is available. */ }
    }
}
private struct KeychainError: Error { let status: OSStatus }
