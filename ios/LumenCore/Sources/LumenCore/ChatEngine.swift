import Foundation
import Observation

@MainActor @Observable
public final class ChatEngine {
    public var currentConversation: Conversation
    public var savedConversations: [Conversation] = []
    public var selectedModel: AIModel?
    public var isStreaming: Bool = false
    public var errorMessage: String?

    @ObservationIgnored private var streamingTask: Task<Void, Never>?
    @ObservationIgnored private let client: AIStreamingClient
    @ObservationIgnored private let defaults: UserDefaults

    private static let savedConversationsKey = "lumen.saved-conversations"
    private static let selectedModelKey = "lumen.selected-model-id"

    public init(
        client: AIStreamingClient = OpenAICompatibleStreamingClient(),
        defaults: UserDefaults = .standard
    ) {
        self.client = client
        self.defaults = defaults
        self.currentConversation = Conversation()

        loadPersistedState()
    }

    public func selectModel(_ model: AIModel) {
        selectedModel = model
        currentConversation.selectedModelId = model.id
        defaults.set(model.id, forKey: Self.selectedModelKey)
    }

    public func startNewConversation() {
        stopStreaming()
        saveCurrentIfNeeded()
        currentConversation = Conversation(selectedModelId: selectedModel?.id)
        errorMessage = nil
    }

    public func selectConversation(id: UUID) {
        stopStreaming()
        saveCurrentIfNeeded()
        if let found = savedConversations.first(where: { $0.id == id }) {
            currentConversation = found
            if let modelId = found.selectedModelId,
               let model = AIModel.defaults.first(where: { $0.id == modelId }) {
                selectedModel = model
            }
        }
        errorMessage = nil
    }

    public func deleteConversation(id: UUID) {
        savedConversations.removeAll(where: { $0.id == id })
        if currentConversation.id == id {
            currentConversation = Conversation(selectedModelId: selectedModel?.id)
        }
        persistConversations()
    }

    public func send(prompt: String, apiKey: String) async {
        let trimmed = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        guard let model = selectedModel else {
            errorMessage = "Please select a model first."
            return
        }

        errorMessage = nil
        _ = currentConversation.appendUserMessage(trimmed)

        let assistantMessage = ChatMessage(
            role: .assistant,
            content: "",
            status: .streaming
        )
        currentConversation.messages.append(assistantMessage)
        let assistantIndex = currentConversation.messages.count - 1

        isStreaming = true

        streamingTask = Task {
            do {
                let stream = try await client.stream(
                    messages: currentConversation.messages.dropLast(),
                    model: model,
                    apiKey: apiKey
                )

                for try await token in stream {
                    if Task.isCancelled { break }
                    currentConversation.messages[assistantIndex].content += token
                }

                currentConversation.messages[assistantIndex].status = .completed
                currentConversation.updatedAt = Date()
            } catch {
                if !Task.isCancelled {
                    currentConversation.messages[assistantIndex].status = .error(error.localizedDescription)
                    errorMessage = error.localizedDescription
                }
            }

            isStreaming = false
            saveCurrentIfNeeded()
        }

        await streamingTask?.value
    }

    public func stopStreaming() {
        streamingTask?.cancel()
        streamingTask = nil
        isStreaming = false
        if let lastIndex = currentConversation.messages.indices.last,
           case .streaming = currentConversation.messages[lastIndex].status {
            currentConversation.messages[lastIndex].status = .completed
        }
        saveCurrentIfNeeded()
    }

    private func saveCurrentIfNeeded() {
        guard !currentConversation.messages.isEmpty else { return }
        if let idx = savedConversations.firstIndex(where: { $0.id == currentConversation.id }) {
            savedConversations[idx] = currentConversation
        } else {
            savedConversations.insert(currentConversation, at: 0)
        }
        persistConversations()
    }

    private func persistConversations() {
        if let encoded = try? JSONEncoder().encode(savedConversations) {
            defaults.set(encoded, forKey: Self.savedConversationsKey)
        }
    }

    private func loadPersistedState() {
        if let data = defaults.data(forKey: Self.savedConversationsKey),
           let list = try? JSONDecoder().decode([Conversation].self, from: data) {
            savedConversations = list
        }
        if let savedModelId = defaults.string(forKey: Self.selectedModelKey),
           let match = AIModel.defaults.first(where: { $0.id == savedModelId }) {
            selectedModel = match
        }
    }
}
