import Foundation
import Testing
@testable import LumenCore

@Suite struct LibraryTests {
    private func chat(_ id: String, title: String, root: String? = nil, messages: [ChatMessage]) -> Conversation {
        var chat = Conversation(id: id, title: title, messages: messages)
        chat.lineageRootID = root
        return chat
    }
    private let notes = ChatAttachment(id: "notes", name: "Notes.txt", kind: .text, mime: "text/plain", text: "hi")
    private let photo = ChatAttachment(id: "photo", name: "Beach.jpg", kind: .image, mime: "image/jpeg", size: 10)

    @Test func filesAndPhotosFromEveryChatNewestFirst() {
        let old = ChatMessage(role: .user, content: "a", timestamp: Date(timeIntervalSince1970: 1), attachments: [notes])
        let new = ChatMessage(role: .user, content: "b", timestamp: Date(timeIntervalSince1970: 2), attachments: [photo])
        let items = LibraryIndex.items(in: [chat("c1", title: "Trip", messages: [old]), chat("c2", title: "Holiday", messages: [new])])
        #expect(items.map(\.file.id) == ["photo", "notes"])
        #expect(items.map(\.kind) == [.photos, .files])
        #expect(items.first?.chatTitle == "Holiday")
    }

    @Test func aFileSharedByVersionsOfAChatAppearsOnce() {
        let message = ChatMessage(role: .user, content: "a", attachments: [notes])
        let original = chat("c1", title: "Plan", messages: [message])
        let version = chat("c1-v2", title: "Plan", root: "c1", messages: [message])
        #expect(LibraryIndex.items(in: [original, version]).count == 1)
    }

    @Test func replyFilesAreFromRepliesAndSystemMessagesAreSkipped() {
        let reply = ChatMessage(role: .assistant, content: "here", attachments: [notes])
        let system = ChatMessage(role: .system, content: "rules", attachments: [photo])
        let items = LibraryIndex.items(in: [chat("c1", title: "Report", messages: [reply, system])])
        #expect(items.map(\.kind) == [.generated])
    }

    @Test func filtersByKindAndSearchesNamesAndChatTitles() {
        let items = LibraryIndex.items(in: [
            chat("c1", title: "Café plans", messages: [ChatMessage(role: .user, content: "a", attachments: [notes, photo])]),
        ])
        #expect(LibraryIndex.filter(items, kind: .photos, query: "").map(\.file.id) == ["photo"])
        #expect(LibraryIndex.filter(items, kind: .all, query: "beach").map(\.file.id) == ["photo"])
        #expect(LibraryIndex.filter(items, kind: .all, query: "cafe").count == 2, "Accents are ignored")
        #expect(LibraryIndex.filter(items, kind: .files, query: "beach").isEmpty)
    }
}
