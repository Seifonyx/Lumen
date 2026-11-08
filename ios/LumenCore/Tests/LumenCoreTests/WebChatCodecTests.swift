import Foundation
import Testing
@testable import LumenCore

@Suite struct WebChatCodecTests {
    @Test func aNotYetUploadedDocumentIsNotARemoteDeletion() {
        #expect(!WebChatCodec.isTombstone(nil))
        #expect(!WebChatCodec.isTombstone([:]))
        #expect(WebChatCodec.isTombstone(["deleted": true]))
    }
    @Test func readsWebIDsMillisecondsAndStoppedReplies() throws {
        let fields: [String: Any] = ["title": "From the web", "createdAt": 1700000000000.0, "updatedAt": 1700000001000.0, "ids": ["web-u", "web-a"], "model": "gpt-4.1", "projectId": "keep-project"]
        let chat = try WebChatCodec.conversation(id: "arbitrary-web-id", fields: fields)
        #expect(chat.id == "arbitrary-web-id")
        #expect(chat.createdAt.timeIntervalSince1970 == 1700000000)
        #expect(chat.remoteMessageIDs == ["web-u", "web-a"])
        #expect(chat.historyLoaded == false)
        let msg = try WebChatCodec.message(id: "web-a", fields: ["role": "assistant", "text": "Partial answer", "status": "stopped", "createdAt": 1700000001000.0, "files": [["name": "notes.pdf", "url": "private"]]])
        #expect(msg.status == .stopped)
        #expect(msg.attachmentNames == ["notes.pdf"])
    }
    @Test func appendKeepsConcurrentWebMessagesAndDoesNotRewriteUnknownMetadata() throws {
        let message = ChatMessage(id: "native-a", role: .assistant, content: "Reply")
        let chat = Conversation(id: "existing-chat", title: "Cached older title", messages: [message])
        let remote: [String: Any] = ["ids": ["web-u", "web-a", "web-concurrent"], "title": "New web title", "projectId": "project", "documents": [["id": "doc"]], "rev": 12]
        let plan = try WebChatCodec.append(chat: chat, messageIDs: [message.id], remote: remote, existingMessages: [:])
        #expect(plan.metadata["ids"] as? [String] == ["web-u", "web-a", "web-concurrent", "native-a"])
        #expect(plan.metadata["count"] as? Int == 4)
        #expect(plan.metadata["title"] == nil)
        #expect(plan.metadata["projectId"] == nil)
        #expect(plan.metadata["documents"] == nil)
        #expect(plan.messages[message.id]?["index"] as? Int == 3)
    }
    @Test func tombstonedChatsAndEditedMessagesAreNeverResurrectedOrOverwritten() {
        let message = ChatMessage(id: "id", role: .user, content: "Old")
        let chat = Conversation(messages: [message])
        #expect(throws: WebSyncError.self) { try WebChatCodec.append(chat: chat, messageIDs: ["id"], remote: ["deleted": true], existingMessages: [:]) }
        #expect(throws: WebSyncError.self) { try WebChatCodec.append(chat: chat, messageIDs: ["id"], remote: ["ids": ["id"]], existingMessages: ["id": ["text": "Edited on web"]]) }
    }
}
