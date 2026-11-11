import Testing
@testable import LumenCore

@Suite struct MarkdownBlocksTests {
    @Test func plainReplyIsOneParagraph() {
        #expect(MarkdownBlocks.parse("A native streamed reply.") == [.paragraph("A native streamed reply.")])
    }

    @Test func paragraphsKeepLineBreaksAndSplitOnBlankLines() {
        #expect(MarkdownBlocks.parse("First line\nsecond line\n\nNext **bold**") == [
            .paragraph("First line\nsecond line"), .paragraph("Next **bold**")
        ])
    }

    @Test func headingsRulesAndQuotes() {
        #expect(MarkdownBlocks.parse("# Title\n## Part ##\n---\n> quoted\n> more\n#hashtag") == [
            .heading(level: 1, text: "Title"), .heading(level: 2, text: "Part"), .rule,
            .quote("quoted\nmore"), .paragraph("#hashtag")
        ])
    }

    @Test func unorderedOrderedAndNestedLists() {
        let blocks = MarkdownBlocks.parse("- one\n- two\n  - inner\n    wrapped\n\n1. first\n2) second")
        #expect(blocks == [
            .list(ordered: false, items: [
                MarkdownListItem(marker: "•", text: "one", depth: 0),
                MarkdownListItem(marker: "•", text: "two", depth: 0),
                MarkdownListItem(marker: "•", text: "inner\nwrapped", depth: 1)
            ]),
            .list(ordered: true, items: [
                MarkdownListItem(marker: "1.", text: "first", depth: 0),
                MarkdownListItem(marker: "2.", text: "second", depth: 0)
            ])
        ])
    }

    @Test func fencedCodeKeepsIndentationAndLanguage() {
        #expect(MarkdownBlocks.parse("Run:\n```swift\nlet x = 1\n    indented\n```\nDone") == [
            .paragraph("Run:"), .code(language: "swift", code: "let x = 1\n    indented", closed: true), .paragraph("Done")
        ])
    }

    @Test func streamingCodeFenceIsShownAsOpenCode() {
        #expect(MarkdownBlocks.parse("```\nprint(1)") == [.code(language: nil, code: "print(1)", closed: false)])
    }

    @Test func tablesPadShortRowsAndStopAtTheFirstNonRow() {
        let blocks = MarkdownBlocks.parse("| Model | Speed |\n|:--|--:|\n| A | fast |\n| B |\nAfter")
        #expect(blocks == [
            .table(header: ["Model", "Speed"], rows: [["A", "fast"], ["B", ""]]),
            .paragraph("After")
        ])
    }

    @Test func pipesWithoutASeparatorStayText() {
        #expect(MarkdownBlocks.parse("a | b\nc") == [.paragraph("a | b\nc")])
    }

    @Test func emptyAndCRLFInput() {
        #expect(MarkdownBlocks.parse("").isEmpty)
        #expect(MarkdownBlocks.parse("one\r\n\r\ntwo") == [.paragraph("one"), .paragraph("two")])
    }
}
