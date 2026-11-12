import Foundation
import Observation

public struct HistoryLoadTicket: Sendable {
    fileprivate let session: UUID
    fileprivate let chatID: String
    fileprivate let version: UInt64
}

@MainActor @Observable public final class ChatEngine {
    public var currentConversation = Conversation()
    public private(set) var savedConversations: [Conversation] = []
    public private(set) var selectedModel: AIModel?
    public private(set) var isStreaming = false
    public private(set) var contextOmittedMessageCount = 0
    /// Number of historical file references left out of the most recent provider request.
    public private(set) var contextOmittedAttachmentCount = 0
    public private(set) var isTemporary = false
    @ObservationIgnored private var temporaryVersions: [Conversation] = []
    @ObservationIgnored private var regularSelectedID: String?
    public var errorMessage: String?
    /// Each project's instructions, by project ID, sent ahead of every message in that project's chats.
    public var projectInstructions: [String: String] = [:]
    public private(set) var accountID = "device"
    public private(set) var pendingMessages: [String: Set<String>] = [:]
    public private(set) var pendingDeletions: Set<String> = []
    public private(set) var pendingMetadata: [String: [ChatMetadataPatch]] = [:]
    @ObservationIgnored public var onChange: (() -> Void)?
    @ObservationIgnored private let client: any AIStreamingClient
    @ObservationIgnored private let attachmentStore: any AttachmentStore
    @ObservationIgnored private var volatileAttachments: [String: ChatAttachment] = [:]
    @ObservationIgnored private let store: any ConversationStore
    @ObservationIgnored private var streamingTask: Task<Void, Never>?
    @ObservationIgnored private var generation: UUID?
    @ObservationIgnored private var cacheReadable = true
    @ObservationIgnored private var lastWriteSucceeded = true
    @ObservationIgnored private var cacheSession = UUID()
    @ObservationIgnored private var mutationVersions: [String: UInt64] = [:]

    public init(client: any AIStreamingClient = OpenAICompatibleStreamingClient(),
                store: any ConversationStore = FileConversationStore(), attachmentStore: any AttachmentStore = FileAttachmentStore()) {
        self.client = client
        self.store = store
        self.attachmentStore = attachmentStore
        loadAccount()
    }

    @discardableResult public func checkpoint() -> Bool { saveCurrent() }

    public func switchAccount(to id: String) {
        guard accountID != id else { return }
        stopStreaming()
        accountID = id
        loadAccount()
    }

    public func selectModel(_ model: AIModel) {
        selectedModel = model
        currentConversation.selectedModelId = model.id
        currentConversation.selectedProviderId = model.providerId
        _ = saveCurrent()
    }

    public func clearSelectedModel() {
        selectedModel = nil
        _ = write()
    }

    /// One visible history item per conversation, including its immutable earlier versions.
    public var historyConversations: [Conversation] {
        var latest: [String: Conversation] = [:]
        for chat in savedConversations {
            let root = chat.lineageRootID ?? chat.id
            if latest[root] == nil || latest[root]!.createdAt < chat.createdAt { latest[root] = chat }
        }
        if !isTemporary, !currentConversation.messages.isEmpty {
            latest[currentConversation.lineageRootID ?? currentConversation.id] = currentConversation
        }
        return latest.values.sorted {
            ($0.pinned == true) == ($1.pinned == true) ? $0.updatedAt > $1.updatedAt : $0.pinned == true
        }
    }

    public func versions(for chatID: String) -> [Conversation] {
        let source = isTemporary ? temporaryVersions : savedConversations
        guard let chat = source.first(where: { $0.id == chatID }) else { return [] }
        let root = chat.lineageRootID ?? chat.id
        return source.filter { ($0.lineageRootID ?? $0.id) == root }.sorted {
            $0.createdAt == $1.createdAt ? $0.id < $1.id : $0.createdAt < $1.createdAt
        }
    }

    public func searchConversations(query: String, scope: HistoryScope = .active) -> [ConversationSearchResult] {
        ConversationSearch.results(query: query, scope: scope, conversations: savedConversations, visible: historyConversations)
    }

