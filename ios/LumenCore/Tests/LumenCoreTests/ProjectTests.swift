import Foundation
import Testing
@testable import LumenCore

private final class RecordingClient: AIStreamingClient, @unchecked Sendable {
    private let lock = NSLock()
    private var sent: [[ChatMessage]] = []
    var requests: [[ChatMessage]] { lock.withLock { sent } }

    func stream(messages: [ChatMessage], model: AIModel, apiKey: String) async throws -> AsyncThrowingStream<String, Error> {
        lock.withLock { sent.append(messages) }
        return AsyncThrowingStream { continuation in
            continuation.yield("Reply")
            continuation.finish()
        }
    }
}

@Suite struct ProjectSettingsTests {
    private let settings: [String: Any] = [
        "theme": "dark",
        "projects": [
            ["id": "p1", "name": "Thesis", "instructions": "Be concise.", "color": "blue",
             "files": [["id": "f1", "name": "notes.txt"]], "createdAt": 1.0, "updatedAt": 2.0],
            ["name": "missing id"],
            ["id": "p2", "name": "Trips", "futureField": "keep"],
        ],
    ]

    @Test func readsProjectsInOrderAndSkipsMalformedOnes() {
        let projects = ProjectSettings.projects(from: settings)
        #expect(projects.map(\.id) == ["p1", "p2"])
        #expect(projects[0].instructions == "Be concise.")
        #expect(projects[1].instructions == "")
        #expect(ProjectSettings.projects(from: nil).isEmpty)
    }

    @Test func createKeepsEverythingElseAndIsIdempotent() throws {
        let once = try ProjectSettings.apply(.create(id: "p3", name: "  New  ", instructions: "Hi"), to: settings, now: 10)
        #expect(once["theme"] as? String == "dark")
        let list = try #require(once["projects"] as? [Any])
        #expect(list.count == 4)
        let created = try #require(list.last as? [String: Any])
        #expect(created["name"] as? String == "New")
        #expect(created["createdAt"] as? Double == 10)
        let twice = try ProjectSettings.apply(.create(id: "p3", name: "New", instructions: "Hi"), to: once, now: 11)
        #expect((twice["projects"] as? [Any])?.count == 4)
    }

    @Test func updateChangesOnlyNameInstructionsAndTime() throws {
        let result = try ProjectSettings.apply(.update(id: "p1", name: "Thesis 2", instructions: "Cite sources."), to: settings, now: 20)
        let first = try #require((result["projects"] as? [Any])?.first as? [String: Any])
        #expect(first["name"] as? String == "Thesis 2")
        #expect(first["instructions"] as? String == "Cite sources.")
        #expect(first["updatedAt"] as? Double == 20)
        #expect(first["color"] as? String == "blue")
        #expect((first["files"] as? [Any])?.count == 1)
        #expect(first["createdAt"] as? Double == 1)
    }

    @Test func deleteRemovesOnlyThatProject() throws {
        let result = try ProjectSettings.apply(.delete(id: "p2"), to: settings, now: 30)
        #expect(ProjectSettings.projects(from: result).map(\.id) == ["p1"])
        let again = try ProjectSettings.apply(.delete(id: "p2"), to: result, now: 31)
        #expect(ProjectSettings.projects(from: again).map(\.id) == ["p1"])
    }

    @Test func rejectsInvalidEdits() {
        #expect(throws: ProjectEditError.invalidName) { try ProjectSettings.apply(.create(id: "x", name: "   ", instructions: ""), to: settings, now: 1) }
        #expect(throws: ProjectEditError.notFound) { try ProjectSettings.apply(.update(id: "gone", name: "A", instructions: ""), to: settings, now: 1) }
        let long = String(repeating: "a", count: ProjectSettings.maximumInstructionsLength + 1)
        #expect(throws: ProjectEditError.instructionsTooLong) { try ProjectSettings.apply(.create(id: "x", name: "A", instructions: long), to: settings, now: 1) }
    }
}

@Suite struct ProjectSyncTests {
    @Test func chatDocumentsCarryTheirProject() throws {
        let chat = try WebChatCodec.conversation(id: "c1", fields: ["title": "A", "projectId": "p1", "ids": []])
        #expect(chat.projectId == "p1")
        let none = try WebChatCodec.conversation(id: "c2", fields: ["title": "B", "projectId": NSNull()])
        #expect(none.projectId == nil)
    }

    @Test func movingWritesTheWebFieldAndRemovingWritesNull() throws {
        let remote: [String: Any] = ["title": "A", "rev": 1.0]
        let into = try WebChatCodec.metadataPatch(ChatMetadataPatch(project: ProjectAssignment(projectID: "p1")), remote: remote)
        #expect(into["projectId"] as? String == "p1")
        let out = try WebChatCodec.metadataPatch(ChatMetadataPatch(project: ProjectAssignment(projectID: nil)), remote: remote)
        #expect(out["projectId"] is NSNull)
        let rename = try WebChatCodec.metadataPatch(ChatMetadataPatch(title: "B"), remote: remote)
        #expect(rename["projectId"] == nil)
    }

    @Test func aNewChatInAProjectIsCreatedInIt() throws {
        var chat = Conversation(id: "c3")
        chat.projectId = "p1"
        let message = chat.appendUserMessage("Hello")
        let plan = try WebChatCodec.append(chat: chat, messageIDs: [message.id], remote: nil, existingMessages: [:])
        #expect(plan.metadata["projectId"] as? String == "p1")
    }

    @Test @MainActor func projectInstructionsLeadEveryRequestInThatProject() async {
        let client = RecordingClient()
        let engine = ChatEngine(client: client, store: MemoryConversationStore())
        engine.selectModel(AIModel.defaults[0])
        engine.projectInstructions = ["p1": "Answer in French."]
        #expect(engine.startNewConversation(projectID: "p1"))
        await engine.send(prompt: "Hello", apiKey: "key")
        let first = client.requests.first ?? []
        #expect(first.first?.role == .system)
        #expect(first.first?.content == "Answer in French.")
        #expect(!engine.currentConversation.messages.contains { $0.role == .system }, "Instructions are sent, not stored")
        #expect(engine.currentConversation.projectId == "p1")

        #expect(engine.startNewConversation())
        await engine.send(prompt: "Outside", apiKey: "key")
        #expect(client.requests.last?.contains { $0.role == .system } == false)
    }

    @Test @MainActor func movingAChatUpdatesItLocally() async {
        let engine = ChatEngine(client: RecordingClient(), store: MemoryConversationStore())
        engine.selectModel(AIModel.defaults[0])
        await engine.send(prompt: "Hello", apiKey: "key")
        let id = engine.currentConversation.id
        #expect(engine.moveConversation(id: id, toProject: "p9"))
        #expect(engine.currentConversation.projectId == "p9")
        #expect(engine.moveConversation(id: id, toProject: nil))
        #expect(engine.currentConversation.projectId == nil)
    }
}
