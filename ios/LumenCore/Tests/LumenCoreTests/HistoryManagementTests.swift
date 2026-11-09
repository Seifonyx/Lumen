import Foundation
import Testing
@testable import LumenCore

@Suite @MainActor struct HistoryManagementTests {
    private func fixture() -> (ChatEngine, MemoryConversationStore) {
        var root = Conversation(id: "root", title: "Original", messages: [ChatMessage(id: "u", role: .user, content: "Énergie and training")])
        root.historyLoaded = true
        var child = Conversation(id: "child", title: "Latest", messages: [ChatMessage(id: "u2", role: .user, content: "Cycling recovery")])
        child.lineageRootID = "root"; child.parentConversationID = "root"; child.historyLoaded = true
        var archived = Conversation(id: "archive", title: "Old notes", messages: [ChatMessage(id: "a", role: .user, content: "Calories last year")])
        archived.archived = true
        let store = MemoryConversationStore()
        store.accounts["device"] = ChatSnapshot(conversations: [root, child, archived])
        let engine = ChatEngine(store: store)
        engine.selectConversation(id: "child")
        return (engine, store)
    }

    @Test func renamingQueuesEveryVersionAndSurvivesAccountRestoration() throws {
        let (engine, store) = fixture()
        #expect(engine.renameConversation(id: "child", title: "  Training notes  "))
        #expect(engine.savedConversations.filter { $0.id != "archive" }.allSatisfy { $0.title == "Training notes" })
        #expect(engine.pendingMetadata.count == 2)
        let snapshot = try #require(store.accounts["device"])
        store.accounts["device"] = try JSONDecoder().decode(ChatSnapshot.self, from: JSONEncoder().encode(snapshot))
        engine.switchAccount(to: "other")
        #expect(engine.pendingMetadata.isEmpty)
        engine.switchAccount(to: "device")
        #expect(engine.pendingMetadata.count == 2)
        #expect(engine.savedConversations.first { $0.id == "root" }?.title == "Training notes")
    }

    @Test func aStaleSnapshotCannotUndoThePendingRenameOrOverwriteAnotherDevicesPin() throws {
        let (engine, _) = fixture()
        #expect(engine.renameConversation(id: "child", title: "My title"))
        var remote = Conversation(id: "child", title: "Old server title")
        remote.lineageRootID = "root"; remote.pinned = true
        engine.applyRemoteMetadata(remote)
        #expect(engine.currentConversation.title == "My title")
        #expect(engine.currentConversation.pinned == true)
        let patch = try #require(engine.pendingMetadata["child"]?.first)
        let fields = try WebChatCodec.metadataPatch(patch, remote: ["title": "Old", "pinned": true, "custom": "keep", "rev": 10])
        #expect(fields["title"] as? String == "My title")
        #expect(fields["pinned"] == nil)
        #expect(fields["archived"] == nil)
        #expect(fields["ids"] == nil)
        #expect(fields["custom"] == nil)
    }

    @Test func queuedMutationsKeepTheirIdentityAndAcknowledgementsOnlyRemoveTheirOwnEntry() throws {
        let (engine, _) = fixture()
        #expect(engine.setPinned(id: "child", pinned: true))
        let old = try #require(engine.pendingMetadata["child"]?.first)
        #expect(engine.setPinned(id: "child", pinned: false))
        #expect(engine.setArchived(id: "child", archived: true))
        let queue = try #require(engine.pendingMetadata["child"])
        #expect(queue.count == 3)
        #expect(queue[1].pinned == false)
        #expect(queue[2].archived == true)
        engine.acknowledgeMetadata(chatID: "child", operationID: old.id)
        #expect(engine.pendingMetadata["child"]?.map(\.id) == Array(queue.dropFirst()).map(\.id))
        for item in queue { engine.acknowledgeMetadata(chatID: "child", operationID: item.id) }
        #expect(engine.pendingMetadata["child"] == nil)
        #expect(engine.savedConversations.filter { $0.id != "archive" }.allSatisfy { $0.pinned == false && $0.archived == true })
    }

