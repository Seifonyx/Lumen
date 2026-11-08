import Foundation
import Testing
@testable import LumenCore

@MainActor private final class TestProviderKeyStore: ProviderKeyStore {
    var values: [String: String] = [:]
    var failWrites = false
    func key(providerID: String, accountID: String) throws -> String? { values[accountID + ":" + providerID] }
    func setKey(_ key: String?, providerID: String, accountID: String) throws {
        if failWrites { throw CocoaError(.fileWriteNoPermission) }
        values[accountID + ":" + providerID] = key
    }
}
private struct FixedCatalog: ModelCatalogClient {
    func models(provider: AIProviderID, apiKey: String) async throws -> [AIModel] { [AIModel(id: "live-model", name: "Live model", providerId: provider.rawValue)] }
}
private actor HeldCatalog: ModelCatalogClient {
    var pending: CheckedContinuation<[AIModel], any Error>?
    func models(provider: AIProviderID, apiKey: String) async throws -> [AIModel] {
        try await withCheckedThrowingContinuation { pending = $0 }
    }
    func ready() -> Bool { pending != nil }
    func finish() { pending?.resume(returning: [AIModel(id: "late", name: "Late", providerId: "groq")]); pending = nil }
}
@Suite @MainActor struct ProviderConnectionsTests {
    @Test func providerIsReadyOnlyAfterDiscoveryAndSecureSave() async {
        let store = TestProviderKeyStore()
        let providers = ProviderConnections(keyStore: store, catalog: FixedCatalog())
        providers.activateAccount(to: "account")
        await providers.connect(provider: .groq, key: "fixture-secret")
        let model = providers.models.first
        #expect(providers.key(for: model) == "fixture-secret")
        #expect(store.values["account:groq"] == "fixture-secret")
        providers.disconnect(provider: .groq)
        #expect(providers.key(for: model) == nil)
        #expect(providers.models.isEmpty)
        #expect(store.values["account:groq"] == nil)
    }
    @Test func keychainFailureDoesNotPretendProviderIsConnected() async {
        let store = TestProviderKeyStore(); store.failWrites = true
        let providers = ProviderConnections(keyStore: store, catalog: FixedCatalog())
        await providers.connect(provider: .groq, key: "fixture-secret")
        #expect(providers.connected.isEmpty)
        #expect(providers.models.isEmpty)
        #expect(providers.errors["groq"] != nil)
    }
    @Test func lateDiscoveryCannotImportThePreviousAccountsKey() async throws {
        let store = TestProviderKeyStore(), catalog = HeldCatalog()
        let providers = ProviderConnections(keyStore: store, catalog: catalog)
        providers.activateAccount(to: "account-a")
        let connecting = Task { await providers.connect(provider: .groq, key: "secret-a") }
        let deadline = ContinuousClock.now.advanced(by: .seconds(3))
        while !(await catalog.ready()), ContinuousClock.now < deadline { await Task.yield() }
        try #require(await catalog.ready())
        providers.activateAccount(to: "account-b")
        await catalog.finish(); await connecting.value
        #expect(providers.models.isEmpty)
        #expect(providers.connected.isEmpty)
        #expect(store.values.isEmpty)
    }
}