    @discardableResult public func renameConversation(id: String, title: String) -> Bool {
        let value = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty, value.count <= 120 else {
            errorMessage = "Use a conversation name between 1 and 120 characters."
            return false
        }
        return updateMetadata(id: id, patch: ChatMetadataPatch(title: value))
    }

    @discardableResult public func setPinned(id: String, pinned: Bool) -> Bool {
        updateMetadata(id: id, patch: ChatMetadataPatch(pinned: pinned))
    }

    @discardableResult public func setArchived(id: String, archived: Bool) -> Bool {
        updateMetadata(id: id, patch: ChatMetadataPatch(archived: archived))
    }

    /// Moves a chat (all its versions) into a project, or out of any project with nil.
    @discardableResult public func moveConversation(id: String, toProject projectID: String?) -> Bool {
        updateMetadata(id: id, patch: ChatMetadataPatch(project: ProjectAssignment(projectID: projectID)))
    }

    private func updateMetadata(id: String, patch: ChatMetadataPatch) -> Bool {
        guard let target = savedConversations.first(where: { $0.id == id }) else { return false }
        let root = target.lineageRootID ?? target.id
        let members = savedConversations.filter { ($0.lineageRootID ?? $0.id) == root }
        let previous = currentConversation, savedBefore = savedConversations, pendingBefore = pendingMetadata
        for var chat in members {
            if currentConversation.id == chat.id { chat = currentConversation }
            patch.apply(to: &chat)
            chat.updatedAt = Date()
            pendingMetadata[chat.id, default: []].append(patch)
            upsert(chat)
            if currentConversation.id == chat.id { currentConversation = chat }
        }
        guard write() else {
            currentConversation = previous; savedConversations = savedBefore; pendingMetadata = pendingBefore
            return false
        }
        errorMessage = nil
        return true
    }

    @discardableResult public func acknowledgeMetadata(chatID: String, operationID: String) -> Bool {
        guard let patches = pendingMetadata[chatID], patches.contains(where: { $0.id == operationID }) else { return true }
        let remaining = patches.filter { $0.id != operationID }
        pendingMetadata[chatID] = remaining.isEmpty ? nil : remaining
        guard write() else { pendingMetadata[chatID] = patches; return false }
        return true
    }

    @discardableResult public func editAndResend(messageID: String, text: String, apiKey: String) -> Task<Void, Never>? {
        revise(messageID: messageID, editedText: text, apiKey: apiKey)
    }

    @discardableResult public func regenerate(messageID: String, apiKey: String) -> Task<Void, Never>? {
        revise(messageID: messageID, editedText: nil, apiKey: apiKey)
    }

    private func revise(messageID: String, editedText: String?, apiKey: String) -> Task<Void, Never>? {
        guard !isStreaming, currentConversation.historyLoaded != false,
              !hasOlderMessages(chatID: currentConversation.id), let model = selectedModel, !apiKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              let index = currentConversation.messages.firstIndex(where: { $0.id == messageID }) else { return nil }
        let original = currentConversation
        let selected = original.messages[index]
        guard editedText == nil ? selected.role == .assistant : selected.role == .user else { return nil }
        let text = editedText?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let text, text.isEmpty { return nil }
        var prefix = original.messages.prefix(index).map { message in
            var copy = message
            // Unchanged messages belong to the immediate parent under their current IDs.
            copy.sourceMessageID = nil
            return copy
        }
        if let text {
            prefix.append(ChatMessage(role: .user, content: text, attachmentNames: selected.attachmentNames,
                                      sourceMessageID: selected.id, attachments: selected.attachments))
        }
        guard prefix.contains(where: { $0.role == .user }) else { return nil }
        let savedBefore = savedConversations, pendingBefore = pendingMessages
        var revision = Conversation(title: original.title, messages: prefix, selectedModelId: model.id)
        revision.selectedProviderId = model.providerId
        revision.lineageRootID = original.lineageRootID ?? original.id
        revision.parentConversationID = original.id
        revision.projectId = original.projectId
        revision.inheritedMessageIDs = Set(prefix.map(\.id))
        revision.revisionLabel = editedText == nil ? "New response" : "Edited message"
        revision.pinned = original.pinned
        revision.archived = original.archived
        revision.historyLoaded = true
        if index == 0, let text, original.title == String(selected.content.prefix(32)) { revision.title = String(text.prefix(32)) }
        let context: ReplyContext
        do { context = try prepareReply(for: revision, model: model) }
        catch { errorMessage = error.localizedDescription; return nil }
        let reply = ChatMessage(role: .assistant, content: "", status: .streaming)
        revision.messages.append(reply)
        currentConversation = revision
        if !isTemporary { pendingMessages[revision.id] = Set(prefix.map(\.id)) }
        guard saveCurrent() else {
            currentConversation = original; savedConversations = savedBefore; pendingMessages = pendingBefore
            return nil
        }
        errorMessage = nil
        return startReply(model: model, apiKey: apiKey, replyID: reply.id, context: context)
    }

