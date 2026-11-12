import Foundation
import Testing
@testable import LumenCore

@Suite struct ChatExportTests {
    @Test func exportsInTheWebFormat() {
        var chat = Conversation(id: "c1", title: "Trip *plans*")
        chat.messages.append(ChatMessage(role: .system, content: "hidden instructions"))
        chat.messages.append(ChatMessage(role: .user, content: "Plan a trip", attachments: [
            ChatAttachment(id: "f1", name: "notes_v1.txt", kind: .text, mime: "text/plain", text: "x")]))
        var reply = ChatMessage(role: .assistant, content: "Here is a plan.")
        reply.modelID = "groq:llama-3.3-70b"
        chat.messages.append(reply)
        chat.messages.append(ChatMessage(role: .assistant, content: "Partial", status: .stopped))
        let markdown = ChatExport.markdown(chat)
        #expect(markdown == """
        # Trip \\*plans\\*

        ## You

        Attachments: notes\\_v1.txt

        Plan a trip

        ## Assistant · llama-3.3-70b

        Here is a plan.

        ## Assistant

        Partial

        _Reply incomplete._

        """)
        #expect(!markdown.contains("hidden instructions"))
    }

    @Test func fileNamesAreSafe() {
        #expect(ChatExport.fileName(for: Conversation(id: "a", title: "Q1: budget / plan?")) == "Q1 budget plan.md")
        #expect(ChatExport.fileName(for: Conversation(id: "b", title: "  ")) == "Chat.md")
        #expect(ChatExport.fileName(for: Conversation(id: "c", title: String(repeating: "a", count: 150))).count == 103)
    }

    @Test func nativeModelIDsAreKeptWhole() {
        #expect(ChatExport.shortModel("llama-3.3-70b-versatile") == "llama-3.3-70b-versatile")
        #expect(ChatExport.shortModel("openrouter:meta/llama:free") == "meta/llama:free")
    }
}
