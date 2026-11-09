import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public struct AIModel: Identifiable, Codable, Sendable, Equatable, Hashable {
    public let id: String
    public let name: String
    public let providerId: String
    public let description: String

    public init(id: String, name: String, providerId: String, description: String = "") {
        self.id = id
        self.name = name
        self.providerId = providerId
        self.description = description
    }

    public static let defaults: [AIModel] = [
        AIModel(id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", providerId: "gemini", description: "Fast, intelligent, multimodal"),
        AIModel(id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", providerId: "gemini", description: "Complex reasoning and code"),
        AIModel(id: "llama-3.3-70b", name: "Llama 3.3 70B", providerId: "groq", description: "Ultra-fast inference via Groq"),
        AIModel(id: "gpt-4o-mini", name: "GPT-4o mini", providerId: "openai", description: "Affordable fast intelligence"),
        AIModel(id: "claude-3-5-haiku", name: "Claude 3.5 Haiku", providerId: "anthropic", description: "Quick, articulate responses")
    ]
}

public protocol AIStreamingClient: Sendable {
    func stream(
        messages: [ChatMessage],
        model: AIModel,
        apiKey: String
    ) async throws -> AsyncThrowingStream<String, Error>
}

public enum ProviderRequestError: Error, LocalizedError, Sendable {
    case unsupportedProvider(String), invalidResponse, emptyResponse, responseTooLarge
    case http(Int, String)
    public var errorDescription: String? {
        switch self {
        case .unsupportedProvider: "This provider is not available in this version."
        case .invalidResponse: "The provider returned an unreadable response. Try again."
        case .emptyResponse: "The provider returned no reply. Try another model."
        case .responseTooLarge: "The provider response exceeded the supported size."
        case .http(let code, let provider):
            switch code {
            case 401, 403: "\(provider) rejected the API key. Check it in Settings."
            case 404: "This model is no longer available. Refresh models in Settings."
            case 429: "\(provider)'s usage limit was reached. Try again later."
            case 500...599: "\(provider) is temporarily unavailable. Try again later."
            default: "\(provider) could not complete the request (\(code))."
            }
        }
    }
}

public struct OpenAICompatibleStreamingClient: AIStreamingClient {
    private let baseURL: URL?
    private let configuration: URLSessionConfiguration

    public init(baseURL: URL? = nil, urlSession: URLSession = .shared) {
        self.baseURL = baseURL
        self.configuration = urlSession.configuration
    }

    public func stream(messages: [ChatMessage], model: AIModel, apiKey: String) async throws -> AsyncThrowingStream<String, Error> {
        let provider = model.providerId
        let defaultURL: String
        switch provider {
        case "openai": defaultURL = "https://api.openai.com/v1"
        case "groq": defaultURL = "https://api.groq.com/openai/v1"
        case "gemini": defaultURL = "https://generativelanguage.googleapis.com/v1beta"
        case "anthropic": defaultURL = "https://api.anthropic.com/v1"
        default: throw ProviderRequestError.unsupportedProvider(provider)
        }
        let base = baseURL ?? URL(string: defaultURL)!
        var endpoint: URL
        var body: [String: Any]
        let conversation = messages.filter { $0.role != .system }.map { ["role": $0.role.rawValue, "content": $0.content] }
        let system = messages.filter { $0.role == .system }.map(\.content).joined(separator: "\n")
        switch provider {
        case "gemini":
            endpoint = base.appendingPathComponent("models").appendingPathComponent(model.id + ":streamGenerateContent")
            var parts = URLComponents(url: endpoint, resolvingAgainstBaseURL: false)!
            parts.queryItems = [URLQueryItem(name: "alt", value: "sse")]
            endpoint = parts.url!
            body = ["contents": conversation.map { ["role": $0["role"] == "assistant" ? "model" : "user", "parts": [["text": $0["content"]!]]] }]
            if !system.isEmpty { body["systemInstruction"] = ["parts": [["text": system]]] }
        case "anthropic":
            endpoint = base.appendingPathComponent("messages")
            body = ["model": model.id, "messages": conversation, "stream": true, "max_tokens": 8192]
            if !system.isEmpty { body["system"] = system }
        default:
            endpoint = base.appendingPathComponent("chat/completions")
            body = ["model": model.id, "messages": messages.map { ["role": $0.role.rawValue, "content": $0.content] }, "stream": true]
        }
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
        switch provider {
        case "gemini": request.setValue(apiKey, forHTTPHeaderField: "x-goog-api-key")
        case "anthropic":
            request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
            request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        default: request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        }
        let finalRequest = request
        let configuration = configuration.copy() as! URLSessionConfiguration
        configuration.httpShouldSetCookies = false
        configuration.urlCache = nil
        configuration.timeoutIntervalForRequest = 45
        configuration.timeoutIntervalForResource = 600
        return AsyncThrowingStream { continuation in
            let delegate = ProviderStreamDelegate(provider: provider, continuation: continuation)
            let queue = OperationQueue()
            queue.maxConcurrentOperationCount = 1
            let session = URLSession(configuration: configuration, delegate: delegate, delegateQueue: queue)
            let task = session.dataTask(with: finalRequest)
            continuation.onTermination = { @Sendable _ in
                task.cancel()
                session.invalidateAndCancel()
            }
            task.resume()
        }
    }
}

private final class ProviderStreamDelegate: NSObject, URLSessionDataDelegate, @unchecked Sendable {
    private let provider: String
    private let continuation: AsyncThrowingStream<String, Error>.Continuation
    private var decoder = SSEDecoder()
    private var status = 0
    private var deliveredText = false
    private var finished = false

    init(provider: String, continuation: AsyncThrowingStream<String, Error>.Continuation) {
        self.provider = provider
        self.continuation = continuation
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest, completionHandler: @escaping @Sendable (URLRequest?) -> Void) {
        completionHandler(nil)
    }

    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse,
                    completionHandler: @escaping @Sendable (URLSession.ResponseDisposition) -> Void) {
        status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if !(200...299).contains(status) {
            finish(ProviderRequestError.http(status, provider))
            completionHandler(.cancel)
        } else { completionHandler(.allow) }
    }

    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        guard !finished else { return }
        do { try consume(decoder.append(data)) }
        catch { finish(error) }
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: (any Error)?) {
        guard !finished else { return }
        if let error { finish(error); return }
        do {
            try consume(decoder.finish())
            if !finished { finish(deliveredText ? nil : ProviderRequestError.emptyResponse) }
        } catch { finish(error) }
    }

    private func consume(_ events: [SSEEvent]) throws {
        for event in events where !finished {
            if event.data.isEmpty { continue }
            if event.data == "[DONE]" || event.name == "message_stop" {
                finish(deliveredText ? nil : ProviderRequestError.emptyResponse)
                return
            }
            guard let bytes = event.data.data(using: .utf8),
                  let json = try JSONSerialization.jsonObject(with: bytes) as? [String: Any] else {
                throw ProviderRequestError.invalidResponse
            }
            if json["error"] != nil || event.name == "error" { throw ProviderRequestError.invalidResponse }
            let text: String?
            switch provider {
            case "gemini":
                let candidates = json["candidates"] as? [[String: Any]]
                let content = candidates?.first?["content"] as? [String: Any]
                let parts = content?["parts"] as? [[String: Any]]
                text = parts?.filter { $0["thought"] as? Bool != true }.compactMap { $0["text"] as? String }.joined()
            case "anthropic": text = (json["delta"] as? [String: Any])?["text"] as? String
            default:
                let first = (json["choices"] as? [[String: Any]])?.first
                text = (first?["delta"] as? [String: Any])?["content"] as? String
            }
            if let text, !text.isEmpty {
                deliveredText = true
                continuation.yield(text)
            }
        }
    }

    private func finish(_ error: (any Error)?) {
        guard !finished else { return }
        finished = true
        if let error { continuation.finish(throwing: error) }
        else { continuation.finish() }
    }
}
