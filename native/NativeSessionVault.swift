import Foundation
import Security

// Prepared native facility only. No web handler, real auth SDK, automatic writes or production secrets.
// A separately approved adapter must keep raw credentials native and return opaque references to Canvas.
enum NativeSessionVaultError: Error {
    case invalidOwner
    case keychain(OSStatus)
}
final class NativeSessionVault {
    private let service = "io.github.seifonyx.lumen.demo.session.foundation"
    private func query(_ owner: String) throws -> [String: Any] {
        guard !owner.isEmpty, owner.count <= 128 else { throw NativeSessionVaultError.invalidOwner }
        return [kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: service, kSecAttrAccount as String: owner]
    }
    func read(owner: String) throws -> Data? {
        var request = try query(owner)
        request[kSecReturnData as String] = true
        request[kSecMatchLimit as String] = kSecMatchLimitOne
        var value: CFTypeRef?
        let status = SecItemCopyMatching(request as CFDictionary, &value)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess else { throw NativeSessionVaultError.keychain(status) }
        return value as? Data
    }
    func store(owner: String, data: Data) throws {
        let request = try query(owner)
        let attributes: [String: Any] = [kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly]
        var status = SecItemUpdate(request as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            status = SecItemAdd(request.merging(attributes, uniquingKeysWith: { _, new in new }) as CFDictionary, nil)
        }
        guard status == errSecSuccess else { throw NativeSessionVaultError.keychain(status) }
    }
    func forget(owner: String) throws {
        let status = SecItemDelete(try query(owner) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw NativeSessionVaultError.keychain(status) }
    }
}