    @Test func blankTitlesAndFailedSavesDoNotChangeTheGroup() {
        let (engine, store) = fixture()
        #expect(!engine.renameConversation(id: "child", title: " \n "))
        #expect(engine.pendingMetadata.isEmpty)
        store.failWrites = true
        #expect(!engine.setArchived(id: "child", archived: true))
        #expect(engine.currentConversation.archived != true)
        #expect(engine.pendingMetadata.isEmpty)
        #expect(engine.savedConversations.first { $0.id == "root" }?.archived != true)
    }

    @Test func searchFindsAnEarlierVersionByMessageTextWithoutDuplicateGroups() {
        let (engine, _) = fixture()
        let result = engine.searchConversations(query: "energie", scope: .active)
        #expect(result.count == 1)
        #expect(result.first?.conversation.id == "root")
        #expect(result.first?.preview == "Énergie and training")
        #expect(engine.searchConversations(query: "CALORIES", scope: .active).isEmpty)
        #expect(engine.searchConversations(query: "CALORIES", scope: .archived).first?.conversation.id == "archive")
        #expect(engine.setPinned(id: "child", pinned: true))
        #expect(engine.searchConversations(query: "", scope: .pinned).count == 1)
        engine.switchAccount(to: "other")
        #expect(engine.searchConversations(query: "energie", scope: .active).isEmpty)
    }

    @Test func metadataMutationWillNotResurrectADeletedOrMissingRemoteChat() {
        let patch = ChatMetadataPatch(title: "New title")
        #expect(throws: WebSyncError.self) { try WebChatCodec.metadataPatch(patch, remote: ["deleted": true]) }
        #expect(throws: WebSyncError.self) { try WebChatCodec.metadataPatch(patch, remote: nil) }
    }
    @Test func failedAcknowledgementKeepsTheDurableMetadataIntent() throws {
        let (engine, store) = fixture()
        #expect(engine.setPinned(id: "child", pinned: true))
        let patch = try #require(engine.pendingMetadata["child"]?.first)
        store.failWrites = true
        engine.acknowledgeMetadata(chatID: "child", operationID: patch.id)
        #expect(engine.pendingMetadata["child"]?.first?.id == patch.id)
    }

    @Test func anAlreadyAppliedMutationDoesNotOverwriteALaterWebRename() throws {
        let patch = ChatMetadataPatch(title: "Earlier native title")
        let fields = try WebChatCodec.metadataPatch(patch, remote: ["title": "New web title", "nativeMetadataOp": patch.id])
        #expect(fields.isEmpty)
    }

    @Test func pinningDoesNotReplaceTheNewestUnsavedReplyWithAnOlderSnapshot() {
        let (engine, _) = fixture()
        engine.currentConversation.messages.append(ChatMessage(id: "live", role: .assistant, content: "Newest partial tail", status: .streaming))
        #expect(engine.setPinned(id: "child", pinned: true))
        #expect(engine.currentConversation.messages.last?.content == "Newest partial tail")
    }

    @Test func aReplayedRenameKeepsItsIdentityWhenANewPinIsQueuedAfterRestart() throws {
        let (engine, store) = fixture()
        #expect(engine.renameConversation(id: "child", title: "Native A"))
        let old = try #require(engine.pendingMetadata["child"]?.first)
        store.failWrites = true
        #expect(!engine.acknowledgeMetadata(chatID: "child", operationID: old.id))
        store.failWrites = false
        let restarted = ChatEngine(store: store)
        #expect(restarted.setPinned(id: "child", pinned: true))
        let queue = try #require(restarted.pendingMetadata["child"])
        #expect(queue.first?.id == old.id)
        let combined = try #require(queue.last)
        // The remote operation marker for old.id already exists. Pin must never replay title A.
        let replay = try WebChatCodec.metadataPatch(combined, remote: ["title": "Later web B", "nativeMetadataOp": old.id])
        #expect(replay["title"] == nil)
        #expect(replay["pinned"] as? Bool == true)
        #expect(restarted.acknowledgeMetadata(chatID: "child", operationID: old.id))
        let encoded = try JSONEncoder().encode(try #require(store.accounts["device"]))
        let restored = try JSONDecoder().decode(ChatSnapshot.self, from: encoded)
        #expect(restored.pendingMetadata?["child"]?.first?.id == combined.id)
    }

}
