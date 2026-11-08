import Foundation
import Testing
@testable import LumenCore

@MainActor final class MemoryConversationStore: ConversationStore {
    var accounts: [String: ChatSnapshot] = [:]
    var failWrites = false
    func load(accountID: String) throws -> ChatSnapshot { accounts[accountID] ?? ChatSnapshot() }
    func save(_ snapshot: ChatSnapshot, accountID: String) throws {
        if failWrites { throw CocoaError(.fileWriteOutOfSpace) }
        accounts[accountID] = snapshot
    }
}

private actor HoldingAccountClient: AIStreamingClient {
    let streamPair = AsyncThrowingStream<String, Error>.makeStream()
    var calls = 0
    func stream(messages: [ChatMessage], model: AIModel, apiKey: String) async throws -> AsyncThrowingStream<String, Error> {
        calls += 1
        return streamPair.stream
    }
    func emit(_ text: String) { streamPair.continuation.yield(text) }
}

@Suite @MainActor struct AccountIsolationTests {
    @Test func switchingAccountStopsTheOldStreamAndRestoresOnlyItsOwnHistory() async throws {
        let store = MemoryConversationStore()
        let client = HoldingAccountClient()
        let engine = ChatEngine(client: client, store: store)
        engine.switchAccount(to: "user-a")
        engine.selectModel(AIModel.defaults[0])
        let task = try #require(engine.submit(prompt: "Private A", apiKey: "key-a"))
        engine.switchAccount(to: "user-b")
        await client.emit("late A reply")
        await task.value
        #expect(!engine.isStreaming)
        #expect(engine.savedConversations.isEmpty)
        #expect(engine.currentConversation.messages.isEmpty)
        #expect(engine.selectedModel == nil)
        engine.switchAccount(to: "user-a")
        #expect(engine.savedConversations.first?.messages.first?.content == "Private A")
        #expect(engine.savedConversations.first?.messages.last?.status == .stopped)
    }

    @Test func failedSaveRejectsSubmissionBeforeNetworkAndKeepsTheConversation() async {
        let store = MemoryConversationStore()
        let client = HoldingAccountClient()
        let engine = ChatEngine(client: client, store: store)
        engine.selectModel(AIModel.defaults[0])
        store.failWrites = true
        #expect(engine.submit(prompt: "Do not lose this draft", apiKey: "key") == nil)
        #expect(engine.currentConversation.messages.isEmpty)
        #expect(!engine.isStreaming)
        #expect(engine.errorMessage != nil)
        #expect(await client.calls == 0)
    }

    @Test func remoteMessagesRespectWebOrderingAndKeepPendingNativeTurn() throws {
        let store = MemoryConversationStore()
        let engine = ChatEngine(store: store)
        engine.switchAccount(to: "user")
        var chat = Conversation(id: "web-chat", title: "Web history")
        chat.remoteMessageIDs = ["b", "a"]
        chat.historyLoaded = false
        engine.applyRemoteMetadata(chat)
        engine.selectConversation(id: chat.id)
        engine.applyRemoteMessages(chatID: chat.id, messages: [ChatMessage(id: "a", role: .assistant, content: "second"), ChatMessage(id: "b", role: .user, content: "first")], orderedIDs: ["b", "a"], ticket: try #require(engine.historyLoadTicket(chatID: chat.id)), revision: nil)
        #expect(engine.currentConversation.messages.map(\.id) == ["b", "a"])
        #expect(engine.currentConversation.historyLoaded == true)
    }
}