    @discardableResult public func startNewConversation(id: String? = nil, projectID: String? = nil) -> Bool {
        stopStreaming()
        guard saveCurrent() else { return false }
        isTemporary = false; temporaryVersions = []; volatileAttachments = [:]
        currentConversation = Conversation(id: id ?? UUID().uuidString, selectedModelId: selectedModel?.id)
        currentConversation.selectedProviderId = selectedModel?.providerId
        currentConversation.projectId = projectID
        contextOmittedAttachmentCount = 0
        errorMessage = nil
        return write()
    }

    @discardableResult public func startTemporaryConversation() -> Bool {
        stopStreaming()
        guard saveCurrent() else { return false }
        if !isTemporary { regularSelectedID = currentConversation.id }
        isTemporary = true; temporaryVersions = []; volatileAttachments = [:]
        currentConversation = Conversation(selectedModelId: selectedModel?.id)
        currentConversation.selectedProviderId = selectedModel?.providerId
        contextOmittedAttachmentCount = 0
        errorMessage = nil
        return true
    }

    @discardableResult public func selectConversation(id: String) -> Bool {
        guard ((isTemporary ? temporaryVersions : []).contains { $0.id == id }) ||
              savedConversations.contains(where: { $0.id == id }) else { return false }
        let selectingTemporary = temporaryVersions.contains { $0.id == id }
        stopStreaming()
        guard saveCurrent() else { return false }
        // A stopped reply is checkpointed by stopStreaming. Never reselect the stale
        // pre-stop snapshot: its .streaming assistant cannot be uploaded by the outbox.
        guard let chat = (isTemporary ? temporaryVersions : []).first(where: { $0.id == id }) ??
                savedConversations.first(where: { $0.id == id }) else { return false }
        isTemporary = selectingTemporary
        if !isTemporary { temporaryVersions = []; volatileAttachments = [:] }
        currentConversation = chat
        contextOmittedAttachmentCount = 0
        errorMessage = nil
        return isTemporary || write()
    }

    @discardableResult public func deleteConversation(id: String) -> Bool {
        let target = savedConversations.first(where: { $0.id == id })
        let root = target?.lineageRootID ?? id
        let deleted = Set(savedConversations.filter { ($0.lineageRootID ?? $0.id) == root }.map(\.id)).union([id])
        if deleted.contains(currentConversation.id) { stopStreaming() }
        let previous = currentConversation
        let savedBefore = savedConversations
        let messagesBefore = pendingMessages
        let deletionsBefore = pendingDeletions
        let metadataBefore = pendingMetadata
        savedConversations.removeAll { deleted.contains($0.id) }
        for id in deleted { pendingMessages[id] = nil; pendingMetadata[id] = nil }
        pendingDeletions.formUnion(deleted)
        if deleted.contains(currentConversation.id) {
            currentConversation = Conversation(selectedModelId: selectedModel?.id)
            currentConversation.selectedProviderId = selectedModel?.providerId
        }
        guard write() else {
            currentConversation = previous
            savedConversations = savedBefore
            pendingMessages = messagesBefore
            pendingDeletions = deletionsBefore
            pendingMetadata = metadataBefore
            return false
        }
        for id in deleted { mutationVersions[id, default: 0] &+= 1 }
        return true
    }

