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
    private func withDefaults(_ body: (UserDefaults) async throws -> Void) async rethrows {
        let name = "LumenTests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: name)!
        defer { defaults.removePersistentDomain(forName: name) }
        try await body(defaults)
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
        await withDefaults { defaults in
            let mock = MockStreamingClient(tokens: ["Swift", "UI", " is", " great."], delayNanoseconds: 0)
            let engine = ChatEngine(client: mock, store: MemoryConversationStore())
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

    @Test func aFinishedReplyIsReportedButAStoppedOneIsNot() async {
        await withDefaults { _ in
            let engine = ChatEngine(client: MockStreamingClient(tokens: ["Done", " now."], delayNanoseconds: 0), store: MemoryConversationStore())
            engine.selectModel(AIModel.defaults[0])
            var finished: [ReplyFinished] = []
            engine.onReplyFinished = { finished.append($0) }
            await engine.send(prompt: "Notify me", apiKey: "test-key")
            #expect(finished == [ReplyFinished(accountID: "device", chatID: engine.currentConversation.id, title: "Notify me",
                                               text: "Done now.", failed: false, temporary: false)])

            let slow = ChatEngine(client: MockStreamingClient(tokens: ["A", "B", "C"], delayNanoseconds: 50_000_000), store: MemoryConversationStore())
            slow.selectModel(AIModel.defaults[0])
            var stopped: [ReplyFinished] = []
            slow.onReplyFinished = { stopped.append($0) }
            let task = Task { await slow.send(prompt: "Hello", apiKey: "test-key") }
            try? await Task.sleep(nanoseconds: 60_000_000)
            slow.stopStreaming()
            _ = await task.value
            #expect(stopped.isEmpty)
        }
    }

    @Test func stopStreamingHaltsActiveGeneration() async {
        await withDefaults { defaults in
            let mock = MockStreamingClient(tokens: ["Word1", "Word2", "Word3", "Word4"], delayNanoseconds: 50_000_000)
            let engine = ChatEngine(client: mock, store: MemoryConversationStore())
            engine.selectModel(AIModel.defaults[0])

            let sendTask = Task {
                await engine.send(prompt: "Hello", apiKey: "test-key")
            }

            try? await Task.sleep(nanoseconds: 60_000_000)
            engine.stopStreaming()

            _ = await sendTask.value

            #expect(engine.isStreaming == false)
            #expect(engine.currentConversation.messages.count == 2)
            #expect(engine.currentConversation.messages[1].status == .stopped)
        }
    }

    @Test func savedConversationsSurviveReloadingState() async {
        await withDefaults { defaults in
            let mock = MockStreamingClient()
            let store = MemoryConversationStore()
            let engine1 = ChatEngine(client: mock, store: store)
            engine1.selectModel(AIModel.defaults[0])
            _ = engine1.currentConversation.appendUserMessage("Saved topic")
            engine1.startNewConversation()

            #expect(engine1.savedConversations.count == 1)

            let engine2 = ChatEngine(client: mock, store: store)
            #expect(engine2.savedConversations.count == 1)
            #expect(engine2.savedConversations[0].title == "Saved topic")
            #expect(engine2.selectedModel?.id == AIModel.defaults[0].id)
        }
    }
}
