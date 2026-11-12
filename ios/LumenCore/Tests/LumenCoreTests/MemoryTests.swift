import Foundation
import Testing
@testable import LumenCore

private final class ReplyClient: AIStreamingClient, @unchecked Sendable {
    let reply: String
    private let lock = NSLock()
    private var sent: [[ChatMessage]] = []
    init(reply: String) { self.reply = reply }
    var requests: [[ChatMessage]] { lock.withLock { sent } }
    func stream(messages: [ChatMessage], model: AIModel, apiKey: String) async throws -> AsyncThrowingStream<String, Error> {
        lock.withLock { sent.append(messages) }
        let reply = reply
        return AsyncThrowingStream { $0.yield(reply); $0.finish() }
    }
}

@Suite struct MemoryRulesTests {
    @Test func readsTheWebDocumentNewestFirst() {
        let document: [String: Any] = ["items": [
            "a": ["id": "a", "text": "Works as a pharmacist", "createdAt": 1.0, "updatedAt": 5.0, "source": "chat"],
            "b": ["id": "b", "text": "Prefers short answers", "createdAt": 2.0, "updatedAt": 9.0, "source": "manual", "projectId": "p1"],
            "c": ["id": "c", "text": "   "],
        ]]
        let memories = MemoryRules.memories(from: document)
        #expect(memories.map(\.id) == ["b", "a"])
        #expect(memories[0].projectID == "p1")
    }

    @Test func recognisesTheSameFact() {
        #expect(MemoryRules.same("Prefers short answers", "prefers SHORT answers!"))
        #expect(MemoryRules.same("Works as a pharmacist in Cairo", "Works as a pharmacist"))
        #expect(!MemoryRules.same("Likes tea", "Lives in Cairo"))
    }

    @Test func splitsAReplyIntoTextAndChanges() {
        let reply = "Got it.\n\n[[remember: Prefers metric units]]\n[[forget: Lives in Paris]]\n[[Remember for project: Deadline is May]]"
        let operations = MemoryRules.operations(in: reply)
        #expect(operations.text == "Got it.")
        #expect(operations.remember == ["Prefers metric units"])
        #expect(operations.forget == ["Lives in Paris"])
        #expect(operations.project == ["Deadline is May"])
        #expect(MemoryRules.operations(in: "Plain reply").isEmpty)
    }

    @Test func hidesLinesWhileTheyAreBeingWritten() {
        #expect(MemoryRules.hidingLines("Sure. [[remember: Likes") == "Sure. ")
        #expect(MemoryRules.hidingLines("Sure. [[rem") == "Sure. ")
        #expect(MemoryRules.hidingLines("Sure. [[remember: Likes tea]] Done") == "Sure.  Done")
        #expect(MemoryRules.hidingLines("Use a[0] here") == "Use a[0] here")
    }

    @Test func instructionsMatchTheWeb() {
        let memories = [Memory(id: "a", text: "Prefers short answers", createdAt: 1, updatedAt: 1),
                        Memory(id: "b", text: "Deadline is May", createdAt: 1, updatedAt: 1, projectID: "p1"),
                        Memory(id: "c", text: "Other project fact", createdAt: 1, updatedAt: 1, projectID: "p2")]
        let text = MemoryRules.instructions(memories: memories, autoSave: false, projectID: "p1", projectName: "Thesis", aboutMe: "I teach.")
        #expect(text.hasPrefix("# Memory\nWhat the user wrote about themselves"))
        #expect(text.contains("- Prefers short answers\n- Deadline is May (this project)"))
        #expect(!text.contains("Other project fact"))
        #expect(text.contains("project \"Thesis\""))
        #expect(text.contains("Save a memory only when the user explicitly asks"))
        let empty = MemoryRules.instructions(memories: [], autoSave: true, projectID: nil, projectName: nil, aboutMe: "")
        #expect(empty.contains("You have no saved memories about the user yet."))
        #expect(!empty.contains("wrote about themselves"))
    }

    @Test func personalizationDefaultsAndKeepsOtherSettings() {
        let read = Personalization(settings: ["theme": "dark"])
        #expect(read.memory && read.memoryAuto && read.aboutMe.isEmpty)
        var edited = read
        edited.aboutMe = "Teacher"
        edited.memoryAuto = false
        let settings = edited.apply(to: ["theme": "dark", "projects": [["id": "p1"]]])
        #expect(settings["theme"] as? String == "dark")
        #expect((settings["projects"] as? [Any])?.count == 1)
        #expect(settings["aboutMe"] as? String == "Teacher")
        #expect(settings["memoryAuto"] as? Bool == false)
    }
}

@Suite @MainActor struct MemoryEngineTests {
    @Test func memoryLeadsRequestsAndRepliesSaveMemories() async {
        let client = ReplyClient(reply: "Noted.\n[[remember: Likes tea]]")
        let engine = ChatEngine(client: client, store: MemoryConversationStore())
        engine.selectModel(AIModel.defaults[0])
        var personalization = Personalization()
        personalization.customInstructions = "Be brief."
        engine.personalization = personalization
        engine.memories = [Memory(id: "m", text: "Lives in Cairo", createdAt: 1, updatedAt: 1)]
        var saved: [String] = []
        engine.onMemoryOperations = { operations, _, _ in saved += operations.remember }
        await engine.send(prompt: "Remember I like tea", apiKey: "key")
        let lead = client.requests.first?.first
        #expect(lead?.role == .system)
        #expect(lead?.content.hasPrefix("Be brief.\n\n# Memory") == true)
        #expect(lead?.content.contains("- Lives in Cairo") == true)
        #expect(engine.currentConversation.messages.last?.content == "Noted.")
        #expect(saved == ["Likes tea"])
        #expect(engine.memoryUpdates == 1)
    }

    @Test func temporaryChatsNeitherUseNorChangeMemory() async {
        let client = ReplyClient(reply: "Ok [[remember: Secret]]")
        let engine = ChatEngine(client: client, store: MemoryConversationStore())
        engine.selectModel(AIModel.defaults[0])
        engine.personalization = Personalization()
        engine.memories = [Memory(id: "m", text: "Lives in Cairo", createdAt: 1, updatedAt: 1)]
        var called = false
        engine.onMemoryOperations = { _, _, _ in called = true }
        #expect(engine.startTemporaryConversation())
        await engine.send(prompt: "hi", apiKey: "key")
        #expect(client.requests.first?.contains { $0.content.contains("Lives in Cairo") } == false)
        #expect(!called)
    }

    @Test func noAccountMeansNoMemoryInstructions() async {
        let client = ReplyClient(reply: "Hello")
        let engine = ChatEngine(client: client, store: MemoryConversationStore())
        engine.selectModel(AIModel.defaults[0])
        await engine.send(prompt: "hi", apiKey: "key")
        #expect(client.requests.first?.contains { $0.role == .system } == false)
    }
}