    public func nextPendingConversation(excluding blocked: Set<String> = []) -> Conversation? {
        savedConversations.filter { chat in
            guard !blocked.contains(chat.id), !(pendingMessages[chat.id] ?? []).isEmpty, !pendingDeletions.contains(chat.id) else { return false }
            if let parent = chat.parentConversationID, !(pendingMessages[parent] ?? []).isEmpty { return false }
            return true
        }.sorted { $0.createdAt == $1.createdAt ? $0.id < $1.id : $0.createdAt < $1.createdAt }.first
    }

    public func storeAttachment(_ attachment: ChatAttachment) throws {
        try attachment.validate()
        if isTemporary { volatileAttachments[attachment.id] = attachment }
        else { try attachmentStore.save(attachment, accountID: accountID) }
    }

    public func attachment(id: String) throws -> ChatAttachment {
        if isTemporary {
            guard let file = volatileAttachments[id] else { throw AttachmentError.unavailable }
            return file
        }
        return try attachmentStore.load(id: id, accountID: accountID)
    }

    public func pruneAttachments(keepingDraftIDs: Set<String>) throws {
        guard cacheReadable, lastWriteSucceeded else { return }
        let referenced = Set(savedConversations.flatMap { $0.messages }.flatMap { $0.attachments ?? [] }.map(\.id))
        try attachmentStore.prune(keeping: referenced.union(keepingDraftIDs), accountID: accountID)
    }

    public func attachmentForSync(id: String) throws -> ChatAttachment { try attachmentStore.load(id: id, accountID: accountID) }
    public func cacheAttachment(_ file: ChatAttachment) throws { try attachmentStore.save(file, accountID: accountID) }

    /// Returns a task only after the accepted turn and outbox are durable. The caller can then clear its draft.
    @discardableResult public func submit(prompt: String, attachmentIDs: [String] = [], apiKey: String) -> Task<Void, Never>? {
        guard !isStreaming else { return nil }
        let text = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty || !attachmentIDs.isEmpty else { return nil }
        guard currentConversation.historyLoaded != false else {
            errorMessage = "Wait for this conversation to finish loading before sending."
            return nil
        }
        guard let model = selectedModel else { errorMessage = "Choose a connected model first."; return nil }
        guard !apiKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            errorMessage = "Connect this model's provider in Settings › Router before sending."
            return nil
        }
        let before = currentConversation
        var next = before
        next.selectedModelId = model.id
        next.selectedProviderId = model.providerId
        var user = next.appendUserMessage(text)
        let files: [ChatAttachment]
        let context: ReplyContext
        do {
            guard attachmentIDs.count <= 4 else { throw AttachmentError.tooMany }
            files = try attachmentIDs.map { id in
                let file = try attachment(id: id)
                try file.validate()
                if file.kind == .image, !model.supportsImages { throw AttachmentError.modelCannotReadImages }
                return file
            }
            user.attachments = files
            user.attachmentNames = files.isEmpty ? nil : files.map(\.name)
            next.messages[next.messages.count - 1] = user
            context = try prepareReply(for: next, model: model, newMessageID: user.id)
        } catch { errorMessage = error.localizedDescription; return nil }

