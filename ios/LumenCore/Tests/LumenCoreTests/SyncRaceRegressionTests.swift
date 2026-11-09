import Foundation
import Testing
@testable import LumenCore

private struct ImmediateSyncClient: AIStreamingClient {
    func stream(messages: [ChatMessage], model: AIModel, apiKey: String) async throws -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { $0.yield("New native reply"); $0.finish() }
    }
}

@Suite @MainActor struct SyncRaceRegressionTests {
    private func loadedEngine() throws -> ChatEngine {
        let engine = ChatEngine(client: ImmediateSyncClient(), store: MemoryConversationStore())
        engine.switchAccount(to: "account")
        let remote = try WebChatCodec.conversation(id: "web-chat", fields: ["title": "Web chat", "ids": ["old"], "rev": 1000])
        engine.applyRemoteMetadata(remote)
        engine.selectConversation(id: remote.id)
        let ticket = try #require(engine.historyLoadTicket(chatID: remote.id))
        #expect(engine.applyRemoteMessages(chatID: remote.id, messages: [ChatMessage(id: "old", role: .user, content: "Original")], orderedIDs: ["old"], ticket: ticket, revision: 1000))
        engine.selectModel(AIModel.defaults[0])
        return engine
    }
    @Test func delayedRefreshCannotEraseASubmittedAndAcknowledgedTurn() async throws {
        let engine = try loadedEngine()
        let stale = try #require(engine.historyLoadTicket(chatID: "web-chat"))
        let send = try #require(engine.submit(prompt: "Keep this new turn", apiKey: "fixture"))
        await send.value
        let newIDs = Set(engine.currentConversation.messages.dropFirst().map(\.id))
        engine.acknowledge(chatID: "web-chat", messageIDs: newIDs)
        #expect(engine.pendingMessages["web-chat"] == nil)
        #expect(!engine.applyRemoteMessages(chatID: "web-chat", messages: [ChatMessage(id: "old", role: .user, content: "Original")], orderedIDs: ["old"], ticket: stale, revision: 1000))
        #expect(engine.currentConversation.messages.map(\.content) == ["Original", "Keep this new turn", "New native reply"])
        #expect(engine.savedConversations.first?.messages.count == 3)
    }
    @Test func sameIDsWithANewWebRevisionInvalidateLoadedContent() throws {
        let engine = try loadedEngine()
        let changed = try WebChatCodec.conversation(id: "web-chat", fields: ["title": "Web chat", "ids": ["old"], "rev": 2000])
        engine.applyRemoteMetadata(changed)
        #expect(engine.currentConversation.historyLoaded == false)
        let ticket = try #require(engine.historyLoadTicket(chatID: "web-chat"))
        #expect(engine.applyRemoteMessages(chatID: "web-chat", messages: [ChatMessage(id: "old", role: .user, content: "Edited on web")], orderedIDs: ["old"], ticket: ticket, revision: 2000))
        #expect(engine.currentConversation.messages.first?.content == "Edited on web")
    }
    @Test func anOlderAccountSessionCannotApplyItsHistoryAfterSwitchingBack() throws {
        let engine = try loadedEngine()
        let stale = try #require(engine.historyLoadTicket(chatID: "web-chat"))
        engine.switchAccount(to: "other")
        engine.switchAccount(to: "account")
        #expect(!engine.applyRemoteMessages(chatID: "web-chat", messages: [], orderedIDs: [], ticket: stale, revision: 1000))
        #expect(engine.savedConversations.first?.messages.first?.content == "Original")
    }
}
