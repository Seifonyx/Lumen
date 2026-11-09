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
    public var errorMessage: String?
    public private(set) var accountID = "device"
    public private(set) var pendingMessages: [String: Set<String>] = [:]
    public private(set) var pendingDeletions: Set<String> = []
    @ObservationIgnored public var onChange: (() -> Void)?
    @ObservationIgnored private let client: any AIStreamingClient
    @ObservationIgnored private let store: any ConversationStore
    @ObservationIgnored private var streamingTask: Task<Void, Never>?
    @ObservationIgnored private var generation: UUID?
    @ObservationIgnored private var cacheReadable = true
    @ObservationIgnored private var cacheSession = UUID()
    @ObservationIgnored private var mutationVersions: [String: UInt64] = [:]

    public init(client: any AIStreamingClient = OpenAICompatibleStreamingClient(),
                store: any ConversationStore = FileConversationStore()) {
        self.client = client
        self.store = store
        loadAccount()
    }

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
        if !currentConversation.messages.isEmpty {
            latest[currentConversation.lineageRootID ?? currentConversation.id] = currentConversation
        }
        return latest.values.sorted {
            ($0.pinned == true) == ($1.pinned == true) ? $0.updatedAt > $1.updatedAt : $0.pinned == true
        }
    }

    public func versions(for chatID: String) -> [Conversation] {
        guard let chat = savedConversations.first(where: { $0.id == chatID }) else { return [] }
        let root = chat.lineageRootID ?? chat.id
        return savedConversations.filter { ($0.lineageRootID ?? $0.id) == root }.sorted {
            $0.createdAt == $1.createdAt ? $0.id < $1.id : $0.createdAt < $1.createdAt
        }
    }

    @discardableResult public func editAndResend(messageID: String, text: String, apiKey: String) -> Task<Void, Never>? {
        revise(messageID: messageID, editedText: text, apiKey: apiKey)
    }

    @discardableResult public func regenerate(messageID: String, apiKey: String) -> Task<Void, Never>? {
        revise(messageID: messageID, editedText: nil, apiKey: apiKey)
    }

    private func revise(messageID: String, editedText: String?, apiKey: String) -> Task<Void, Never>? {
        guard !isStreaming, currentConversation.historyLoaded != false,
              let model = selectedModel, !apiKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
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
                                      sourceMessageID: selected.id))
        }
        guard prefix.contains(where: { $0.role == .user }) else { return nil }
        let savedBefore = savedConversations, pendingBefore = pendingMessages
        var revision = Conversation(title: original.title, messages: prefix, selectedModelId: model.id)
        revision.selectedProviderId = model.providerId
        revision.lineageRootID = original.lineageRootID ?? original.id
        revision.parentConversationID = original.id
        revision.revisionLabel = editedText == nil ? "New response" : "Edited message"
        revision.pinned = original.pinned
        revision.archived = original.archived
        revision.historyLoaded = true
        if index == 0, let text, original.title == String(selected.content.prefix(32)) { revision.title = String(text.prefix(32)) }
        let reply = ChatMessage(role: .assistant, content: "", status: .streaming)
        revision.messages.append(reply)
        currentConversation = revision
        pendingMessages[revision.id] = Set(prefix.map(\.id))
        guard saveCurrent() else {
            currentConversation = original; savedConversations = savedBefore; pendingMessages = pendingBefore
            return nil
        }
        errorMessage = nil
        return startReply(model: model, apiKey: apiKey, replyID: reply.id)
    }

    public func startNewConversation() {
        stopStreaming()
        _ = saveCurrent()
        currentConversation = Conversation(selectedModelId: selectedModel?.id)
        currentConversation.selectedProviderId = selectedModel?.providerId
        errorMessage = nil
    }

    public func selectConversation(id: String) {
        stopStreaming()
        _ = saveCurrent()
        guard let chat = savedConversations.first(where: { $0.id == id }) else { return }
        currentConversation = chat
        errorMessage = nil
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
        savedConversations.removeAll { deleted.contains($0.id) }
        for id in deleted { pendingMessages[id] = nil }
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
            return false
        }
        for id in deleted { mutationVersions[id, default: 0] &+= 1 }
        return true
    }

    public func nextPendingConversation() -> Conversation? {
        savedConversations.filter { chat in
            guard !(pendingMessages[chat.id] ?? []).isEmpty, !pendingDeletions.contains(chat.id) else { return false }
            if let parent = chat.parentConversationID, !(pendingMessages[parent] ?? []).isEmpty { return false }
            return true
        }.sorted { $0.createdAt == $1.createdAt ? $0.id < $1.id : $0.createdAt < $1.createdAt }.first
    }

    /// Returns a task only after the accepted turn and outbox are durable. The caller can then clear its draft.
    @discardableResult public func submit(prompt: String, apiKey: String) -> Task<Void, Never>? {
        guard !isStreaming else { return nil }
        let text = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return nil }
        guard currentConversation.historyLoaded != false else {
            errorMessage = "Wait for this conversation to finish loading before sending."
            return nil
        }
        guard let model = selectedModel else { errorMessage = "Choose a connected model first."; return nil }
        guard !apiKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            errorMessage = "Connect \(model.providerId) in Settings before sending."
            return nil
        }
        let before = currentConversation
        let savedBefore = savedConversations
        let pendingBefore = pendingMessages
        currentConversation.selectedModelId = model.id
        currentConversation.selectedProviderId = model.providerId
        let user = currentConversation.appendUserMessage(text)
        let reply = ChatMessage(role: .assistant, content: "", status: .streaming)
        currentConversation.messages.append(reply)
        pendingMessages[currentConversation.id, default: []].insert(user.id)
        guard saveCurrent() else {
            currentConversation = before
            savedConversations = savedBefore
            pendingMessages = pendingBefore
            return nil
        }
        errorMessage = nil
        return startReply(model: model, apiKey: apiKey, replyID: reply.id)
    }

    private func startReply(model: AIModel, apiKey: String, replyID: String) -> Task<Void, Never> {
        let chatID = currentConversation.id
        let account = accountID
        let requestMessages = Array(currentConversation.messages.dropLast()).filter {
            // Failed/empty assistant placeholders are not conversation context.
            if $0.role != .assistant { return true }
            if case .error = $0.status { return false }
            return !$0.content.isEmpty
        }
        let ticket = UUID()
        generation = ticket
        isStreaming = true
        streamingTask = Task { [weak self] in
            guard let self else { return }
            var checkpoint = Date.distantPast
            do {
                let stream = try await client.stream(messages: requestMessages, model: model, apiKey: apiKey)
                for try await token in stream {
                    guard owns(ticket, chatID: chatID, account: account),
                          let i = currentConversation.messages.firstIndex(where: { $0.id == replyID }) else { return }
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
            pendingMessages[chatID, default: []].insert(replyID)
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
            pendingMessages[currentConversation.id, default: []].insert(currentConversation.messages[i].id)
            currentConversation.updatedAt = Date()
        }
        _ = saveCurrent()
    }

    public func applyRemoteMetadata(_ remote: Conversation) {
        guard !pendingDeletions.contains(remote.id) else { return }
        var merged = remote
        if let local = savedConversations.first(where: { $0.id == remote.id }) {
            merged.messages = local.messages
            let existingIDs = local.remoteMessageIDs
            merged.historyLoaded = existingIDs == remote.remoteMessageIDs && local.remoteRevision == remote.remoteRevision ? local.historyLoaded : false
            if !(pendingMessages[remote.id] ?? []).isEmpty {
                merged.updatedAt = max(local.updatedAt, remote.updatedAt)
            }
        }
        upsert(merged)
        if currentConversation.id == merged.id {
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

    @discardableResult public func applyRemoteMessages(chatID: String, messages: [ChatMessage], orderedIDs: [String],
                                                       ticket: HistoryLoadTicket, revision: Double?) -> Bool {
        guard ticket.session == cacheSession, ticket.chatID == chatID,
              ticket.version == mutationVersions[chatID] ?? 0,
              var chat = savedConversations.first(where: { $0.id == chatID }), !pendingDeletions.contains(chatID) else { return false }
        let remote = Dictionary(messages.map { ($0.id, $0) }, uniquingKeysWith: { _, last in last })
        var merged = orderedIDs.compactMap { remote[$0] }
        let retained = pendingMessages[chatID] ?? []
        let local = currentConversation.id == chatID ? currentConversation.messages : chat.messages
        for message in local where retained.contains(message.id) || message.status == .streaming {
            if !merged.contains(where: { $0.id == message.id }) { merged.append(message) }
        }
        chat.messages = merged
        chat.remoteMessageIDs = orderedIDs
        chat.remoteRevision = revision
        chat.historyLoaded = true
        upsert(chat)
        if currentConversation.id == chatID { currentConversation = chat }
        _ = write()
        return true
    }

    public func applyRemoteDeletion(chatID: String) {
        if currentConversation.id == chatID { stopStreaming(); currentConversation = Conversation(selectedModelId: selectedModel?.id) }
        savedConversations.removeAll { $0.id == chatID }
        pendingMessages[chatID] = nil
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
        if !currentConversation.messages.isEmpty { upsert(currentConversation) }
        return write()
    }

    @discardableResult private func write() -> Bool {
        guard cacheReadable else { errorMessage = "The saved chat cache could not be read. Free storage and reopen Lumen before sending."; return false }
        do {
            try store.save(ChatSnapshot(conversations: savedConversations, selectedModel: selectedModel,
                                        pendingMessages: pendingMessages, pendingDeletions: pendingDeletions), accountID: accountID)
            onChange?()
            return true
        } catch {
            errorMessage = "This iPhone could not save the chat. Check available storage and try again. Your draft has been kept."
            return false
        }
    }

    private func loadAccount() {
        cacheSession = UUID()
        mutationVersions = [:]
        currentConversation = Conversation()
        savedConversations = []
        pendingMessages = [:]
        pendingDeletions = []
        selectedModel = nil
        errorMessage = nil
        cacheReadable = true
        do {
            let snapshot = try store.load(accountID: accountID)
            savedConversations = snapshot.conversations
            selectedModel = snapshot.selectedModel
            pendingMessages = snapshot.pendingMessages
            pendingDeletions = snapshot.pendingDeletions
            for ci in savedConversations.indices {
                for mi in savedConversations[ci].messages.indices where savedConversations[ci].messages[mi].status == .streaming {
                    savedConversations[ci].messages[mi].status = .stopped
                    pendingMessages[savedConversations[ci].id, default: []].insert(savedConversations[ci].messages[mi].id)
                }
            }
            currentConversation.selectedModelId = selectedModel?.id
            currentConversation.selectedProviderId = selectedModel?.providerId
        } catch {
            cacheReadable = false
            errorMessage = "Lumen could not read this account's saved chats. Reopen the app before sending; the existing cache has been kept."
        }
    }

    deinit { streamingTask?.cancel() }
}