        let savedBefore = savedConversations
        let pendingBefore = pendingMessages
        user.attachments = files.map(\.metadata)
        next.messages[next.messages.count - 1] = user
        if text.isEmpty, let first = files.first { next.title = String(first.name.prefix(32)) }
        let reply = ChatMessage(role: .assistant, content: "", status: .streaming)
        next.messages.append(reply)
        currentConversation = next
        if !isTemporary { pendingMessages[currentConversation.id, default: []].insert(user.id) }
        guard saveCurrent() else {
            currentConversation = before
            savedConversations = savedBefore
            pendingMessages = pendingBefore
            return nil
        }
        errorMessage = nil
        return startReply(model: model, apiKey: apiKey, replyID: reply.id, context: context)
    }

    /// Include old instructions without displaying them in the paged transcript. Firestore
    /// does not guarantee query order, so system instructions follow authoritative IDs.
    private func messagesForContext(_ chat: Conversation) -> [ChatMessage] {
        let visible = Set(chat.messages.map(\.id))
        let ordered = chat.remoteMessageIDs
        let order = Dictionary((ordered ?? []).enumerated().map { ($0.element, $0.offset) }, uniquingKeysWith: { first, _ in first })
        let hydrated = (chat.hydratedSystemMessages ?? []).filter {
            $0.role == .system && !visible.contains($0.id) &&
            (ordered == nil || order[$0.id] != nil)
        }
        let systems = (hydrated + chat.messages.filter { $0.role == .system }).enumerated()
            .sorted { lhs, rhs in
                let left = order[lhs.element.id] ?? Int.max, right = order[rhs.element.id] ?? Int.max
                return left == right ? lhs.offset < rhs.offset : left < right
            }.map(\.element)
        // The project's instructions lead, as on the web; they are sent, never stored in the chat.
        var lead: [ChatMessage] = []
        if let project = chat.projectId,
           let instructions = projectInstructions[project]?.trimmingCharacters(in: .whitespacesAndNewlines), !instructions.isEmpty {
            lead = [ChatMessage(id: "project-instructions-" + project, role: .system, content: instructions)]
        }
        return lead + systems + chat.messages.filter { $0.role != .system }
    }

    private struct ReplyContext {
        let messages: [ChatMessage]
        let omittedMessages: Int
        let omittedAttachments: Int
    }

    /// Prepare the request before the caller commits the turn or clears its draft.
    private func prepareReply(for chat: Conversation, model: AIModel, newMessageID: String? = nil) throws -> ReplyContext {
        let messages = messagesForContext(chat).filter {
            // Keep file-only assistant turns from web history.
            if $0.role != .assistant { return true }
            if case .error = $0.status { return false }
            return !$0.content.isEmpty || $0.attachments?.isEmpty == false || $0.attachmentNames?.isEmpty == false
        }
        // Cap the candidate count before reading originals. Apply byte and image
        // budgets after removing unavailable historical files.
        var candidates = try ContextWindow.select(messages: messages, maximumTextBytes: .max, maximumImages: .max).messages
        var omittedByMessage: [String: Int] = [:]
        for index in candidates.indices where candidates[index].id != newMessageID {
            let references = candidates[index].attachments ?? []
            let referenceCount = max(references.count, candidates[index].attachmentNames?.count ?? 0)
            guard referenceCount > 0 else { continue }
            let acceptsImages = candidates[index].role == .user && model.supportsImages
            let available = references.compactMap { reference -> ChatAttachment? in
                guard reference.kind != .unsupported, reference.kind != .image || acceptsImages else { return nil }
                do {
                    let file = reference.kind == .text ? reference : try attachment(id: reference.id)
                    try file.validate()
                    return file
                } catch { return nil }
            }
            let omitted = referenceCount - available.count
            omittedByMessage[candidates[index].id] = omitted
            candidates[index].attachments = available.isEmpty ? nil : available
            if omitted > 0, available.isEmpty, candidates[index].content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                candidates[index].content = "[Earlier attachment unavailable.]"
            }
        }
        let window = try ContextWindow.select(messages: candidates)
        let loadedIDs = Set(chat.messages.map(\.id) + window.messages.map(\.id))
        let unloadedCount = chat.remoteMessageIDs?.filter { !loadedIDs.contains($0) }.count ?? 0
        return ReplyContext(messages: window.messages, omittedMessages: messages.count - window.messages.count + unloadedCount,
                            omittedAttachments: window.messages.reduce(0) { $0 + (omittedByMessage[$1.id] ?? 0) })
    }

    private func startReply(model: AIModel, apiKey: String, replyID: String, context: ReplyContext) -> Task<Void, Never> {
        let chatID = currentConversation.id
        let account = accountID
        contextOmittedMessageCount = context.omittedMessages
        contextOmittedAttachmentCount = context.omittedAttachments
        let ticket = UUID()
        generation = ticket
        isStreaming = true
        streamingTask = Task { [weak self] in
            guard let self else { return }
            var checkpoint = Date.distantPast
            var replyBytes = 0
            do {
                let stream = try await client.stream(messages: context.messages, model: model, apiKey: apiKey)
                for try await token in stream {
                    guard owns(ticket, chatID: chatID, account: account),
                          let i = currentConversation.messages.firstIndex(where: { $0.id == replyID }) else { return }
                    replyBytes += token.utf8.count
                    guard replyBytes <= 240_000 else { throw ProviderRequestError.responseTooLarge }
                    currentConversation.messages[i].content += token
                    if Date().timeIntervalSince(checkpoint) >= 0.5 {
                        _ = saveCurrent()
                        checkpoint = Date()
                    }
                }
                guard owns(ticket, chatID: chatID, account: account),
                      let i = currentConversation.messages.firstIndex(where: { $0.id == replyID }) else { return }
                currentConversation.messages[i].status = .completed
            } catch {
                guard owns(ticket, chatID: chatID, account: account),
                      let i = currentConversation.messages.firstIndex(where: { $0.id == replyID }) else { return }
                let message = error.localizedDescription
                currentConversation.messages[i].status = .error(message)
                errorMessage = message
            }
            guard generation == ticket else { return }
            generation = nil
            streamingTask = nil
            isStreaming = false
            currentConversation.updatedAt = Date()
            if !isTemporary { pendingMessages[chatID, default: []].insert(replyID) }
            _ = saveCurrent()
        }
        return streamingTask!
    }

    public func send(prompt: String, apiKey: String) async { await submit(prompt: prompt, apiKey: apiKey)?.value }

    private func owns(_ ticket: UUID, chatID: String, account: String) -> Bool {
        !Task.isCancelled && generation == ticket && currentConversation.id == chatID && accountID == account
    }

    public func stopStreaming() {
        generation = nil
        streamingTask?.cancel()
        streamingTask = nil
        isStreaming = false
        if let i = currentConversation.messages.indices.last, currentConversation.messages[i].status == .streaming {
            currentConversation.messages[i].status = .stopped
            if !isTemporary { pendingMessages[currentConversation.id, default: []].insert(currentConversation.messages[i].id) }
            currentConversation.updatedAt = Date()
        }
        _ = saveCurrent()
    }

    public func applyRemoteMetadata(_ remote: Conversation) {
        guard !pendingDeletions.contains(remote.id) else { return }
        var merged = remote
        if let local = savedConversations.first(where: { $0.id == remote.id }) {
            merged.messages = local.messages
            // These values are local-only: Firestore metadata cannot reconstruct a partially uploaded fork
            // or the instruction messages fetched independently of the visible page.
            merged.inheritedMessageIDs = local.inheritedMessageIDs
            merged.hydratedSystemMessages = local.hydratedSystemMessages
            let existingIDs = local.remoteMessageIDs
            merged.historyLoaded = existingIDs == remote.remoteMessageIDs && local.remoteRevision == remote.remoteRevision ? local.historyLoaded : false
            if !(pendingMessages[remote.id] ?? []).isEmpty || pendingMetadata[remote.id] != nil {
                merged.updatedAt = max(local.updatedAt, remote.updatedAt)
            }
        }
        for patch in pendingMetadata[remote.id] ?? [] { patch.apply(to: &merged) }
        upsert(merged)
        if !isTemporary, currentConversation.id == merged.id {
            // Never replace an active generation with an asynchronous snapshot.
            if !isStreaming { currentConversation = merged }
            else {
                currentConversation.remoteMessageIDs = merged.remoteMessageIDs
                currentConversation.remoteRevision = merged.remoteRevision
                currentConversation.historyLoaded = merged.historyLoaded
            }
        }
        _ = write()
    }

    public func historyLoadTicket(chatID: String) -> HistoryLoadTicket? {
        guard savedConversations.contains(where: { $0.id == chatID }) else { return nil }
        return HistoryLoadTicket(session: cacheSession, chatID: chatID, version: mutationVersions[chatID] ?? 0)
    }

    public func hasOlderMessages(chatID: String) -> Bool {
        guard let chat = savedConversations.first(where: { $0.id == chatID }), let ids = chat.remoteMessageIDs else { return false }
        let loaded = Set(chat.messages.map(\.id))
        return ids.contains { !loaded.contains($0) }
    }

    @discardableResult public func applyRemoteMessages(chatID: String, messages: [ChatMessage], orderedIDs: [String],
                                                       ticket: HistoryLoadTicket, revision: Double?) -> Bool {
        applyRemotePage(chatID: chatID, messages: messages, orderedIDs: orderedIDs, ticket: ticket, revision: revision, reset: true)
    }

    @discardableResult public func applyRemotePage(chatID: String, messages: [ChatMessage], orderedIDs: [String],
                                                   ticket: HistoryLoadTicket, revision: Double?, reset: Bool,
                                                   systemMessages: [ChatMessage]? = nil) -> Bool {
        guard ticket.session == cacheSession, ticket.chatID == chatID,
              ticket.version == mutationVersions[chatID] ?? 0,
              var chat = savedConversations.first(where: { $0.id == chatID }), !pendingDeletions.contains(chatID),
              Set(orderedIDs).count == orderedIDs.count, Set(messages.map(\.id)).isSubset(of: Set(orderedIDs)) else { return false }
        if let systemMessages {
            guard Set(systemMessages.map(\.id)).count == systemMessages.count,
                  systemMessages.allSatisfy({ $0.role == .system && orderedIDs.contains($0.id) }) else { return false }
        }
        let retained = pendingMessages[chatID] ?? []
        let local = !isTemporary && currentConversation.id == chatID ? currentConversation.messages : chat.messages
        // Keep already loaded older pages across a metadata refresh. Only retain IDs
        // still in the authoritative transcript; fetched pages overwrite cached content.
        let authoritative = Set(orderedIDs)
        var remote = Dictionary(local.filter { authoritative.contains($0.id) }
            .map { ($0.id, $0) }, uniquingKeysWith: { _, last in last })
        let instructionsByID = systemMessages.map { Dictionary(uniqueKeysWithValues: $0.map { ($0.id, $0) }) }
        if let instructionsByID {
            for message in local where authoritative.contains(message.id) {
                if let fresh = instructionsByID[message.id] { remote[message.id] = fresh }
                else if message.role == .system { remote[message.id] = nil }
            }
        }
        for message in messages { remote[message.id] = message }
        for message in local where retained.contains(message.id) || message.status == .streaming { remote[message.id] = message }
        var merged = orderedIDs.compactMap { remote[$0] }
        for message in local where retained.contains(message.id) || message.status == .streaming {
            if !merged.contains(where: { $0.id == message.id }) { merged.append(message) }
        }
        chat.messages = merged; chat.remoteMessageIDs = orderedIDs; chat.remoteRevision = revision
        // A complete refresh replaces stale instructions; older pages preserve a prior hydration.
        chat.hydratedSystemMessages = instructionsByID.map { instructions in orderedIDs.compactMap { instructions[$0] } }
            ?? (reset ? nil : chat.hydratedSystemMessages)
        chat.historyLoaded = orderedIDs.last.map { last in
            messages.contains(where: { $0.id == last }) || (!reset && chat.historyLoaded == true && remote[last] != nil)
        } ?? true
        upsert(chat)
        if !isTemporary, currentConversation.id == chatID { currentConversation = chat }
        _ = write()
        return true
    }

    public func applyRemoteDeletion(chatID: String) {
        if !isTemporary, currentConversation.id == chatID { stopStreaming(); currentConversation = Conversation(selectedModelId: selectedModel?.id) }
        savedConversations.removeAll { $0.id == chatID }
        pendingMessages[chatID] = nil
        pendingMetadata[chatID] = nil
        // Our tombstone listener must not acknowledge unfinished remote content cleanup.
        mutationVersions[chatID, default: 0] &+= 1
        _ = write()
    }

    public func acknowledge(chatID: String, messageIDs: Set<String>) {
        pendingMessages[chatID]?.subtract(messageIDs)
        if pendingMessages[chatID]?.isEmpty == true { pendingMessages[chatID] = nil }
        _ = write()
    }

    public func acknowledgeDeletion(chatID: String) { pendingDeletions.remove(chatID); _ = write() }

    private func upsert(_ chat: Conversation) {
        if let i = savedConversations.firstIndex(where: { $0.id == chat.id }) {
            if savedConversations[i] != chat { mutationVersions[chat.id, default: 0] &+= 1 }
            savedConversations[i] = chat
        } else { savedConversations.append(chat); mutationVersions[chat.id, default: 0] &+= 1 }
        savedConversations.sort {
            ($0.pinned == true) == ($1.pinned == true) ? $0.updatedAt > $1.updatedAt : $0.pinned == true
        }
    }

    @discardableResult private func saveCurrent() -> Bool {
        if isTemporary {
            if let index = temporaryVersions.firstIndex(where: { $0.id == currentConversation.id }) { temporaryVersions[index] = currentConversation }
            else if !currentConversation.messages.isEmpty { temporaryVersions.append(currentConversation) }
            return true
        }
        if !currentConversation.messages.isEmpty { upsert(currentConversation) }
        return write()
    }

    @discardableResult private func write() -> Bool {
        guard cacheReadable else { errorMessage = "The saved chat cache could not be read. Free storage and reopen Lumen before sending."; return false }
        do {
            try store.save(ChatSnapshot(conversations: savedConversations, selectedModel: selectedModel,
                                        pendingMessages: pendingMessages, pendingDeletions: pendingDeletions,
                                        pendingMetadata: pendingMetadata, selectedConversationID: isTemporary ? regularSelectedID : currentConversation.id), accountID: accountID)
            lastWriteSucceeded = true
            onChange?()
            return true
        } catch {
            lastWriteSucceeded = false
            errorMessage = "This iPhone could not save the chat. Check available storage and try again. Your draft has been kept."
            return false
        }
    }

    private func loadAccount() {
        isTemporary = false; temporaryVersions = []; volatileAttachments = [:]; regularSelectedID = nil
        cacheSession = UUID()
        mutationVersions = [:]
        currentConversation = Conversation()
        savedConversations = []
        pendingMessages = [:]
        pendingDeletions = []
        pendingMetadata = [:]
        selectedModel = nil
        contextOmittedMessageCount = 0
        contextOmittedAttachmentCount = 0
        errorMessage = nil
        cacheReadable = true; lastWriteSucceeded = true
        do {
            let snapshot = try store.load(accountID: accountID)
            savedConversations = snapshot.conversations
            selectedModel = snapshot.selectedModel
            pendingMessages = snapshot.pendingMessages
            pendingDeletions = snapshot.pendingDeletions
            pendingMetadata = snapshot.pendingMetadata ?? [:]
            for ci in savedConversations.indices {
                // Older caches had names without an attachment field. A decoded empty
                // list already records that the web references could not be used here.
                if savedConversations[ci].messages.contains(where: { $0.attachmentNames?.isEmpty == false && $0.attachments == nil }) {
                    savedConversations[ci].historyLoaded = false
                }
                for mi in savedConversations[ci].messages.indices where savedConversations[ci].messages[mi].status == .streaming {
                    savedConversations[ci].messages[mi].status = .stopped
                    pendingMessages[savedConversations[ci].id, default: []].insert(savedConversations[ci].messages[mi].id)
                }
            }
            if let selectedID = snapshot.selectedConversationID {
                currentConversation = savedConversations.first { $0.id == selectedID } ?? Conversation(id: selectedID, selectedModelId: selectedModel?.id)
            }
            if currentConversation.messages.isEmpty {
                currentConversation.selectedModelId = selectedModel?.id
                currentConversation.selectedProviderId = selectedModel?.providerId
            }
            regularSelectedID = currentConversation.id
        } catch {
            cacheReadable = false
            errorMessage = "Lumen could not read this account's saved chats. Reopen the app before sending; the existing cache has been kept."
        }
    }

    deinit { streamingTask?.cancel() }
}
