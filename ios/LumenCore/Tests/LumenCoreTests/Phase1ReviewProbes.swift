import Foundation
import Testing
@testable import LumenCore

private actor WaitingReviewClient: AIStreamingClient {
    let tokenStream: AsyncThrowingStream<String, Error>
    let continuation: AsyncThrowingStream<String, Error>.Continuation

    init() {
        let pair = AsyncThrowingStream<String, Error>.makeStream()
        tokenStream = pair.stream
        continuation = pair.continuation
    }

    func stream(messages: [ChatMessage], model: AIModel, apiKey: String) async throws -> AsyncThrowingStream<String, Error> {
        tokenStream
    }

    func emit(_ text: String) { continuation.yield(text) }
}

private final class ReviewRequestCapture: @unchecked Sendable {
    private let lock = NSLock()
    private var value: URLRequest?
    func record(_ request: URLRequest) { lock.withLock { value = request } }
    func read() -> URLRequest? { lock.withLock { value } }
}

private final class ReviewURLProtocol: URLProtocol, @unchecked Sendable {
    static let capture = ReviewRequestCapture()
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        Self.capture.record(request)
        let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: "HTTP/1.1",
                                       headerFields: ["Content-Type": "text/event-stream"])!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        let data = "data: {\"choices\":[{\"delta\":{\"content\":\"probe\"}}]}\n\ndata: [DONE]\n\n".data(using: .utf8)!
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}

@Suite(.serialized) @MainActor
struct Phase1ReviewProbes {
    private func waitForPartial(_ engine: ChatEngine, client: WaitingReviewClient) async throws {
        await client.emit("partial")
        let deadline = ContinuousClock.now.advanced(by: .seconds(5))
        while engine.currentConversation.messages.last?.content != "partial", ContinuousClock.now < deadline {
            await Task.yield()
        }
        try #require(engine.currentConversation.messages.last?.content == "partial")
    }

    @Test func switchingChatsDuringStreamingKeepsTheNewChatSafe() async throws {
        let name = "LumenReview.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: name)!
        defer { defaults.removePersistentDomain(forName: name) }
        let client = WaitingReviewClient()
        let engine = ChatEngine(client: client, defaults: defaults)
        engine.selectModel(AIModel.defaults[0])
        let send = Task { await engine.send(prompt: "Review prompt", apiKey: "fake-review-key") }
        try await waitForPartial(engine, client: client)
        engine.startNewConversation()
        await send.value
        #expect(engine.currentConversation.messages.isEmpty)
        #expect(!engine.isStreaming)
    }

    @Test func submittedConversationSurvivesRelaunchBeforeTheReplyFinishes() async throws {
        let name = "LumenReview.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: name)!
        defer { defaults.removePersistentDomain(forName: name) }
        let client = WaitingReviewClient()
        let engine = ChatEngine(client: client, defaults: defaults)
        engine.selectModel(AIModel.defaults[0])
        let send = Task { await engine.send(prompt: "Must survive relaunch", apiKey: "fake-review-key") }
        try await waitForPartial(engine, client: client)
        let reloaded = ChatEngine(client: client, defaults: defaults)
        #expect(reloaded.savedConversations.contains {
            $0.messages.contains { $0.role == .user && $0.content == "Must survive relaunch" }
        }, "The submitted user turn must be durable while the response is still streaming")
        engine.stopStreaming()
        await send.value
    }

    @Test func providerSelectionRoutesToTheSelectedService() async throws {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [ReviewURLProtocol.self]
        let session = URLSession(configuration: configuration)
        defer { session.invalidateAndCancel() }
        let client = OpenAICompatibleStreamingClient(urlSession: session)
        let model = try #require(AIModel.defaults.first { $0.providerId == "openai" })
        let stream = try await client.stream(messages: [ChatMessage(role: .user, content: "Review only")],
                                             model: model, apiKey: "fake-review-key")
        for try await _ in stream {}
        let request = try #require(ReviewURLProtocol.capture.read())
        print("REVIEW provider=\(model.providerId), actual endpoint=\(request.url!.absoluteString)")
        #expect(request.url?.host == "api.openai.com", "An OpenAI selection must not send its key and messages to Groq")
    }
}
