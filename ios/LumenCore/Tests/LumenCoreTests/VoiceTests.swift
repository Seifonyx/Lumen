import Foundation
import Testing
@testable import LumenCore

@Suite struct VoiceTests {
    @Test func dictationJoinsWhatWasTypedWithOneSpace() {
        #expect(DictationText.merge(draft: "", dictated: " Hello there ") == "Hello there")
        #expect(DictationText.merge(draft: "Summarise", dictated: "this article") == "Summarise this article")
        #expect(DictationText.merge(draft: "Line one\n", dictated: "line two") == "Line one\nline two")
        #expect(DictationText.merge(draft: "Keep me ", dictated: "  ") == "Keep me ")
    }

    @Test func readAloudSpeaksWordsNotMarkdown() {
        let reply = """
        ## Plan

        Use **bold** ideas, *careful* steps and `swift test` with [the docs](https://example.com).
        Keep snake_case names.

        - First _point_
        - Second point

        ```swift
        let x = 1
        ```

        | Name | Cost |
        |---|---|
        | Tea | 2 |

        ---
        [[remember: likes tea]]
        """
        #expect(SpeechText.plain(reply) == """
        Plan

        Use bold ideas, careful steps and swift test with the docs.
        Keep snake_case names.

        First point
        Second point

        Code block.

        Name, Cost.
        Tea, 2
        """)
    }

    @Test func linksOnlyEverFillANewChat() throws {
        #expect(LumenLink(url: try #require(URL(string: "lumen://new?prompt=Plan%20a%20trip"))) == .newChat(prompt: "Plan a trip"))
        #expect(LumenLink(url: try #require(URL(string: "LUMEN://ask?q=%20hi%20"))) == .newChat(prompt: "hi"))
        #expect(LumenLink(url: try #require(URL(string: "lumen://chat"))) == .newChat(prompt: nil))
        #expect(LumenLink(url: try #require(URL(string: "lumen://new?prompt=%20%20"))) == .newChat(prompt: nil))
        #expect(LumenLink(url: try #require(URL(string: "lumen://delete?prompt=x"))) == nil)
        #expect(LumenLink(url: try #require(URL(string: "https://new?prompt=x"))) == nil)
        let long = String(repeating: "a", count: LumenLink.maxPromptLength + 50)
        #expect(LumenLink.clean(long)?.count == LumenLink.maxPromptLength)
        let made = LumenLink.url(prompt: "Ask & answer?")
        #expect(LumenLink(url: made) == .newChat(prompt: "Ask & answer?"))
    }
}
