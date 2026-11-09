import Foundation
import Testing
@testable import LumenCore

@Suite @MainActor struct AttachmentTests {
    @Test func attachmentStorageIsProtectedAccountScopedAndRejectsUnsafeIDsAndOversizedText() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = FileAttachmentStore(directory: directory)
        let file = ChatAttachment(id: "safe-id", name: "notes.txt", kind: .text, mime: "text/plain", text: "Nutrition notes")
        try store.save(file, accountID: "a")
        #expect(try store.load(id: "safe-id", accountID: "a").text == "Nutrition notes")
        #expect(throws: (any Error).self) { try store.load(id: "safe-id", accountID: "b") }
        #expect(throws: AttachmentError.self) { try store.load(id: "../unsafe", accountID: "a") }
        let large = ChatAttachment(name: "large.txt", kind: .text, mime: "text/plain", text: String(repeating: "a", count: 60_001))
        #expect(throws: AttachmentError.self) { try store.save(large, accountID: "a") }
    }

    @Test func attachmentMetadataOmitsRawBytesButPreservesWebFields() throws {
        let image = ChatAttachment(id: "image", name: "image.jpg", kind: .image, mime: "image/jpeg", data: Data([0xff,0xd8,0xff,0xd9]))
        let encoded = try JSONEncoder().encode(image)
        let decoded = try JSONDecoder().decode(ChatAttachment.self, from: encoded)
        #expect(decoded.data == nil)
        #expect(decoded.name == "image.jpg")
        let message = ChatMessage(role: .user, content: "Look", attachments: [image])
        let chat = Conversation(messages: [message])
        let plan = try WebChatCodec.append(chat: chat, messageIDs: [message.id], remote: nil, existingMessages: [:])
        let files = try #require(plan.messages[message.id]?["files"] as? [[String: Any]])
        #expect(files.first?["id"] as? String == "image")
        #expect(files.first?["data"] == nil)
        #expect(files.first?["stored"] as? Bool == true)
    }

    @Test func imageRequestsRejectUnsupportedModelsBeforeAcceptingTheDraft() throws {
        let engine = ChatEngine(store: MemoryConversationStore(), attachmentStore: MemoryAttachmentStore())
        engine.selectModel(AIModel(id: "llama-3.3-70b", name: "Text", providerId: "groq"))
        let image = ChatAttachment(name: "image.jpg", kind: .image, mime: "image/jpeg", data: Data([0xff,0xd8,0xff,0xd9]))
        try engine.storeAttachment(image)
        #expect(engine.submit(prompt: "Look", attachmentIDs: [image.id], apiKey: "key") == nil)
        #expect(engine.currentConversation.messages.isEmpty)
        #expect(engine.errorMessage?.contains("image") == true)
    }

    @Test func everyProviderReceivesActualImageBytesAndExtractedText() throws {
        let photo = ChatAttachment(name: "photo.jpg", kind: .image, mime: "image/jpeg", data: Data([0xff,0xd8,0xff,0xd9]))
        let text = ChatAttachment(name: "notes.txt", kind: .text, mime: "text/plain", text: "Important file contents")
        let messages = [ChatMessage(role: .system, content: "Instructions"), ChatMessage(role: .user, content: "Look", attachments: [photo, text])]
        let models = [AIModel.defaults[0], AIModel.defaults[3], AIModel.defaults[4], AIModel(id: "meta-llama/llama-4-scout-17b-16e-instruct", name: "Vision", providerId: "groq")]
        for model in models {
            let body = try ProviderInput.body(messages: messages, model: model)
            let json = String(decoding: try JSONSerialization.data(withJSONObject: body, options: [.withoutEscapingSlashes]), as: UTF8.self)
            #expect(json.contains("Important file contents"))
            #expect(json.contains(photo.data!.base64EncodedString()))
            switch model.providerId {
            case "gemini": #expect(json.contains("inlineData"))
            case "anthropic": #expect(json.contains("media_type"))
            default: #expect(json.contains("image_url"))
            }
        }
    }

    @Test func olderNameOnlyAttachmentCachesRequireCloudReloadRatherThanDroppingTheFile() {
        let store = MemoryConversationStore()
        var chat = Conversation(id: "old", messages: [ChatMessage(role: .user, content: "Read this", attachmentNames: ["notes.txt"])])
        chat.historyLoaded = true
        store.accounts["device"] = ChatSnapshot(conversations: [chat], selectedModel: AIModel.defaults[0], selectedConversationID: chat.id)
        let engine = ChatEngine(store: store)
        #expect(engine.currentConversation.historyLoaded == false)
        #expect(engine.submit(prompt: "Continue", apiKey: "key") == nil)
    }

    @Test func temporaryAttachmentBytesNeverEnterTheFileStore() throws {
        let files = MemoryAttachmentStore()
        let engine = ChatEngine(store: MemoryConversationStore(), attachmentStore: files)
        engine.startTemporaryConversation()
        let attachment = ChatAttachment(name: "secret.txt", kind: .text, mime: "text/plain", text: "Secret attachment")
        try engine.storeAttachment(attachment)
        #expect(files.accounts.isEmpty)
        #expect(try engine.attachment(id: attachment.id).text == "Secret attachment")
        engine.startNewConversation()
        #expect(throws: (any Error).self) { try engine.attachment(id: attachment.id) }
    }
}

@MainActor final class MemoryAttachmentStore: AttachmentStore {
    var accounts: [String: [String: ChatAttachment]] = [:]
    func load(id: String, accountID: String) throws -> ChatAttachment {
        guard let file = accounts[accountID]?[id] else { throw AttachmentError.unavailable }
        return file
    }
    func save(_ file: ChatAttachment, accountID: String) throws { accounts[accountID, default: [:]][file.id] = file }
}
