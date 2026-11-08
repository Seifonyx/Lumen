import Foundation
import Observation
import FirebaseFirestore
import LumenCore

@MainActor @Observable final class CloudChatSync {
    private(set) var isLoading = false
    private(set) var errorMessage: String?
    private(set) var status = "Saved on this iPhone"
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
        listener?.remove()
        listener = nil
        draining?.cancel()
        draining = nil
        loading = []
        epoch = UUID()
        accountID = userID
        errorMessage = nil
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
            receiveKeys?(userID, keys)
        } catch {
            guard epoch == ticket else { return }
            errorMessage = "Account provider keys could not load. You can connect a provider in Settings."
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
                guard let fields = before.data(), fields["deleted"] as? Bool != true else {
                    engine.applyRemoteDeletion(chatID: chatID)
                    return
                }
                let snapshot = try await reference.collection("messages").order(by: "index").getDocuments(source: .server)
                let after = try await reference.getDocument(source: .server)
                guard epoch == session else { return }
                guard let latest = after.data(), latest["deleted"] as? Bool != true else {
                    engine.applyRemoteDeletion(chatID: chatID)
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
                    } else if let (chatID, ids) = engine.pendingMessages.first(where: { !$0.value.isEmpty }),
                              let chat = engine.savedConversations.first(where: { $0.id == chatID }) {
                        status = "Syncing…"
                        do { try await append(chat: chat, ids: ids, uid: accountID) }
                        catch WebSyncError.deleted {
                            guard epoch == ticket else { return }
                            engine.applyRemoteDeletion(chatID: chatID)
                            continue
                        }
                        guard epoch == ticket else { return }
                        engine.acknowledge(chatID: chatID, messageIDs: ids)
                    } else {
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

    private func append(chat: Conversation, ids: Set<String>, uid: String) async throws {
        let reference = chats(uid).document(chat.id)
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, any Error>) in
            db.runTransaction({ transaction, errorPointer in
                do {
                    let remote = try transaction.getDocument(reference)
                    var existing: [String: [String: Any]] = [:]
                    for id in ids {
                        let message = try transaction.getDocument(reference.collection("messages").document(id))
                        if let fields = message.data() { existing[id] = fields }
                    }
                    let plan = try WebChatCodec.append(chat: chat, messageIDs: ids, remote: remote.data(), existingMessages: existing)
                    for (id, var fields) in plan.messages {
                        fields["srv"] = FieldValue.serverTimestamp()
                        transaction.setData(fields, forDocument: reference.collection("messages").document(id), merge: true)
                    }
                    var fields = plan.metadata
                    fields["srv"] = FieldValue.serverTimestamp()
                    transaction.setData(fields, forDocument: reference, merge: true)
                } catch { errorPointer?.pointee = error as NSError }
                return nil
            }, completion: { _, error in
                if let error { continuation.resume(throwing: error) }
                else { continuation.resume() }
            })
        }
    }
}

private enum RemoteChatChange: Sendable { case deleted(String), metadata(Conversation) }
