import Foundation

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

public struct OpenAICompatibleStreamingClient: AIStreamingClient {
    private let baseURL: URL
    private let urlSession: URLSession

    public init(baseURL: URL = URL(string: "https://api.groq.com/openai/v1")!, urlSession: URLSession = .shared) {
        self.baseURL = baseURL
        self.urlSession = urlSession
    }

    public func stream(
        messages: [ChatMessage],
        model: AIModel,
        apiKey: String
    ) async throws -> AsyncThrowingStream<String, Error> {
        let endpoint = baseURL.appendingPathComponent("chat/completions")
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let payloadMessages = messages.map { msg -> [String: String] in
            ["role": msg.role.rawValue, "content": msg.content]
        }

        let body: [String: Any] = [
            "model": model.id,
            "messages": payloadMessages,
            "stream": true
        ]

        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        return AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    let (bytes, response) = try await urlSession.bytes(for: request)
                    guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
                        let status = (response as? HTTPURLResponse)?.statusCode ?? -1
                        continuation.finish(throwing: NSError(domain: "LumenCore.AIStreaming", code: status, userInfo: [NSLocalizedDescriptionKey: "HTTP \(status)"]))
                        return
                    }

                    for try await line in bytes.lines {
                        if Task.isCancelled { break }
                        let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
                        guard trimmed.hasPrefix("data:") else { continue }
                        let payload = trimmed.dropFirst(5).trimmingCharacters(in: .whitespaces)
                        if payload == "[DONE]" { break }

                        if let data = payload.data(using: .utf8),
                           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                           let choices = json["choices"] as? [[String: Any]],
                           let first = choices.first,
                           let delta = first["delta"] as? [String: Any],
                           let content = delta["content"] as? String {
                            continuation.yield(content)
                        }
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }

            continuation.onTermination = { @Sendable _ in
                task.cancel()
            }
        }
    }
}
