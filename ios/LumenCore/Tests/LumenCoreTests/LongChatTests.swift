import Foundation
import Testing
@testable import LumenCore

@Suite @MainActor struct LongChatTests {
    @Test func contextKeepsCompleteRecentTurnsAndInstructionsWithinItsBudget() throws {
        let messages = [ChatMessage(id: "s", role: .system, content: "Instructions")] + (0..<100).flatMap { index in
            [ChatMessage(id: "u\(index)", role: .user, content: "Question \(index)"), ChatMessage(id: "a\(index)", role: .assistant, content: "Answer \(index)")]
        }
        let window = try ContextWindow.select(messages: messages, maximumMessages: 9, maximumTextBytes: 1000)
        #expect(window.messages.first?.id == "s")
        #expect(window.messages.last?.id == "a99")
        #expect(window.messages.count <= 9)
        #expect(window.messages.dropFirst().first?.role == .user)
        #expect(window.omittedCount == messages.count - window.messages.count)
        #expect(throws: ContextWindowError.self) { try ContextWindow.select(messages: [ChatMessage(role: .user, content: String(repeating: "a", count: 1001))], maximumTextBytes: 1000) }
    }

    @Test func historyPagesMergeInAuthoritativeOrderAndKeepPendingLocalTurns() throws {
        let ids = (0..<180).map { "m\($0)" }
        var chat = Conversation(id: "long", title: "Long")
        chat.historyLoaded = false; chat.remoteMessageIDs = ids
        let store = MemoryConversationStore(); store.accounts["device"] = ChatSnapshot(conversations: [chat])
        let engine = ChatEngine(store: store); engine.selectConversation(id: chat.id)
        let page = try HistoryPaging.pageIDs(orderedIDs: ids, loadedIDs: [], older: false)
        #expect(page == Array(ids.suffix(60)))
        let latest = page.map { ChatMessage(id: $0, role: .user, content: $0) }
        #expect(engine.applyRemotePage(chatID: chat.id, messages: latest, orderedIDs: ids, ticket: try #require(engine.historyLoadTicket(chatID: chat.id)), revision: 1, reset: true))
        #expect(engine.hasOlderMessages(chatID: chat.id))
        let older = try HistoryPaging.pageIDs(orderedIDs: ids, loadedIDs: page, older: true)
        #expect(older == Array(ids[60..<120]))
        #expect(engine.applyRemotePage(chatID: chat.id, messages: older.map { ChatMessage(id: $0, role: .user, content: $0) }, orderedIDs: ids,
                                      ticket: try #require(engine.historyLoadTicket(chatID: chat.id)), revision: 1, reset: false))
        #expect(engine.currentConversation.messages.map(\.id) == Array(ids[60...]))
        #expect(engine.currentConversation.historyLoaded == true)
        let stale = try #require(engine.historyLoadTicket(chatID: chat.id))
        engine.applyRemoteDeletion(chatID: chat.id)
        #expect(!engine.applyRemotePage(chatID: chat.id, messages: [], orderedIDs: ids, ticket: stale, revision: 1, reset: false))
    }

