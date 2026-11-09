import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public enum AIProviderID: String, CaseIterable, Identifiable, Sendable {
    case groq, gemini, openai, anthropic
    public var id: String { rawValue }
    public var name: String {
        switch self { case .groq: "Groq"; case .gemini: "Google Gemini"; case .openai: "OpenAI"; case .anthropic: "Anthropic" }
    }
}

public struct ProviderCatalog: Sendable {
    private let configuration: URLSessionConfiguration
    private let baseURL: URL?
    public init(urlSession: URLSession = .shared, baseURL: URL? = nil) { configuration = urlSession.configuration; self.baseURL = baseURL }
    public func models(provider: AIProviderID, apiKey: String) async throws -> [AIModel] {
        let endpoint: String
        switch provider {
        case .groq: endpoint = "https://api.groq.com/openai/v1/models"
        case .openai: endpoint = "https://api.openai.com/v1/models"
        case .gemini: endpoint = "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000"
        case .anthropic: endpoint = "https://api.anthropic.com/v1/models?limit=100"
        }
        var request = URLRequest(url: baseURL?.appendingPathComponent("models") ?? URL(string: endpoint)!)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        switch provider {
        case .gemini: request.setValue(apiKey, forHTTPHeaderField: "x-goog-api-key")
        case .anthropic:
            request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
            request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        default: request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        }
        let config = configuration.copy() as! URLSessionConfiguration
        config.httpShouldSetCookies = false
        config.urlCache = nil
        config.timeoutIntervalForRequest = 25
        config.timeoutIntervalForResource = 30
        let session = URLSession(configuration: config, delegate: NoProviderRedirects(), delegateQueue: nil)
        defer { session.invalidateAndCancel() }
        let (data, response) = try await session.data(for: request)
        let code = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200...299).contains(code) else { throw ProviderRequestError.http(code, provider.name) }
        guard data.count < 4_000_000, let root = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw ProviderRequestError.invalidResponse }
        let list = (root[provider == .gemini ? "models" : "data"] as? [[String: Any]]) ?? []
        let models: [AIModel] = list.compactMap { item in
            if provider == .gemini {
                guard (item["supportedGenerationMethods"] as? [String])?.contains("generateContent") == true,
                      let name = item["name"] as? String else { return nil }
                let id = name.hasPrefix("models/") ? String(name.dropFirst(7)) : name
                return AIModel(id: id, name: item["displayName"] as? String ?? id, providerId: provider.rawValue)
            }
            guard let id = item["id"] as? String, item["active"] as? Bool != false else { return nil }
            let lower = id.lowercased()
            if ["whisper", "tts", "orpheus", "playai", "embedding", "transcribe", "realtime", "audio", "image", "moderation"].contains(where: lower.contains) { return nil }
            if provider == .openai {
                guard ["gpt-", "chatgpt-", "o1", "o3", "o4"].contains(where: lower.hasPrefix), !lower.contains("search"), !lower.contains("codex"), !(lower.hasPrefix("gpt-5") && lower.contains("-pro")) else { return nil }
            }
            return AIModel(id: id, name: item["display_name"] as? String ?? id, providerId: provider.rawValue)
        }
        guard !models.isEmpty else { throw ProviderRequestError.emptyResponse }
        return Array(Set(models)).sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
    }
}

private final class NoProviderRedirects: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest, completionHandler: @escaping @Sendable (URLRequest?) -> Void) { completionHandler(nil) }
}
