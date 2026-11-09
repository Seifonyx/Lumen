import Foundation
import Testing
@testable import LumenCore

private actor TemporaryClient: AIStreamingClient {
    func stream(messages: [ChatMessage], model: AIModel, apiKey: String) async throws -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { $0.yield("Secret response"); $0.finish() }
    }
}

@Suite @MainActor struct TemporaryChatTests {
    @Test func temporarySendAndRevisionNeverReachAnySnapshotOrOutbox() async throws {
        let store = MemoryConversationStore()
        let engine = ChatEngine(client: TemporaryClient(), store: store)
        engine.selectModel(AIModel.defaults[0])
        engine.startTemporaryConversation()
        #expect(engine.isTemporary)
        await try #require(engine.submit(prompt: "Secret question", apiKey: "fixture")).value
        let assistant = try #require(engine.currentConversation.messages.last)
        await try #require(engine.regenerate(messageID: assistant.id, apiKey: "fixture")).value
        #expect(engine.versions(for: engine.currentConversation.id).count == 2)
        #expect(engine.pendingMessages.isEmpty)
        #expect(engine.savedConversations.isEmpty)
        #expect(engine.historyConversations.isEmpty)
        // Unrelated cloud bookkeeping must not accidentally serialize the current temporary chat.
        engine.applyRemoteMetadata(Conversation(id: "remote", title: "Normal remote chat"))
        engine.acknowledgeDeletion(chatID: "old")
        let encoded = try JSONEncoder().encode(store.accounts)
        #expect(!String(decoding: encoded, as: UTF8.self).contains("Secret"))
        let restarted = ChatEngine(store: store)
        #expect(!restarted.isTemporary)
        #expect(restarted.currentConversation.messages.isEmpty)
        engine.startNewConversation()
        #expect(!engine.isTemporary)
        #expect(engine.versions(for: assistant.id).isEmpty)
    }

    @Test func lastRegularConversationRestoresWhileTemporaryModeIsForgotten() async throws {
        let store = MemoryConversationStore()
        let engine = ChatEngine(client: TemporaryClient(), store: store)
        engine.selectModel(AIModel.defaults[0])
        await try #require(engine.submit(prompt: "Regular question", apiKey: "fixture")).value
        let regularID = engine.currentConversation.id
        engine.startTemporaryConversation()
        await try #require(engine.submit(prompt: "Secret temporary", apiKey: "fixture")).value
        engine.switchAccount(to: "other")
        #expect(!engine.isTemporary)
        #expect(engine.currentConversation.messages.isEmpty)
        engine.switchAccount(to: "device")
        #expect(engine.currentConversation.id == regularID)
        #expect(engine.currentConversation.messages.first?.content == "Regular question")
        #expect(engine.savedConversations.count == 1)
    }

    @Test func draftSwitchingIsPerChatPerAccountAndTemporaryEditsNeverPersist() throws {
        let store = MemoryDraftStore()
        let state = DraftState(store: store, defaults: nil)
        state.activate(accountID: "a", conversationID: "one", temporary: false)
        state.draft = "First draft"; state.attachmentIDs = ["file-one"]
        state.activate(accountID: "a", conversationID: "two", temporary: false)
        #expect(state.draft.isEmpty)
        state.draft = "Second draft"
        state.activate(accountID: "b", conversationID: "one", temporary: false)
        #expect(state.draft.isEmpty)
        state.activate(accountID: "a", conversationID: "one", temporary: false)
        #expect(state.draft == "First draft")
        #expect(state.attachmentIDs == ["file-one"])
        state.activate(accountID: "a", conversationID: "temporary", temporary: true)
        state.draft = "Secret draft"; state.attachmentIDs = ["secret-file"]
        let bytes = try JSONEncoder().encode(store.accounts)
        #expect(!String(decoding: bytes, as: UTF8.self).contains("Secret"))
        #expect(!String(decoding: bytes, as: UTF8.self).contains("secret-file"))
        state.activate(accountID: "a", conversationID: "two", temporary: false)
        #expect(state.draft == "Second draft")
        #expect(state.savedDrafts.count == 2)
    }