    @Test func aLaterForkBatchCannotLoseInheritedFieldsAfterItsParentIsDeleted() {
        var child = Conversation(id: "child", messages: [ChatMessage(id: "prefix", role: .user, content: "Keep")])
        child.parentConversationID = "parent"; child.inheritedMessageIDs = ["prefix"]
        #expect(throws: WebSyncError.self) {
            try WebChatCodec.append(chat: child, messageIDs: ["prefix"], remote: ["ids": [String](), "count": 0], existingMessages: [:], sourceMetadata: ["deleted": true])
        }
    }

    @Test func pendingTurnsSurviveAnOlderPageAndAChangedAuthoritativeBoundary() throws {
        let user = ChatMessage(id: "pending", role: .user, content: "Pending user")
        var chat = Conversation(id: "chat", messages: [ChatMessage(id: "new", role: .assistant, content: "Cached latest"), user])
        chat.remoteMessageIDs = ["old", "new"]; chat.historyLoaded = true
        let store = MemoryConversationStore()
        store.accounts["device"] = ChatSnapshot(conversations: [chat], pendingMessages: [chat.id: [user.id]])
        let engine = ChatEngine(store: store); engine.selectConversation(id: chat.id)
        #expect(engine.applyRemotePage(chatID: chat.id, messages: [ChatMessage(id: "old", role: .user, content: "Older")], orderedIDs: ["old", "new"],
                                      ticket: try #require(engine.historyLoadTicket(chatID: chat.id)), revision: 2, reset: false))
        #expect(engine.currentConversation.messages.map(\.id) == ["old", "new", "pending"])
        let stale = try #require(engine.historyLoadTicket(chatID: chat.id))
        var remote = Conversation(id: chat.id); remote.remoteMessageIDs = ["replacement"]; remote.remoteRevision = 3
        engine.applyRemoteMetadata(remote)
        #expect(!engine.applyRemotePage(chatID: chat.id, messages: [], orderedIDs: ["old", "new"], ticket: stale, revision: 2, reset: true))
        #expect(engine.currentConversation.messages.last?.id == "pending")
    }

    @Test func olderPagesCannotDeclareAnInvalidatedLatestPageReady() throws {
        var chat = Conversation(id: "chat", messages: [ChatMessage(id: "latest", role: .assistant, content: "Stale cached latest")])
        chat.remoteMessageIDs = ["old", "latest"]; chat.historyLoaded = false
        let store = MemoryConversationStore(); store.accounts["device"] = ChatSnapshot(conversations: [chat])
        let engine = ChatEngine(store: store); engine.selectConversation(id: chat.id)
        #expect(engine.applyRemotePage(chatID: chat.id, messages: [ChatMessage(id: "old", role: .user, content: "Old")], orderedIDs: ["old", "latest"],
                                      ticket: try #require(engine.historyLoadTicket(chatID: chat.id)), revision: 10, reset: false))
        #expect(engine.currentConversation.historyLoaded == false)
    }

    @Test func processDeathRestoresSelectedChatAndQueuesItsInterruptedAssistant() {
        let store = MemoryConversationStore()
        let chat = Conversation(id: "selected", messages: [ChatMessage(id: "user", role: .user, content: "Question"),
            ChatMessage(id: "reply", role: .assistant, content: "Partial checkpoint", status: .streaming)])
        store.accounts["device"] = ChatSnapshot(conversations: [chat], pendingMessages: [chat.id: ["user"]], selectedConversationID: chat.id)
        let engine = ChatEngine(store: store)
        #expect(engine.currentConversation.id == chat.id)
        #expect(engine.currentConversation.messages.last?.status == .stopped)
        #expect(engine.currentConversation.messages.last?.content == "Partial checkpoint")
        #expect(engine.pendingMessages[chat.id] == ["user", "reply"])
        #expect(engine.checkpoint())
        #expect(ChatEngine(store: store).currentConversation.messages.last?.status == .stopped)
    }

    @Test func aFailingConversationDoesNotPreventIndependentOutboxWorkOrItsChildrenOrder() {
        let store = MemoryConversationStore()
        var child = Conversation(id: "child", messages: [ChatMessage(id: "c", role: .user, content: "C")])
        child.parentConversationID = "bad"
        store.accounts["device"] = ChatSnapshot(conversations: [Conversation(id: "bad", messages: [ChatMessage(id: "b", role: .user, content: "B")]),
            Conversation(id: "good", messages: [ChatMessage(id: "g", role: .user, content: "G")]), child],
            pendingMessages: ["bad": ["b"], "good": ["g"], "child": ["c"]])
        let engine = ChatEngine(store: store)
        #expect(engine.nextPendingConversation(excluding: ["bad"])?.id == "good")
        let start = Date(timeIntervalSince1970: 100)
        var retry = SyncRetryQueue()
        retry.failed(chatID: "bad", at: start)
        #expect(retry.blockedIDs(at: start).contains("bad"))
        #expect(retry.blockedIDs(at: start.addingTimeInterval(31)).isEmpty)
        #expect(!retry.blockedIDs(at: start).contains("good"))
    }
}
