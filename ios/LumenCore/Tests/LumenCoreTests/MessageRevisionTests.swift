import Foundation
import Testing
@testable import LumenCore

private actor RevisionClient: AIStreamingClient {
    var requests: [[ChatMessage]] = []
    func stream(messages: [ChatMessage], model: AIModel, apiKey: String) async throws -> AsyncThrowingStream<String, Error> {
        requests.append(messages)
        return AsyncThrowingStream { $0.yield("Revised answer"); $0.finish() }
    }
}

@Suite @MainActor struct MessageRevisionTests {
    private func fixture(client: RevisionClient = RevisionClient()) -> (ChatEngine, MemoryConversationStore, RevisionClient) {
        var chat = Conversation(id: "source", title: "Original title", messages: [
            ChatMessage(id: "u1", role: .user, content: "Earlier question"),
            ChatMessage(id: "a1", role: .assistant, content: "Earlier answer"),
            ChatMessage(id: "u2", role: .user, content: "Later question", attachmentNames: ["notes.txt"]),
            ChatMessage(id: "a2", role: .assistant, content: "Later answer")
        ])
        chat.historyLoaded = true
        let store = MemoryConversationStore()
        store.accounts["device"] = ChatSnapshot(conversations: [chat], selectedModel: AIModel.defaults[0])
        let engine = ChatEngine(client: client, store: store)
        engine.selectConversation(id: "source")
        return (engine, store, client)
    }

    @Test func editingKeepsTheOriginalAndSendsOnlyTheRevisedPrefix() async throws {
        let (engine, _, client) = fixture()
        let task = try #require(engine.editAndResend(messageID: "u2", text: "  Revised question  ", apiKey: "fixture"))
        await task.value
        #expect(engine.currentConversation.id != "source")
        #expect(engine.currentConversation.lineageRootID == "source")
        #expect(engine.currentConversation.parentConversationID == "source")
        #expect(engine.currentConversation.messages.map(\.content) == ["Earlier question", "Earlier answer", "Revised question", "Revised answer"])
        #expect(engine.currentConversation.messages[2].sourceMessageID == "u2")
        #expect(engine.currentConversation.messages[2].attachmentNames == ["notes.txt"])
        #expect(engine.savedConversations.first { $0.id == "source" }?.messages.map(\.content) == ["Earlier question", "Earlier answer", "Later question", "Later answer"])
        #expect(await client.requests.last?.map(\.content) == ["Earlier question", "Earlier answer", "Revised question"])
        #expect(engine.historyConversations.count == 1)
        #expect(engine.versions(for: engine.currentConversation.id).count == 2)
    }

    @Test func regenerationKeepsTheUserTurnWithoutDuplicatingItOrSendingLaterTurns() async throws {
        let (engine, _, client) = fixture()
        await try #require(engine.regenerate(messageID: "a1", apiKey: "fixture")).value
        #expect(engine.currentConversation.messages.map(\.content) == ["Earlier question", "Revised answer"])
        #expect(await client.requests.last?.map(\.content) == ["Earlier question"])
        #expect(engine.savedConversations.first { $0.id == "source" }?.messages.count == 4)
        #expect(engine.pendingMessages[engine.currentConversation.id]?.count == 2)
    }

    @Test func aRejectedRevisionLeavesTheOriginalAndStartsNoRequest() async {
        let (engine, store, client) = fixture()
        store.failWrites = true
        #expect(engine.editAndResend(messageID: "u2", text: "Revision", apiKey: "fixture") == nil)
        #expect(engine.currentConversation.id == "source")
        #expect(engine.currentConversation.messages.last?.content == "Later answer")
        #expect(engine.savedConversations.count == 1)
        #expect(engine.pendingMessages.isEmpty)
        #expect(await client.requests.isEmpty)
    }

    @Test func blankEditsAndUnavailableHistoryDoNotCreateVersions() async {
        let (engine, _, client) = fixture()
        #expect(engine.editAndResend(messageID: "u2", text: " \n ", apiKey: "fixture") == nil)
        #expect(engine.regenerate(messageID: "u1", apiKey: "fixture") == nil)
        engine.currentConversation.historyLoaded = false
        #expect(engine.regenerate(messageID: "a2", apiKey: "fixture") == nil)
        #expect(engine.savedConversations.count == 1)
        #expect(await client.requests.isEmpty)
    }

