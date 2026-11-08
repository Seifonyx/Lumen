import Foundation
import Observation

@MainActor public protocol ProviderKeyStore {
    func key(providerID: String, accountID: String) throws -> String?
    func setKey(_ key: String?, providerID: String, accountID: String) throws
}
public protocol ModelCatalogClient: Sendable {
    func models(provider: AIProviderID, apiKey: String) async throws -> [AIModel]
}
extension ProviderCatalog: ModelCatalogClient {}

@MainActor @Observable public final class ProviderConnections {
    public private(set) var models: [AIModel] = []
    public private(set) var connected: Set<String> = []
    public private(set) var loading: Set<String> = []
    public private(set) var errors: [String: String] = [:]
    public private(set) var accountID = "device"
    @ObservationIgnored private let keyStore: any ProviderKeyStore
    @ObservationIgnored private let catalog: any ModelCatalogClient
    @ObservationIgnored private var keys: [String: String] = [:]
    @ObservationIgnored private var epoch = UUID()
    @ObservationIgnored private var operations: [String: UUID] = [:]

    public init(keyStore: any ProviderKeyStore, catalog: any ModelCatalogClient = ProviderCatalog()) {
        self.keyStore = keyStore
        self.catalog = catalog
    }
    public func key(for model: AIModel?) -> String? { model.flatMap { keys[$0.providerId] } }
    public func savedKey(provider: AIProviderID) -> String { keys[provider.rawValue] ?? "" }
    public var recoveredKey: String { (try? keyStore.key(providerID: "legacy", accountID: "device")) ?? "" }

    public func switchAccount(to id: String) async {
        epoch = UUID()
        let ticket = epoch
        accountID = id
        keys = [:]; models = []; connected = []; loading = []; errors = [:]; operations = [:]
        for provider in AIProviderID.allCases {
            do {
                if let key = try keyStore.key(providerID: provider.rawValue, accountID: id), !key.isEmpty { keys[provider.rawValue] = key }
            } catch { errors[provider.rawValue] = "The saved key could not be read from Keychain. Unlock your iPhone and try again." }
        }
        for provider in AIProviderID.allCases {
            guard epoch == ticket else { return }
            if let key = keys[provider.rawValue] { await connect(provider: provider, key: key) }
        }
    }

    public func importAccountKeys(_ imported: [String: String]) async {
        let ticket = epoch
        for provider in AIProviderID.allCases {
            guard ticket == epoch else { return }
            if keys[provider.rawValue] == nil, let key = imported[provider.rawValue] { await connect(provider: provider, key: key) }
        }
    }

    public func connect(provider: AIProviderID, key: String) async {
        let id = provider.rawValue
        let clean = key.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { errors[id] = "Enter your \(provider.name) API key."; return }
        let ticket = epoch
        let operation = UUID()
        operations[id] = operation
        loading.insert(id)
        errors[id] = nil
        defer { if epoch == ticket, operations[id] == operation { loading.remove(id) } }
        do {
            let available = try await catalog.models(provider: provider, apiKey: clean)
            guard epoch == ticket, operations[id] == operation else { return }
            try keyStore.setKey(clean, providerID: id, accountID: accountID)
            keys[id] = clean
            connected.insert(id)
            models.removeAll { $0.providerId == id }
            models.append(contentsOf: available)
        } catch {
            guard epoch == ticket, operations[id] == operation else { return }
            errors[id] = (error as? ProviderRequestError)?.errorDescription ?? "Could not connect to \(provider.name). Check your connection and API key."
        }
    }

    public func disconnect(provider: AIProviderID) {
        let id = provider.rawValue
        do {
            try keyStore.setKey(nil, providerID: id, accountID: accountID)
            operations[id] = UUID()
            keys[id] = nil
            connected.remove(id)
            loading.remove(id)
            models.removeAll { $0.providerId == id }
            errors[id] = nil
        } catch { errors[id] = "Keychain could not remove this key. Unlock your iPhone and try again." }
    }
}
