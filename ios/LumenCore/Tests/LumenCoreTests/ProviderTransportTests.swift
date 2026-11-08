import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif
import Testing
@testable import LumenCore

private final class TransportCapture: @unchecked Sendable {
    private let lock = NSLock()
    private var requests: [String: URLRequest] = [:]
    private var stopped = false
    func record(_ request: URLRequest) { lock.withLock { requests[request.url!.host!] = request } }
    func read(_ host: String) -> URLRequest? { lock.withLock { requests[host] } }
    func stop() { lock.withLock { stopped = true } }
    func didStop() -> Bool { lock.withLock { stopped } }
}
private final class TransportURLProtocol: URLProtocol {
    static let capture = TransportCapture()
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        var captured = request
        if captured.httpBody == nil, let stream = request.httpBodyStream {
            stream.open()
            defer { stream.close() }
            var data = Data()
            var buffer = [UInt8](repeating: 0, count: 4096)
            while stream.hasBytesAvailable {
                let count = stream.read(&buffer, maxLength: buffer.count)
                if count <= 0 { break }
                data.append(contentsOf: buffer.prefix(count))
            }
            captured.httpBody = data
        }
        Self.capture.record(captured)
        let denied = request.value(forHTTPHeaderField: "Authorization") == "Bearer fixture-denied-secret"
        client?.urlProtocol(self, didReceive: HTTPURLResponse(url: request.url!, statusCode: denied ? 401 : 200, httpVersion: nil, headerFields: ["Content-Type": "text/event-stream"])!, cacheStoragePolicy: .notAllowed)
        if denied {
            client?.urlProtocol(self, didLoad: Data("fixture-denied-secret echoed by server".utf8))
            client?.urlProtocolDidFinishLoading(self)
            return
        }
        let host = request.url!.host!
        let event: String
        if host == "generativelanguage.googleapis.com" {
            event = #"{"candidates":[{"content":{"parts":[{"text":"Hello 👋"}]}}]}"#
        } else if host == "api.anthropic.com" {
            event = #"{"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello 👋"}}"#
        } else { event = #"{"choices":[{"delta":{"content":"Hello 👋"}}]}"# }
        client?.urlProtocol(self, didLoad: Data(("data: " + event + "\r\n\r\n").utf8))
        if request.value(forHTTPHeaderField: "Authorization") == "Bearer fixture-hold" { return }
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() { if request.value(forHTTPHeaderField: "Authorization") == "Bearer fixture-hold" { Self.capture.stop() } }
}
#if !canImport(FoundationNetworking)
extension TransportURLProtocol: @unchecked Sendable {}
#endif

@Suite(.serialized) struct ProviderTransportTests {
    private func client() -> OpenAICompatibleStreamingClient {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [TransportURLProtocol.self]
        return OpenAICompatibleStreamingClient(urlSession: URLSession(configuration: config))
    }
    @Test(arguments: AIProviderID.allCases) func routesHeadersBodiesAndStreamToTheChosenProvider(_ provider: AIProviderID) async throws {
        let model = AIModel(id: "fixture-model", name: "Fixture", providerId: provider.rawValue)
        let messages = [ChatMessage(role: .system, content: "Instructions"), ChatMessage(role: .user, content: "Question")]
        let stream = try await client().stream(messages: messages, model: model, apiKey: "fixture-key")
        var text = ""
        for try await token in stream { text += token }
        #expect(text == "Hello 👋")
        let host: String
        switch provider { case .groq: host = "api.groq.com"; case .openai: host = "api.openai.com"; case .gemini: host = "generativelanguage.googleapis.com"; case .anthropic: host = "api.anthropic.com" }
        let request = try #require(TransportURLProtocol.capture.read(host))
        let data = try #require(request.httpBody)
        let object = try JSONSerialization.jsonObject(with: data)
        let body = try #require(object as? [String: Any])
        switch provider {
        case .gemini:
            #expect(request.value(forHTTPHeaderField: "x-goog-api-key") == "fixture-key")
            #expect(request.value(forHTTPHeaderField: "Authorization") == nil)
            #expect(request.url?.path.hasSuffix("/models/fixture-model:streamGenerateContent") == true)
            #expect(body["systemInstruction"] != nil)
            #expect((body["contents"] as? [[String: Any]])?.count == 1)
        case .anthropic:
            #expect(request.value(forHTTPHeaderField: "x-api-key") == "fixture-key")
            #expect(request.value(forHTTPHeaderField: "anthropic-version") == "2023-06-01")
            #expect(request.url?.path == "/v1/messages")
            #expect(body["system"] as? String == "Instructions")
            #expect((body["messages"] as? [[String: Any]])?.count == 1)
        default:
            #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer fixture-key")
            #expect(request.url?.path == (provider == .groq ? "/openai/v1/chat/completions" : "/v1/chat/completions"))
            #expect((body["messages"] as? [[String: Any]])?.count == 2)
            #expect(body["model"] as? String == "fixture-model")
        }
    }
    @Test func httpErrorsNeverEchoTheProviderResponseBody() async {
        do {
            let stream = try await client().stream(messages: [], model: AIModel.defaults[3], apiKey: "fixture-denied-secret")
            for try await _ in stream {}
            Issue.record("Expected rejected key")
        } catch {
            #expect(error.localizedDescription.contains("Settings"))
            #expect(!error.localizedDescription.contains("fixture-denied-secret"))
        }
    }
    @Test func cancellingConsumerCancelsTheHTTPTask() async throws {
        let stream = try await client().stream(messages: [], model: AIModel.defaults[3], apiKey: "fixture-hold")
        let consumer = Task { for try await _ in stream {} }
        let deadline = ContinuousClock.now.advanced(by: .seconds(3))
        while TransportURLProtocol.capture.read("api.openai.com")?.value(forHTTPHeaderField: "Authorization") != "Bearer fixture-hold", ContinuousClock.now < deadline { await Task.yield() }
        consumer.cancel()
        _ = await consumer.result
        while !TransportURLProtocol.capture.didStop(), ContinuousClock.now < deadline { await Task.yield() }
        #expect(TransportURLProtocol.capture.didStop())
    }
}
