import Foundation
import Observation
import Network
import FirebaseFirestore
import LumenCore

@MainActor @Observable final class CloudChatSync {
    private(set) var isLoading = false
    private(set) var errorMessage: String?
    private(set) var status = "Saved on this iPhone"
    private(set) var keyErrorMessage: String?
    private(set) var isLoadingKeys = false
    /// The account's projects, live from the web's settings document.
    private(set) var projects: [LumenProject] = []
    private var accountListener: ListenerRegistration?
    private var memoryListener: ListenerRegistration?
    /// The account's personalization and memories, live from the web's documents.
    private(set) var personalization = Personalization()
    private(set) var memories: [Memory] = []
    private let db: Firestore
    private let engine: ChatEngine
    private var accountID: String?
    private var epoch = UUID()
    private var listener: ListenerRegistration?
    private var draining: Task<Void, Never>?
    private var loading: Set<String> = []
    private var retryState = SyncRetryQueue()
    private var retryTask: Task<Void, Never>?
    private let network = NWPathMonitor()
    private enum Operation { case deletion(String), append(Conversation, Set<String>), metadata(String, ChatMetadataPatch)
        var chatID: String { switch self { case .deletion(let id), .metadata(let id, _): id; case .append(let chat, _): chat.id } }
    }
    var receiveKeys: ((String, [String: String]) -> Void)?

    init(engine: ChatEngine, db: Firestore = Firestore.firestore()) {
        self.engine = engine
        self.db = db
        let settings = db.settings
        settings.cacheSettings = MemoryCacheSettings()
        db.settings = settings
        engine.onChange = { [weak self] in self?.schedule() }
        network.pathUpdateHandler = { [weak self] path in
            if path.status == .satisfied { Task { @MainActor [weak self] in self?.retry() } }
        }
        network.start(queue: DispatchQueue(label: "lumen.cloud-connectivity"))
    }

    func connect(userID: String?) {
        #if DEBUG && targetEnvironment(simulator)
        DebugIntegration.record("cloud-connect", fields: ["signedIn": String(userID != nil)])
        #endif
        listener?.remove()
        listener = nil
        accountListener?.remove()
        accountListener = nil
        memoryListener?.remove()
        memoryListener = nil
        memories = []
        personalization = Personalization()
        engine.memories = []
        engine.projectNames = [:]
        engine.personalization = { var off = Personalization(); off.memory = false; return off }()
        projects = []
        engine.projectInstructions = [:]
        retryTask?.cancel(); retryTask = nil; retryState.reset()
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
        // Projects live in the account's settings, which the web app may change at any time.
        accountListener = db.collection("modelRouter").document(userID).addSnapshotListener { [weak self] snapshot, _ in
            guard let snapshot else { return }
            let settings = snapshot.data()?["settings"] as? [String: Any]
            let projects = ProjectSettings.projects(from: settings)
            let personalization = Personalization(settings: settings)
            Task { @MainActor [weak self] in
                guard let self, self.epoch == ticket else { return }
                self.projects = projects
                self.personalization = personalization
                self.engine.personalization = personalization
                self.engine.projectInstructions = Dictionary(projects.map { ($0.id, $0.instructions) }, uniquingKeysWith: { first, _ in first })
                self.engine.projectNames = Dictionary(projects.map { ($0.id, $0.name) }, uniquingKeysWith: { first, _ in first })
            }
        }
        // Memories: one document shared by every device, as on the web.
        memoryListener = memoryDocument(userID).addSnapshotListener { [weak self] snapshot, _ in
            guard let snapshot else { return }
            let memories = MemoryRules.memories(from: snapshot.data())
            Task { @MainActor [weak self] in
                guard let self, self.epoch == ticket else { return }
                self.memories = memories
                self.engine.memories = memories
            }
        }
        engine.onMemoryOperations = { [weak self] operations, chatID, projectID in
            Task { @MainActor [weak self] in await self?.apply(operations, chatID: chatID, projectID: projectID) }
        }
        Task { [weak self] in await self?.refreshKeys(ticket: ticket, userID: userID) }
        schedule()
    }

    /// Creates, edits or deletes a project in the account's settings, the same place the web keeps them. Done in a
    /// transaction on the current settings, so a change made meanwhile on the web is kept, and only `projects`
    /// changes. Needs a connection: the result is shown only once it is saved.
    func saveProject(_ edit: ProjectEdit) async throws {
        let now = Date().timeIntervalSince1970 * 1000
        try await updateSettings { try ProjectSettings.apply(edit, to: $0, now: now) }
        if case .delete(let id) = edit {
            // As on the web: the project's chats stay, outside any project.
            for chat in engine.savedConversations where chat.projectId == id {
                _ = engine.moveConversation(id: chat.id, toProject: nil)
            }
        }
    }