    @Test func protectedDraftFilesRestoreContentWithoutWritingPreferences() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = FileDraftStore(directory: directory)
        let state = DraftState(store: store, defaults: nil)
        state.activate(accountID: "a/../b", conversationID: "chat", temporary: false)
        state.draft = "مرحبا 👋"
        let reopened = DraftState(store: store, defaults: nil)
        reopened.activate(accountID: "a/../b", conversationID: "chat", temporary: false)
        #expect(reopened.draft == "مرحبا 👋")
        let files = try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)
        #expect(files.allSatisfy { $0.deletingLastPathComponent().standardizedFileURL.path == directory.standardizedFileURL.path })
        for file in files {
            let attributes = try FileManager.default.attributesOfItem(atPath: file.path)
            #expect((attributes[.posixPermissions] as? NSNumber)?.intValue == 0o600)
        }
    }

    @Test func failedDraftSaveBlocksSwitchAndKeepsTextAndAttachments() {
        let store = MemoryDraftStore()
        let state = DraftState(store: store, defaults: nil)
        state.activate(accountID: "a", conversationID: "chat", temporary: false)
        state.draft = "Keep this"; state.attachmentIDs = ["file"]
        store.failWrites = true
        #expect(!state.activate(accountID: "a", conversationID: "other", temporary: false))
        #expect(state.conversationID == "chat")
        #expect(!state.discardDraft())
        #expect(state.draft == "Keep this" && state.attachmentIDs == ["file"])
    }

    @Test func aSecondTemporaryChatDoesNotReplaceTheRegularRestorationSlot() throws {
        let store = MemoryConversationStore()
        let engine = ChatEngine(store: store)
        let regular = engine.currentConversation.id
        engine.startTemporaryConversation(); engine.startTemporaryConversation()
        engine.acknowledgeDeletion(chatID: "normal-operation")
        #expect(store.accounts["device"]?.selectedConversationID == regular)
    }

    @Test func failedAccountDraftEditsRemainInMemoryAndRecoverOnlyInTheirAccount() {
        let store = MemoryDraftStore()
        let drafts = DraftState(store: store, defaults: nil)
        drafts.activate(accountID: "a", conversationID: "one", temporary: false)
        drafts.draft = "Earlier"
        store.failWrites = true
        drafts.draft = "Latest unsaved"; drafts.attachmentIDs = ["latest-file"]
        drafts.activate(accountID: "b", conversationID: "two", temporary: false)
        #expect(drafts.draft.isEmpty && drafts.attachmentIDs.isEmpty)
        store.failWrites = false
        drafts.activate(accountID: "a", conversationID: "one", temporary: false)
        #expect(drafts.draft == "Latest unsaved" && drafts.attachmentIDs == ["latest-file"])
        #expect(drafts.save())
        #expect(store.accounts["a"]?["one"]?.text == "Latest unsaved")
    }

    @Test func requiredModeSynchronizationCannotKeepARegularComposerInTemporaryUIAfterASaveFailure() throws {
        let store = MemoryDraftStore()
        let state = DraftState(store: store, defaults: nil)
        state.activate(accountID: "a", conversationID: "regular", temporary: false)
        state.draft = "Ordinary draft"
        #expect(state.save()) // Navigation preflight succeeds.
        store.failWrites = true
        state.synchronize(accountID: "a", conversationID: "temporary", temporary: true)
        #expect(state.isTemporary && state.conversationID == "temporary")
        store.failWrites = false
        state.draft = "SECRET_TYPED_IN_TEMP_UI"
        #expect(!String(decoding: try JSONEncoder().encode(store.accounts), as: UTF8.self).contains("SECRET_TYPED_IN_TEMP_UI"))
        state.synchronize(accountID: "a", conversationID: "regular", temporary: false)
        #expect(state.draft == "Ordinary draft")
        store.failWrites = true
        state.draft = "Uncheckpointed original draft"
        // A revision or remote deletion changes the engine chat without navigation preflight.
        state.synchronize(accountID: "a", conversationID: "revision", temporary: false)
        #expect(state.conversationID == "revision" && state.draft.isEmpty)
        store.failWrites = false
        state.synchronize(accountID: "a", conversationID: "regular", temporary: false)
        #expect(state.draft == "Uncheckpointed original draft")
    }

    @Test func failedDraftMigrationKeepsLegacyContentUntilProtectedSaveSucceeds() {
        let defaults = UserDefaults(suiteName: "DraftMigration.\(UUID().uuidString)")!
        defaults.set("Legacy draft", forKey: "lumen.unsent-draft")
        let store = MemoryDraftStore(); store.failWrites = true
        let state = DraftState(store: store, defaults: defaults)
        #expect(state.draft == "Legacy draft")
        #expect(state.errorMessage != nil)
        #expect(defaults.string(forKey: "lumen.unsent-draft") == "Legacy draft")
        store.failWrites = false
        #expect(state.save())
        #expect(defaults.string(forKey: "lumen.unsent-draft") == nil)
    }
}