    @Test func versionsAndTheirOutboxSurviveSnapshotEncodingAndAccountSwitch() async throws {
        let (engine, store, _) = fixture()
        await try #require(engine.regenerate(messageID: "a2", apiKey: "fixture")).value
        let id = engine.currentConversation.id
        let snapshot = try #require(store.accounts["device"])
        store.accounts["device"] = try JSONDecoder().decode(ChatSnapshot.self, from: JSONEncoder().encode(snapshot))
        engine.switchAccount(to: "other")
        #expect(engine.historyConversations.isEmpty)
        engine.switchAccount(to: "device")
        #expect(engine.historyConversations.count == 1)
        #expect(engine.versions(for: id).count == 2)
        #expect(engine.pendingMessages[id]?.count == 4)
    }

    @Test func forkSyncClonesWebContextAndMessageFieldsWithoutEditingTheSource() throws {
        var chat = Conversation(id: "revision", title: "Revised", messages: [
            ChatMessage(id: "u1", role: .user, content: "Earlier question"),
            ChatMessage(id: "edited", role: .user, content: "Edited question", sourceMessageID: "u2")
        ], selectedModelId: "new-model")
        chat.lineageRootID = "source"; chat.parentConversationID = "source"
        let parent: [String: Any] = ["ids": ["u1", "u2", "a2"], "projectId": "keep-project", "documents": ["keep-doc"], "summary": ["text": "stale"], "createdAt": 10]
        let inherited: [String: [String: Any]] = [
            "u1": ["id": "u1", "role": "user", "createdAt": 10, "index": 0, "status": "done", "text": "Earlier question", "model": "original-model", "sources": [["title": "keep-citation"]]],
            "edited": ["id": "u2", "role": "user", "createdAt": 20, "index": 1, "status": "done", "text": "Old question", "files": [["id": "file-1", "name": "notes.txt", "text": "Original file contents"]]]
        ]
        let plan = try WebChatCodec.append(chat: chat, messageIDs: ["u1", "edited"], remote: nil,
                                           existingMessages: [:], sourceMetadata: parent, inheritedMessages: inherited)
        #expect(plan.metadata["projectId"] as? String == "keep-project")
        #expect(plan.metadata["documents"] as? [String] == ["keep-doc"])
        #expect(plan.metadata["summary"] == nil)
        #expect(plan.metadata["nativeRoot"] as? String == "source")
        #expect(plan.metadata["ids"] as? [String] == ["u1", "edited"])
        #expect(plan.messages["u1"]?["model"] as? String == "original-model")
        #expect((plan.messages["u1"]?["sources"] as? [[String: String]])?.first?["title"] == "keep-citation")
        #expect((plan.messages["edited"]?["files"] as? [[String: String]])?.first?["text"] == "Original file contents")
        #expect(plan.messages["edited"]?["text"] as? String == "Edited question")
        #expect(parent["ids"] as? [String] == ["u1", "u2", "a2"])
    }

