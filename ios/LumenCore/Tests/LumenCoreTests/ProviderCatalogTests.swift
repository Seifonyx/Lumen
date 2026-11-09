import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif
import Testing
@testable import LumenCore

private final class CatalogURLProtocol: URLProtocol {
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        let body: String
        let status: Int
        if request.value(forHTTPHeaderField: "Authorization") == "Bearer fixture-rejected-secret-435" {
            status = 401; body = "never echo a rejected secret"
        } else if request.url?.host == "generativelanguage.googleapis.com" {
            status = 200; body = #"{"models":[{"name":"models/gemini-live","displayName":"Gemini live","supportedGenerationMethods":["generateContent"]},{"name":"models/embedding","supportedGenerationMethods":["embedContent"]}]}"#
        } else if request.value(forHTTPHeaderField: "Authorization") == "Bearer fixture-provider-key" {
            status = 200; body = #"{"data":[{"id":"fixture-model","active":true}]}"#
        } else {
            status = 200; body = #"{"data":[{"id":"llama-3.3-70b-versatile","active":true},{"id":"whisper-large-v3","active":true}]}"#
        }
        client?.urlProtocol(self, didReceive: HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(body.utf8))
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}
#if !canImport(FoundationNetworking)
extension CatalogURLProtocol: @unchecked Sendable {}
#endif

@Suite struct ProviderCatalogTests {
    private func catalog() -> ProviderCatalog {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [CatalogURLProtocol.self]
        return ProviderCatalog(urlSession: URLSession(configuration: config))
    }
    @Test func onlyDiscoveredChatModelsAreOffered() async throws {
        let models = try await catalog().models(provider: .groq, apiKey: "fixture")
        #expect(models.map(\.id) == ["llama-3.3-70b-versatile"])
        #expect(models.first?.providerId == "groq")
        let gemini = try await catalog().models(provider: .gemini, apiKey: "fixture")
        #expect(gemini.map(\.id) == ["gemini-live"])
    }
    @Test func rejectedKeysProduceAnActionableErrorWithoutEchoingTheKey() async {
        do {
            _ = try await catalog().models(provider: .groq, apiKey: "fixture-rejected-secret-435")
            Issue.record("Rejected key was accepted")
        } catch {
            #expect(error.localizedDescription.contains("Settings"))
            #expect(!error.localizedDescription.contains("fixture-rejected-secret-435"))
        }
    }
}

@MainActor private final class ImportedProviderKeyStore: ProviderKeyStore {
    var values: [String: String] = [:]
    func key(providerID: String, accountID: String) throws -> String? { values[accountID + ":" + providerID] }
    func setKey(_ key: String?, providerID: String, accountID: String) throws { values[accountID + ":" + providerID] = key }
}

@Suite @MainActor struct AccountProviderImportTests {
    @Test func webKeyImportDiscoversAndSecurelyStoresTheExactUIFixtureModel() async {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [CatalogURLProtocol.self]
        let store = ImportedProviderKeyStore()
        let providers = ProviderConnections(keyStore: store, catalog: ProviderCatalog(urlSession: URLSession(configuration: config)))
        providers.activateAccount(to: "firebase-account")
        await providers.importAccountKeys(["groq": "fixture-provider-key"])
        #expect(providers.errors.isEmpty)
        #expect(providers.models.map(\.id) == ["fixture-model"])
        #expect(providers.connected == ["groq"])
        #expect(store.values["firebase-account:groq"] == "fixture-provider-key")
        #expect(providers.key(for: providers.models.first) == "fixture-provider-key")
    }
}
