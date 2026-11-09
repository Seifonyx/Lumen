import Foundation
import Observation
import FirebaseFirestore
import LumenCore

@MainActor @Observable final class CloudChatSync {
    private(set) var isLoading = false
    private(set) var errorMessage: String?
    private(set) var status = "Saved on this iPhone"
    private(set) var keyErrorMessage: String?
    private(set) var isLoadingKeys = false
    private let db: Firestore
    private let engine: ChatEngine
    private var accountID: String?
    private var epoch = UUID()
    private var listener: ListenerRegistration?
    private var draining: Task<Void, Never>?
    private var loading: Set<String> = []
    var receiveKeys: ((String, [String: String]) -> Void)?

    init(engine: ChatEngine, db: Firestore = Firestore.firestore()) {
        self.engine = engine
        self.db = db
        let settings = db.settings
        settings.cacheSettings = MemoryCacheSettings()
        db.settings = settings
        engine.onChange = { [weak self] in self?.schedule() }
    }

    func connect(userID: String?) {
        #if DEBUG && targetEnvironment(simulator)
        DebugIntegration.record("cloud-connect", fields: ["signedIn": String(userID != nil)])
        #endif
        listener?.remove()
        listener = nil
        draining?.cancel()
        draining = nil
        loading = []
        epoch = UUID()
        accountID = userID
        errorMessage = nil
        keyErrorMessage = nil
        isLoadingKeys = false
        isLoading = userID != nil
        status = userID == nil ? "Saved on this iPhone" : "Loading your chats…"
        engine.switchAccount(to: userID ?? "device")
        guard let userID else { return }
        let ticket = epoch
        listener = chats(userID).addSnapshotListener { [weak self] snapshot, error in
            let changes: [RemoteChatChange] = snapshot?.documentChanges.compactMap { change in
                let fields = change.document.data()
                if change.type == .removed || fields["deleted"] as? Bool == true { return .deleted(change.document.documentID) }
                guard let chat = try? WebChatCodec.conversation(id: change.document.documentID, fields: fields) else { return nil }
                return .metadata(chat)
            } ?? []
            let failed = error != nil
            Task { @MainActor [weak self] in
                guard let self, self.epoch == ticket else { return }
                self.isLoading = false
                if failed {
                    self.errorMessage = "Cloud history could not load. Check your connection and that you used your existing Lumen Google account."
                    self.status = "Saved on this iPhone"
                    return
                }
                self.errorMessage = nil
                for change in changes {
                    switch change {
                    case .deleted(let id): self.engine.applyRemoteDeletion(chatID: id)
                    case .metadata(let chat): self.engine.applyRemoteMetadata(chat)
                    }
                }
                self.status = "Up to date"
                self.schedule()
                let current = self.engine.currentConversation
                if !self.engine.isStreaming, current.historyLoaded == false { await self.loadMessages(chatID: current.id) }
            }
        }
        Task { [weak self] in await self?.refreshKeys(ticket: ticket, userID: userID) }
        schedule()
    }

    func retry() {
        guard accountID != nil else { return }
        errorMessage = nil
        schedule()
        if engine.currentConversation.historyLoaded == false { Task { await loadMessages(chatID: engine.currentConversation.id) } }
    }

    func refreshKeys() async {
        guard let accountID else { return }
        await refreshKeys(ticket: epoch, userID: accountID)
    }

    private func refreshKeys(ticket: UUID, userID: String) async {
        guard epoch == ticket else { return }
        isLoadingKeys = true
        keyErrorMessage = nil
        defer { if epoch == ticket { isLoadingKeys = false } }
        #if DEBUG && targetEnvironment(simulator)
        DebugIntegration.record("cloud-key-start", fields: ["host": db.settings.host, "ssl": String(db.settings.isSSLEnabled), "project": db.app.options.projectID ?? ""])
        #endif
        do {
            let snapshot = try await db.collection("modelRouter").document(userID).getDocument(source: .server)
            guard epoch == ticket else { return }
            let fields = snapshot.data() ?? [:]
            let extra = fields["providerConnections"] as? [String: Any] ?? [:]
            var keys: [String: String] = [:]
            for id in ["groq", "gemini", "openai", "anthropic"] {
                let key = fields[id + "Key"] as? String ?? extra[id] as? String ?? ""
                if !key.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { keys[id] = key }
            }
            #if DEBUG && targetEnvironment(simulator)
            DebugIntegration.record("cloud-key-read", fields: ["exists": String(snapshot.exists), "count": String(keys.count)])
            #endif
            receiveKeys?(userID, keys)
        } catch {
            guard epoch == ticket else { return }
            keyErrorMessage = "Account providers could not load. Try loading them again, or connect a provider in Settings."
            #if DEBUG && targetEnvironment(simulator)
            let failure = error as NSError
            DebugIntegration.record("cloud-key-failed", fields: ["domain": failure.domain, "code": String(failure.code)])
            #endif
        }
    }