    func retry() {
        guard accountID != nil else { return }
        errorMessage = nil
        retryTask?.cancel(); retryTask = nil; retryState.reset()
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
            keyErrorMessage = "Your account's providers could not load. Try again, or connect a provider with its API key."
            #if DEBUG && targetEnvironment(simulator)
            let failure = error as NSError
            DebugIntegration.record("cloud-key-failed", fields: ["domain": failure.domain, "code": String(failure.code)])
            #endif
        }
    }

    func isLoadingMessages(chatID: String) -> Bool { loading.contains(chatID) }

    func loadMessages(chatID: String, older: Bool = false) async {
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
                guard let ordered = fields["ids"] as? [String] else { throw WebSyncError.unsupported }
                let loaded = engine.savedConversations.first { $0.id == chatID }?.messages.map(\.id) ?? []
                let page = try HistoryPaging.pageIDs(orderedIDs: ordered, loadedIDs: loaded, older: older)
                var messages: [ChatMessage] = []
                // Firestore IN queries accept30 document IDs; bound each page to two reads.
                for start in stride(from: 0, to: page.count, by: 30) {
                    let ids = Array(page[start..<min(start + 30, page.count)])
                    let snapshot = try await reference.collection("messages").whereField(FieldPath.documentID(), in: ids).getDocuments(source: .server)
                    messages += try snapshot.documents.map { try WebChatCodec.message(id: $0.documentID, fields: $0.data()) }
                }
                // A complete one-page transcript already contains every system
                // instruction; don't issue an unnecessary second query. This also
                // avoids holding small chats in "Loading conversation" while that
                // independent Firestore query waits for an index/server response.
                let instructions: [ChatMessage]
                if page.count == ordered.count && Set(page) == Set(ordered) {
                    instructions = messages.filter { $0.role == .system }
                } else {
                    // A paged chat can have instructions older than the visible page.
                    // Only accept independently fetched IDs belonging to this snapshot.
                    let instructionDocs = try await reference.collection("messages")
                        .whereField("role", isEqualTo: MessageRole.system.rawValue).getDocuments(source: .server)
                    let authoritativeIDs = Set(ordered)
                    instructions = try instructionDocs.documents
                        .filter { authoritativeIDs.contains($0.documentID) }
                        .map { try WebChatCodec.message(id: $0.documentID, fields: $0.data()) }
                }
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
                let ids = latest["ids"] as? [String] ?? []
                guard Set(page) == Set(messages.map(\.id)) else { throw WebSyncError.invalid }
                // Originals are fetched only for supported image references; extracted text travels with metadata.
                for file in messages.flatMap({ $0.attachments ?? [] }) where file.kind == .image {
                    if (try? engine.attachmentForSync(id: file.id)) != nil { continue }
                    let original = try? await db.collection("modelRouter").document(accountID).collection("files").document(file.id).getDocument(source: .server)
                    guard epoch == session else { return }
                    if let base64 = original?.data()?["data"] as? String, base64.count <= 820_000, let bytes = Data(base64Encoded: base64) {
                        var hydrated = file; hydrated.data = bytes
                        // Originals are optional for loading the transcript.
                        try? engine.cacheAttachment(hydrated)
                    }
                }
                if engine.applyRemotePage(chatID: chatID, messages: messages, orderedIDs: ids,
                                          ticket: ticket, revision: WebChatCodec.revision(latest), reset: !older,
                                          systemMessages: instructions) {
                    errorMessage = nil
                    return
                }
            }
            errorMessage = "This chat changed while loading. Tap Retry to load its latest messages."
        } catch {
            guard epoch == session else { return }
            errorMessage = (error as? WebSyncError)?.errorDescription ?? "This chat could not finish loading. Your saved messages are kept; try again when connected."
            scheduleRetry(after: 15)
        }
    }

    private func chats(_ uid: String) -> CollectionReference { db.collection("modelRouter").document(uid).collection("chats") }

    private func nextOperation() -> Operation? {
        let blocked = retryState.blockedIDs()
        if let id = engine.pendingDeletions.sorted().first(where: { !blocked.contains($0) }) { return .deletion(id) }
        if let chat = engine.nextPendingConversation(excluding: blocked), let ids = engine.pendingMessages[chat.id],
           let message = chat.messages.first(where: { ids.contains($0.id) }) {
            // One original-bearing message per transaction keeps even four images below Firestore's size limit.
            return .append(chat, [message.id])
        }
        if let (id, queue) = engine.pendingMetadata.sorted(by: { $0.key < $1.key }).first(where: {
            !blocked.contains($0.key) && (engine.pendingMessages[$0.key] ?? []).isEmpty
        }), let patch = queue.first { return .metadata(id, patch) }
        return nil
    }

    private var hasPendingWork: Bool {
        !engine.pendingDeletions.isEmpty || engine.pendingMessages.values.contains(where: { !$0.isEmpty }) || !engine.pendingMetadata.isEmpty
    }

    private func schedule() {
        guard let accountID, engine.accountID == accountID, draining == nil else { return }
        let ticket = epoch
        draining = Task { [weak self] in
            guard let self else { return }
            defer { if epoch == ticket { draining = nil } }
            while epoch == ticket, !Task.isCancelled, let operation = nextOperation() {
                status = "Syncing…"
                do {
                    switch operation {
                    case .deletion(let id):
                        try await ChatDeletion.run(chatID: id, backend: FirestoreChatDeletion(db: db, userID: accountID))
                        guard epoch == ticket else { return }
                        engine.acknowledgeDeletion(chatID: id)
                    case .append(let chat, let ids):
                        try await append(chat: chat, ids: ids, uid: accountID)
                        guard epoch == ticket else { return }
                        engine.acknowledge(chatID: chat.id, messageIDs: ids)
                    case .metadata(let id, let patch):
                        try await applyMetadata(patch, chatID: id, uid: accountID)
                        guard epoch == ticket else { return }
                        if !engine.acknowledgeMetadata(chatID: id, operationID: patch.id) { throw CocoaError(.fileWriteOutOfSpace) }
                        let latest = try await chats(accountID).document(id).getDocument(source: .server)
                        guard epoch == ticket else { return }
                        if WebChatCodec.isTombstone(latest.data()) { engine.applyRemoteDeletion(chatID: id) }
                        else if let fields = latest.data(), let chat = try? WebChatCodec.conversation(id: id, fields: fields) { engine.applyRemoteMetadata(chat) }
                    }
                    retryState.succeeded(chatID: operation.chatID)
                } catch WebSyncError.deleted {
                    guard epoch == ticket else { return }
                    engine.applyRemoteDeletion(chatID: operation.chatID)
                    retryState.succeeded(chatID: operation.chatID)
                } catch {
                    guard epoch == ticket else { return }
                    retryState.failed(chatID: operation.chatID)
                    errorMessage = (error as? WebSyncError)?.errorDescription ?? "Some changes are waiting to sync. They are saved on this iPhone and will retry automatically."
                }
            }
            guard epoch == ticket else { return }
            if hasPendingWork {
                status = "Waiting to sync"
                if let delay = retryState.nextDelay() { scheduleRetry(after: delay) }
                else { errorMessage = "A conversation version is waiting for its original to sync. Tap Retry when connected." }
            } else { status = "Up to date"; errorMessage = nil }
        }
    }

    private func scheduleRetry(after seconds: TimeInterval) {
        guard accountID != nil, retryTask == nil else { return }
        let session = epoch
        retryTask = Task { [weak self] in
            do { try await Task.sleep(for: .seconds(seconds)) } catch { return }
            guard let self, epoch == session else { return }
            retryTask = nil
            schedule()
            if engine.currentConversation.historyLoaded == false { await loadMessages(chatID: engine.currentConversation.id) }
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
        var unique: [String: ChatAttachment] = [:]
        for message in chat.messages where ids.contains(message.id) {
            // The transaction copies inherited file references from the parent.
            // A fork must still sync if an older web original was never uploaded.
            guard chat.inheritedMessageIDs?.contains(message.id) != true else { continue }
            for file in message.attachments ?? [] {
                if file.kind == .text { unique[file.id] = file }
                else if file.kind == .image { unique[file.id] = try engine.attachmentForSync(id: file.id) }
            }
        }
        let originals = Array(unique.values)
        let files = db.collection("modelRouter").document(uid).collection("files")
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, any Error>) in
            // Firestore executes transaction updates off the main actor, including retries.
            db.runTransaction({ @Sendable transaction, errorPointer in
                do {
                    let remote = try transaction.getDocument(reference)
                    let sourceReference = chat.parentConversationID.map { reference.parent.document($0) }
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
                    var missing: [ChatAttachment] = []
                    for file in originals {
                        if try !transaction.getDocument(files.document(file.id)).exists { missing.append(file) }
                    }
                    for file in missing {
                        try file.validate()
                        let bytes = file.data ?? Data((file.text ?? "").utf8)
                        transaction.setData(["chatId": chat.lineageRootID ?? chat.id, "name": file.name, "mime": file.mime,
                                             "kind": file.kind.rawValue, "data": bytes.base64EncodedString(),
                                             "srv": FieldValue.serverTimestamp()], forDocument: files.document(file.id))
                    }
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

extension CloudChatSync {
    private func memoryDocument(_ uid: String) -> DocumentReference {
        db.collection("modelRouter").document(uid).collection("memory").document("all")
    }

    /// Changes the account's settings in a transaction on the current snapshot, so a change made meanwhile on the
    /// web is kept and only what `transform` changes is written (the web replaces `settings` the same way).
    func updateSettings(_ transform: @escaping @Sendable ([String: Any]?) throws -> [String: Any]) async throws {
        guard let accountID else { throw ProjectSaveError.signedOut }
        let reference = db.collection("modelRouter").document(accountID)
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, any Error>) in
            db.runTransaction({ @Sendable transaction, errorPointer in
                do {
                    let current = try transaction.getDocument(reference).data()?["settings"] as? [String: Any]
                    transaction.setData(["settings": try transform(current), "updatedAt": FieldValue.serverTimestamp()],
                                        forDocument: reference, mergeFields: ["settings", "updatedAt"])
                } catch {
                    errorPointer?.pointee = NSError(domain: "LumenSettings", code: 1,
                                                    userInfo: [NSLocalizedDescriptionKey: error.localizedDescription])
                }
                return nil
            }, completion: { @Sendable _, error in
                if let error { continuation.resume(throwing: error) } else { continuation.resume() }
            })
        }
    }

    func savePersonalization(_ value: Personalization) async throws {
        try await updateSettings { value.apply(to: $0) }
    }

    /// Adds a memory you write yourself (as "manual", like the web's Memory settings).
    func addMemory(_ text: String) async throws {
        let text = MemoryRules.clip(text)
        guard !text.isEmpty else { return }
        guard let accountID else { throw ProjectSaveError.signedOut }
        guard !memories.contains(where: { MemoryRules.same($0.text, text) }) else { return }
        guard memories.count < MemoryRules.maximumMemories else { throw MemoryError.full }
        let now = Date().timeIntervalSince1970 * 1000
        let memory = Memory(text: text, createdAt: now, updatedAt: now)
        try await memoryDocument(accountID).setData(["items": [memory.id: memory.fields]], merge: true)
    }

    func deleteMemory(_ id: String) async throws {
        guard let accountID else { throw ProjectSaveError.signedOut }
        try await memoryDocument(accountID).updateData(["items.\(id)": FieldValue.delete()])
    }

    /// Saves what a reply remembered and forgot, skipping near-duplicates, as the web does.
    func apply(_ operations: MemoryRules.Operations, chatID: String, projectID: String?) async {
        guard let accountID else { return }
        let now = Date().timeIntervalSince1970 * 1000
        var current = memories
        var added: [String: Any] = [:]
        var removed: [String] = []
        for text in operations.forget {
            if let match = current.first(where: { MemoryRules.same($0.text, text) }) {
                removed.append(match.id)
                current.removeAll { $0.id == match.id }
            }
        }
        let wanted = operations.remember.map { ($0, nil as String?) } + operations.project.map { ($0, projectID) }
        for (text, project) in wanted where current.count < MemoryRules.maximumMemories {
            let scope = current.filter { $0.projectID == nil || $0.projectID == project }
            guard !scope.contains(where: { MemoryRules.same($0.text, text) }) else { continue }
            let memory = Memory(text: text, createdAt: now, updatedAt: now, source: "chat", projectID: project, chatID: chatID)
            added[memory.id] = memory.fields
            current.insert(memory, at: 0)
        }
        guard !added.isEmpty || !removed.isEmpty else { return }
        let reference = memoryDocument(accountID)
        let batch = db.batch()
        if !added.isEmpty { batch.setData(["items": added], forDocument: reference, merge: true) }
        if !removed.isEmpty {
            var deletions: [AnyHashable: Any] = [:]
            for id in removed { deletions["items." + id] = FieldValue.delete() }
            batch.updateData(deletions, forDocument: reference)
        }
        do { try await batch.commit() }
        catch { errorMessage = "Memory could not be saved. It will be kept once you are back online." }
    }
}

enum MemoryError: LocalizedError {
    case full
    var errorDescription: String? { "Memory is full (\(MemoryRules.maximumMemories) items). Delete some to add more." }
}

enum ProjectSaveError: LocalizedError {
    case signedOut
    var errorDescription: String? { "Sign in to use projects; they are saved in your Lumen account." }
}
