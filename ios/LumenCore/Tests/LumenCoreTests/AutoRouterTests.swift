import Foundation
import Testing
@testable import LumenCore

private final class FlakyClient: AIStreamingClient, @unchecked Sendable {
    private let lock = NSLock()
    private var used: [String] = []
    let failing: Set<String>
    let failure: Error
    init(failing: Set<String>, failure: Error = ProviderRequestError.http(429, "Groq")) { self.failing = failing; self.failure = failure }
    var models: [String] { lock.withLock { used } }

    func stream(messages: [ChatMessage], model: AIModel, apiKey: String) async throws -> AsyncThrowingStream<String, Error> {
        lock.withLock { used.append(model.id) }
        if failing.contains(model.id) { throw failure }
        return AsyncThrowingStream { $0.yield("From \(model.id)"); $0.finish() }
    }
}

@Suite struct AutoRouterTests {
    private let groq = AIModel(id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", providerId: "groq")
    private let flash = AIModel(id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", providerId: "gemini")
    private let pro = AIModel(id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", providerId: "gemini")
    private let coder = AIModel(id: "qwen-2.5-coder-32b", name: "Qwen 2.5 Coder 32B", providerId: "groq")
    private var all: [AIModel] { [groq, flash, pro, coder] }

    @Test func readsTheTask() {
        #expect(AutoRouter.analyze(text: "hi there", hasImage: false, conversationCharacters: 0).quick)
        #expect(AutoRouter.analyze(text: "Fix this Swift function", hasImage: false, conversationCharacters: 0).code)
        #expect(AutoRouter.analyze(text: "Solve this equation step by step", hasImage: false, conversationCharacters: 0).reasoning)
        #expect(AutoRouter.analyze(text: "Write an email to my landlord", hasImage: false, conversationCharacters: 0).writing)
        #expect(AutoRouter.analyze(text: "مرحبا", hasImage: false, conversationCharacters: 0).arabic)
        #expect(AutoRouter.analyze(text: "hi", hasImage: false, conversationCharacters: 200_000).long)
        #expect(!AutoRouter.analyze(text: "what is this", hasImage: true, conversationCharacters: 0).quick)
    }

    @Test func quickQuestionsAvoidTheScarceLargeModels() throws {
        let plan = try #require(AutoRouter.plan(text: "What's the capital of Peru?", hasImage: false, conversationCharacters: 0, models: all))
        #expect(plan.model.id != pro.id)
        #expect(plan.reason.contains("quick"))
    }

    @Test func codeGoesToACodeModel() throws {
        let plan = try #require(AutoRouter.plan(text: "Refactor this Python function and fix the bug", hasImage: false, conversationCharacters: 0, models: all))
        #expect(plan.model.id == coder.id)
        #expect(plan.reason == "good at code")
    }

    @Test func photosNeedAModelThatReadsImages() throws {
        let plan = try #require(AutoRouter.plan(text: "What is in this photo?", hasImage: true, conversationCharacters: 0, models: all))
        #expect(plan.model.supportsImages)
        #expect(plan.fallbacks.allSatisfy(\.supportsImages))
        #expect(plan.reason == "reads images")
        #expect(AutoRouter.plan(text: "What is this?", hasImage: true, conversationCharacters: 0, models: [groq]) == nil)
    }

    @Test func backupsAlternateProvidersAndTheResultIsStable() throws {
        let plan = try #require(AutoRouter.plan(text: "hello", hasImage: false, conversationCharacters: 0, models: all))
        if let first = plan.fallbacks.first { #expect(first.providerId != plan.model.providerId) }
        let again = AutoRouter.plan(text: "hello", hasImage: false, conversationCharacters: 0, models: all)
        #expect(again == plan)
        #expect(AutoRouter.plan(text: "hello", hasImage: false, conversationCharacters: 0, models: []) == nil)
    }

    @Test @MainActor func aFailedFirstChoiceFallsBackAndRecordsTheModel() async {
        let client = FlakyClient(failing: [groq.id])
        let engine = ChatEngine(client: client, store: MemoryConversationStore())
        engine.selectModel(groq)
        await engine.submit(prompt: "hi", apiKey: "k1", fallbacks: [ReplyAttempt(model: flash, apiKey: "k2")], route: "fast for quick replies")?.value
        let reply = engine.currentConversation.messages.last
        #expect(client.models == [groq.id, flash.id])
        #expect(reply?.content == "From \(flash.id)")
        #expect(reply?.status == .completed)
        #expect(reply?.modelID == flash.id)
    }

    @Test @MainActor func aRefusedKeyIsNotRetriedOnAnotherModel() async {
        let client = FlakyClient(failing: [groq.id], failure: ProviderRequestError.http(401, "Groq"))
        let engine = ChatEngine(client: client, store: MemoryConversationStore())
        engine.selectModel(groq)
        await engine.submit(prompt: "hi", apiKey: "k1", fallbacks: [ReplyAttempt(model: flash, apiKey: "k2")])?.value
        #expect(client.models == [groq.id])
        if case .error = engine.currentConversation.messages.last?.status {} else { Issue.record("Expected the refusal to show") }
    }

    @Test func repliesKeepTheirModelAndRouteInTheWebFormat() throws {
        var chat = Conversation(id: "c1", selectedModelId: "gemini-2.5-flash")
        _ = chat.appendUserMessage("hi")
        var reply = ChatMessage(role: .assistant, content: "Hello")
        reply.modelID = "llama-3.3-70b-versatile"
        reply.route = "fast for quick replies"
        chat.messages.append(reply)
        let plan = try WebChatCodec.append(chat: chat, messageIDs: Set(chat.messages.map(\.id)), remote: nil, existingMessages: [:])
        #expect(plan.messages[reply.id]?["model"] as? String == "llama-3.3-70b-versatile")
        #expect(plan.messages[reply.id]?["route"] as? String == "fast for quick replies")
        let decoded = try WebChatCodec.message(id: reply.id, fields: plan.messages[reply.id] ?? [:])
        #expect(decoded.modelID == "llama-3.3-70b-versatile")
        #expect(decoded.route == "fast for quick replies")
    }
}
