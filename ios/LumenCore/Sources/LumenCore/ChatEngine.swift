import Foundation
import Observation

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

    public func deleteConversation(id: String) {
        if currentConversation.id == id { stopStreaming() }
        savedConversations.removeAll { $0.id == id }
        pendingMessages[id] = nil
        pendingDeletions.insert(id)
        if currentConversation.id == id { currentConversation = Conversation(selectedModelId: selectedModel?.id) }
        _ = write()
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
        let chatID = currentConversation.id
        let account = accountID
        let requestMessages = Array(currentConversation.messages.dropLast()).filter {
            // Failed/empty assistant placeholders are not conversation context.
            $0.role != .assistant || !$0.content.isEmpty
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
                          let i = currentConversation.messages.firstIndex(where: { $0.id == reply.id }) else { return }
                    currentConversation.messages[i].content += token
                    if Date().timeIntervalSince(checkpoint) >= 0.5 {
                        _ = saveCurrent()
                        checkpoint = Date()
                    }
                }
                guard owns(ticket, chatID: chatID, account: account),
                      let i = currentConversation.messages.firstIndex(where: { $0.id == reply.id }) else { return }
                currentConversation.messages[i].status = .completed
            } catch {
                guard owns(ticket, chatID: chatID, account: account),
                      let i = currentConversation.messages.firstIndex(where: { $0.id == reply.id }) else { return }
                let message = error.localizedDescription
                currentConversation.messages[i].status = .error(message)
                errorMessage = message
            }
            guard generation == ticket else { return }
            generation = nil
            streamingTask = nil
            isStreaming = false
            currentConversation.updatedAt = Date()
            pendingMessages[chatID, default: []].insert(reply.id)
            _ = saveCurrent()
        }
        return streamingTask
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
            merged.historyLoaded = existingIDs == remote.remoteMessageIDs ? local.historyLoaded : false
            if !(pendingMessages[remote.id] ?? []).isEmpty {
                merged.updatedAt = max(local.updatedAt, remote.updatedAt)
            }
        }
        upsert(merged)
        if currentConversation.id == merged.id {
            // Never replace an active generation with an asynchronous snapshot.
            if !isStreaming { currentConversation = merged }
        }
        _ = write()
    }

    public func applyRemoteMessages(chatID: String, messages: [ChatMessage], orderedIDs: [String]) {
        guard var chat = savedConversations.first(where: { $0.id == chatID }), !pendingDeletions.contains(chatID) else { return }
        let remote = Dictionary(messages.map { ($0.id, $0) }, uniquingKeysWith: { _, last in last })
        var merged = orderedIDs.compactMap { remote[$0] }
        let retained = pendingMessages[chatID] ?? []
        let local = currentConversation.id == chatID ? currentConversation.messages : chat.messages
        for message in local where retained.contains(message.id) || message.status == .streaming {
            if !merged.contains(where: { $0.id == message.id }) { merged.append(message) }
        }
        chat.messages = merged
        chat.remoteMessageIDs = orderedIDs
        chat.historyLoaded = true
        upsert(chat)
        if currentConversation.id == chatID { currentConversation = chat }
        _ = write()
    }

    public func applyRemoteDeletion(chatID: String) {
        if currentConversation.id == chatID { stopStreaming(); currentConversation = Conversation(selectedModelId: selectedModel?.id) }
        savedConversations.removeAll { $0.id == chatID }
        pendingMessages[chatID] = nil
        pendingDeletions.remove(chatID)
        _ = write()
    }

    public func acknowledge(chatID: String, messageIDs: Set<String>) {
        pendingMessages[chatID]?.subtract(messageIDs)
        if pendingMessages[chatID]?.isEmpty == true { pendingMessages[chatID] = nil }
        _ = write()
    }

    public func acknowledgeDeletion(chatID: String) { pendingDeletions.remove(chatID); _ = write() }

    private func upsert(_ chat: Conversation) {
        if let i = savedConversations.firstIndex(where: { $0.id == chat.id }) { savedConversations[i] = chat }
        else { savedConversations.append(chat) }
        savedConversations.sort { $0.pinned == $1.pinned ? $0.updatedAt > $1.updatedAt : $0.pinned == true }
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