    @Test func deletedParentDoesNotSilentlyPublishAnIncompleteFork() {
        let chat = Conversation(id: "revision", messages: [ChatMessage(id: "u", role: .user, content: "Edited")])
        #expect(throws: WebSyncError.self) {
            try WebChatCodec.append(chat: chat, messageIDs: ["u"], remote: nil, existingMessages: [:], sourceMetadata: ["deleted": true])
        }
    }
    @Test func malformedLineageFieldsCannotBecomeFirestorePaths() throws {
        let chat = try WebChatCodec.conversation(id: "valid", fields: ["nativeRoot": "bad/path", "nativeParent": ""])
        #expect(chat.lineageRootID == nil)
        #expect(chat.parentConversationID == nil)
    }

    @Test func forkRejectsAnExternallyEditedPrefix() {
        let chat = Conversation(id: "revision", messages: [ChatMessage(id: "u1", role: .user, content: "Expected prefix")])
        #expect(throws: WebSyncError.self) {
            try WebChatCodec.append(chat: chat, messageIDs: ["u1"], remote: nil, existingMessages: [:],
                sourceMetadata: ["ids": ["u1"]], inheritedMessages: ["u1": ["role": "user", "text": "Changed elsewhere"]])
        }
    }

    @Test func failedPartialRepliesAreExcludedFromRegeneratedContext() async throws {
        let (engine, _, client) = fixture()
        engine.currentConversation.messages[1].status = .error("Interrupted")
        await try #require(engine.regenerate(messageID: "a2", apiKey: "fixture")).value
        #expect(await client.requests.last?.map(\.content) == ["Earlier question", "Later question"])
    }

    @Test func editingThenRegeneratingAfterRestartKeepsImmediateParentFiles() async throws {
        let (engine, store, client) = fixture()
        await try #require(engine.editAndResend(messageID: "u2", text: "Edited", apiKey: "fixture")).value
        let parent = engine.currentConversation
        let editedID = parent.messages[2].id
        store.accounts["device"] = try JSONDecoder().decode(ChatSnapshot.self, from: JSONEncoder().encode(store.accounts["device"]))
        let restored = ChatEngine(client: client, store: store)
        restored.selectConversation(id: parent.id)
        await try #require(restored.regenerate(messageID: parent.messages[3].id, apiKey: "fixture")).value
        let revised = restored.currentConversation
        let refs = Dictionary(uniqueKeysWithValues: revised.messages.dropLast().map { ($0.id, $0.sourceMessageID ?? $0.id) })
        let parentDocuments: [String: [String: Any]] = [
            "u1": ["role": "user", "text": "Earlier question"],
            "a1": ["role": "assistant", "text": "Earlier answer"],
            editedID: ["role": "user", "text": "Edited", "files": [["name": "notes.txt", "text": "preserved attachment"]], "futureField": "preserved"]
        ]
        var inherited: [String: [String: Any]] = [:]
        for (target, source) in refs { inherited[target] = parentDocuments[source] }
        let plan = try WebChatCodec.append(chat: revised, messageIDs: Set(refs.keys), remote: nil, existingMessages: [:],
            sourceMetadata: ["ids": parent.messages.map(\.id)], inheritedMessages: inherited)
        #expect((plan.messages[editedID]?["files"] as? [[String: String]])?.first?["text"] == "preserved attachment")
        #expect(plan.messages[editedID]?["futureField"] as? String == "preserved")
    }

    @Test func anUnavailableParentCannotPublishAMetadataIncompleteFork() {
        var child = Conversation(id: "child", messages: [ChatMessage(id: "u", role: .user, content: "Question")])
        child.parentConversationID = "parent"
        #expect(throws: WebSyncError.self) {
            try WebChatCodec.append(chat: child, messageIDs: ["u"], remote: nil, existingMessages: [:])
        }
    }

    @Test func deletingAGroupedConversationRemovesAllItsVersionsAtomically() async throws {
        let (engine, store, _) = fixture()
        await try #require(engine.regenerate(messageID: "a2", apiKey: "fixture")).value
        let child = engine.currentConversation.id
        store.failWrites = true
        #expect(!engine.deleteConversation(id: child))
        #expect(engine.savedConversations.count == 2)
        #expect(engine.pendingDeletions.isEmpty)
        store.failWrites = false
        #expect(engine.deleteConversation(id: child))
        #expect(engine.historyConversations.isEmpty)
        #expect(engine.pendingDeletions == ["source", child])
    }

    @Test func reconnectDrainsParentsBeforeReverseOrderedChildren() {
        let parent = Conversation(id: "z-parent", messages: [ChatMessage(id: "u", role: .user, content: "Original")])
        var child = Conversation(id: "a-child", messages: parent.messages)
        child.parentConversationID = parent.id
        var grandchild = Conversation(id: "b-grandchild", messages: parent.messages)
        grandchild.parentConversationID = child.id
        let store = MemoryConversationStore()
        store.accounts["device"] = ChatSnapshot(conversations: [grandchild, child, parent],
            pendingMessages: ["b-grandchild": ["u"], "a-child": ["u"], "z-parent": ["u"]])
        let engine = ChatEngine(client: RevisionClient(), store: store)
        #expect(engine.nextPendingConversation()?.id == "z-parent")
        engine.acknowledge(chatID: "z-parent", messageIDs: ["u"])
        #expect(engine.nextPendingConversation()?.id == "a-child")
        engine.acknowledge(chatID: "a-child", messageIDs: ["u"])
        #expect(engine.nextPendingConversation()?.id == "b-grandchild")
    }

}