    func loadMessages(chatID: String) async {
        guard let accountID, !loading.contains(chatID), !engine.isStreaming else { return }
        let session = epoch
        loading.insert(chatID)
        defer { if epoch == session { loading.remove(chatID) } }
        do {
            let reference = chats(accountID).document(chatID)
            for _ in 0..<3 {
                guard epoch == session, !engine.isStreaming,
                      let ticket = engine.historyLoadTicket(chatID: chatID) else { return }
                let before = try await reference.getDocument(source: .server)
                guard epoch == session else { return }
                if WebChatCodec.isTombstone(before.data()) { engine.applyRemoteDeletion(chatID: chatID); return }
                guard let fields = before.data() else {
                    // A locally accepted chat may not have reached Firestore yet. Absence is not deletion.
                    if !(engine.pendingMessages[chatID] ?? []).isEmpty { schedule(); return }
                    errorMessage = "Cloud history is not available for this chat yet. Your saved messages are kept."
                    return
                }
                let snapshot = try await reference.collection("messages").order(by: "index").getDocuments(source: .server)
                let after = try await reference.getDocument(source: .server)
                guard epoch == session else { return }
                if WebChatCodec.isTombstone(after.data()) { engine.applyRemoteDeletion(chatID: chatID); return }
                guard let latest = after.data() else {
                    errorMessage = "Cloud history is not available for this chat yet. Your saved messages are kept."
                    return
                }
                // Metadata and messages are separate reads. Retry if a writer moved the boundary.
                guard WebChatCodec.revision(fields) == WebChatCodec.revision(latest),
                      fields["ids"] as? [String] == latest["ids"] as? [String] else {
                    if let metadata = try? WebChatCodec.conversation(id: chatID, fields: latest) { engine.applyRemoteMetadata(metadata) }
                    continue
                }
                let messages = try snapshot.documents.map { try WebChatCodec.message(id: $0.documentID, fields: $0.data()) }
                let ids = latest["ids"] as? [String] ?? messages.map(\.id)
                guard Set(ids).isSubset(of: Set(messages.map(\.id))) else { throw WebSyncError.invalid }
                if engine.applyRemoteMessages(chatID: chatID, messages: messages, orderedIDs: ids,
                                              ticket: ticket, revision: WebChatCodec.revision(latest)) {
                    errorMessage = nil
                    return
                }
            }
            errorMessage = "This chat changed while loading. Tap Retry to load its latest messages."
        } catch {
            guard epoch == session else { return }
            errorMessage = "This chat could not finish loading. Your saved messages are kept; try again when connected."
        }
    }

    private func chats(_ uid: String) -> CollectionReference { db.collection("modelRouter").document(uid).collection("chats") }

