import Foundation
import Testing
@testable import LumenCore

private struct MockStreamingClient: AIStreamingClient {
    let tokens: [String]
    let delayNanoseconds: UInt64

    init(tokens: [String] = ["Hello", " world", "!"], delayNanoseconds: UInt64 = 10_000_000) {
        self.tokens = tokens
        self.delayNanoseconds = delayNanoseconds
    }

    func stream(
        messages: [ChatMessage],
        model: AIModel,
        apiKey: String
    ) async throws -> AsyncThrowingStream<String, Error> {
        let items = tokens
        let delay = delayNanoseconds
        return AsyncThrowingStream { continuation in
            let task = Task {
                for token in items {
                    if Task.isCancelled { break }
                    if delay > 0 {
                        try? await Task.sleep(nanoseconds: delay)
                    }
                    continuation.yield(token)
                }
                continuation.finish()
            }
            continuation.onTermination = { @Sendable _ in
                task.cancel()
            }
        }
    }
}

@Suite @MainActor
struct ChatEngineTests {
    private func withDefaults(_ body: (UserDefaults) -> Void) {
        let name = "LumenTests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: name)!
        defer { defaults.removePersistentDomain(forName: name) }
        body(defaults)
    }

    @Test func conversationAppendsUserMessageAndSetsTitle() {
        var conv = Conversation()
        #expect(conv.title == "New conversation")
        _ = conv.appendUserMessage("What is the speed of light?")
        #expect(conv.title == "What is the speed of light?")
        #expect(conv.messages.count == 1)
        #expect(conv.messages[0].role == .user)
        #expect(conv.messages[0].content == "What is the speed of light?")
    }

    @Test func engineStreamsAssistantResponse() async {
        withDefaults { defaults in
            let mock = MockStreamingClient(tokens: ["Swift", "UI", " is", " great."], delayNanoseconds: 0)
            let engine = ChatEngine(client: mock, defaults: defaults)
            let model = AIModel.defaults[0]
            engine.selectModel(model)

            let task = Task {
                await engine.send(prompt: "Tell me about UI", apiKey: "test-key")
            }

            _ = await task.value

            #expect(engine.currentConversation.messages.count == 2)
            #expect(engine.currentConversation.messages[0].role == .user)
            #expect(engine.currentConversation.messages[1].role == .assistant)
            #expect(engine.currentConversation.messages[1].content == "SwiftUI is great.")
            #expect(engine.currentConversation.messages[1].status == .completed)
            #expect(engine.isStreaming == false)
            #expect(engine.savedConversations.count == 1)
        }
    }

    @Test func stopStreamingHaltsActiveGeneration() async {
        withDefaults { defaults in
            let mock = MockStreamingClient(tokens: ["Word1", "Word2", "Word3", "Word4"], delayNanoseconds: 50_000_000)
            let engine = ChatEngine(client: mock, defaults: defaults)
            engine.selectModel(AIModel.defaults[0])

            let sendTask = Task {
                await engine.send(prompt: "Hello", apiKey: "test-key")
            }

            try? await Task.sleep(nanoseconds: 60_000_000)
            engine.stopStreaming()

            _ = await sendTask.value

            #expect(engine.isStreaming == false)
            #expect(engine.currentConversation.messages.count == 2)
            #expect(engine.currentConversation.messages[1].status == .completed)
        }
    }

    @Test func savedConversationsSurviveReloadingState() {
        withDefaults { defaults in
            let mock = MockStreamingClient()
            let engine1 = ChatEngine(client: mock, defaults: defaults)
            engine1.selectModel(AIModel.defaults[0])
            _ = engine1.currentConversation.appendUserMessage("Saved topic")
            engine1.startNewConversation()

            #expect(engine1.savedConversations.count == 1)

            let engine2 = ChatEngine(client: mock, defaults: defaults)
            #expect(engine2.savedConversations.count == 1)
            #expect(engine2.savedConversations[0].title == "Saved topic")
            #expect(engine2.selectedModel?.id == AIModel.defaults[0].id)
        }
    }
}