    private func schedule() {
        guard let accountID, engine.accountID == accountID, draining == nil else { return }
        let ticket = epoch
        draining = Task { [weak self] in
            guard let self else { return }
            defer { if epoch == ticket { draining = nil } }
            do {
                while epoch == ticket, !Task.isCancelled {
                    if let chatID = engine.pendingDeletions.first {
                        status = "Syncing…"
                        let backend = FirestoreChatDeletion(db: db, userID: accountID)
                        try await ChatDeletion.run(chatID: chatID, backend: backend)
                        guard epoch == ticket else { return }
                        engine.acknowledgeDeletion(chatID: chatID)
                    } else if let chat = engine.nextPendingConversation(), let ids = engine.pendingMessages[chat.id] {
                        let chatID = chat.id
                        status = "Syncing…"
                        do { try await append(chat: chat, ids: ids, uid: accountID) }
                        catch WebSyncError.deleted {
                            guard epoch == ticket else { return }
                            engine.applyRemoteDeletion(chatID: chatID)
                            continue
                        }
                        guard epoch == ticket else { return }
                        engine.acknowledge(chatID: chatID, messageIDs: ids)
                    } else if let (chatID, patches) = engine.pendingMetadata.sorted(by: { $0.key < $1.key }).first, let patch = patches.first {
                        status = "Syncing…"
                        do { try await applyMetadata(patch, chatID: chatID, uid: accountID) }
                        catch WebSyncError.deleted {
                            guard epoch == ticket else { return }
                            engine.applyRemoteDeletion(chatID: chatID)
                            continue
                        }
                        guard epoch == ticket else { return }
                        if !engine.acknowledgeMetadata(chatID: chatID, operationID: patch.id) { throw CocoaError(.fileWriteOutOfSpace) }
                        let latest = try await chats(accountID).document(chatID).getDocument(source: .server)
                        guard epoch == ticket else { return }
                        if WebChatCodec.isTombstone(latest.data()) { engine.applyRemoteDeletion(chatID: chatID) }
                        else if let fields = latest.data(), let chat = try? WebChatCodec.conversation(id: chatID, fields: fields) {
                            engine.applyRemoteMetadata(chat)
                        }
                    } else {
                        if engine.pendingMessages.values.contains(where: { !$0.isEmpty }) { throw WebSyncError.conflict }
                        status = "Up to date"
                        break
                    }
                }
            } catch {
                guard epoch == ticket else { return }
                status = "Saved on this iPhone"
                errorMessage = (error as? WebSyncError)?.errorDescription ?? "Cloud sync is paused. Your messages are saved on this iPhone. Tap Retry when connected."
            }
        }
    }

    private func applyMetadata(_ patch: ChatMetadataPatch, chatID: String, uid: String) async throws {
        let reference = chats(uid).document(chatID)
        let operation = reference.collection("nativeMetadataOps").document(patch.id)
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, any Error>) in
            db.runTransaction({ @Sendable transaction, errorPointer in
                do {
                    // A durable marker prevents a replayed local outbox from undoing a later edit.
                    if try transaction.getDocument(operation).exists { return nil }
                    let remote = try transaction.getDocument(reference)
                    var fields = try WebChatCodec.metadataPatch(patch, remote: remote.data())
                    if !fields.isEmpty {
                        fields["srv"] = FieldValue.serverTimestamp()
                        transaction.setData(fields, forDocument: reference, merge: true)
                    }
                    transaction.setData(["appliedAt": FieldValue.serverTimestamp()], forDocument: operation)
                } catch { errorPointer?.pointee = error as NSError }
                return nil
            }, completion: { @Sendable _, error in
                if let error { continuation.resume(throwing: error) } else { continuation.resume() }
            })
        }
    }

    private func append(chat: Conversation, ids: Set<String>, uid: String) async throws {
        let reference = chats(uid).document(chat.id)
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, any Error>) in
            // Firestore executes transaction updates off the main actor, including retries.
            db.runTransaction({ @Sendable transaction, errorPointer in
                do {
                    let remote = try transaction.getDocument(reference)
                    let sourceReference = !remote.exists ? chat.parentConversationID.map {
                        reference.parent.document($0)
                    } : nil
                    let sourceMetadata = try sourceReference.map { try transaction.getDocument($0).data() }
                    var existing: [String: [String: Any]] = [:]
                    var inherited: [String: [String: Any]] = [:]
                    for id in ids {
                        let message = try transaction.getDocument(reference.collection("messages").document(id))
                        if let fields = message.data() { existing[id] = fields }
                        else if let sourceReference,
                                let local = chat.messages.first(where: { $0.id == id }),
                                let fields = try transaction.getDocument(sourceReference.collection("messages").document(local.sourceMessageID ?? id)).data() {
                            inherited[id] = fields
                        }
                    }
                    let plan = try WebChatCodec.append(chat: chat, messageIDs: ids, remote: remote.data(), existingMessages: existing,
                                                      sourceMetadata: sourceMetadata ?? nil, inheritedMessages: inherited)
                    for (id, var fields) in plan.messages {
                        fields["srv"] = FieldValue.serverTimestamp()
                        transaction.setData(fields, forDocument: reference.collection("messages").document(id), merge: true)
                    }
                    var fields = plan.metadata
                    fields["srv"] = FieldValue.serverTimestamp()
                    transaction.setData(fields, forDocument: reference, merge: true)
                } catch { errorPointer?.pointee = error as NSError }
                return nil
            }, completion: { @Sendable _, error in
                if let error { continuation.resume(throwing: error) }
                else { continuation.resume() }
            })
        }
    }
}

private enum RemoteChatChange: Sendable { case deleted(String), metadata(Conversation) }
