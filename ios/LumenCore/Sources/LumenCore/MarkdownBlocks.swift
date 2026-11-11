import Foundation

/// One block of a reply, as the chat shows it: AI replies are Markdown, and reading them (code, tables, lists) is
/// Lumen's main job. Inline formatting (bold, italics, inline code, links) stays in each block's text and is
/// rendered by the view. The parser is line-based and forgiving, so a reply that is still streaming (an unclosed
/// code fence, half a table) always produces something sensible to show.
public enum MarkdownBlock: Equatable, Sendable {
    case heading(level: Int, text: String)
    case paragraph(String)
    case list(ordered: Bool, items: [MarkdownListItem])
    case quote(String)
    case code(language: String?, code: String, closed: Bool)
    case table(header: [String], rows: [[String]])
    case rule
}

public struct MarkdownListItem: Equatable, Sendable {
    /// "•" for an unordered item, "3." for an ordered one.
    public let marker: String
    public var text: String
    /// Nesting depth, from the item's indentation (two spaces or a tab per level).
    public let depth: Int

    public init(marker: String, text: String, depth: Int) {
        self.marker = marker
        self.text = text
        self.depth = depth
    }
}

public enum MarkdownBlocks {
    public static func parse(_ source: String) -> [MarkdownBlock] {
        let lines = source.replacingOccurrences(of: "\r\n", with: "\n").components(separatedBy: "\n")
        var blocks: [MarkdownBlock] = []
        var paragraph: [String] = []
        var quote: [String] = []
        var listOrdered = false
        var listItems: [MarkdownListItem] = []

        func flushParagraph() {
            if !paragraph.isEmpty { blocks.append(.paragraph(paragraph.joined(separator: "\n"))) }
            paragraph = []
        }
        func flushQuote() {
            if !quote.isEmpty { blocks.append(.quote(quote.joined(separator: "\n"))) }
            quote = []
        }
        func flushList() {
            if !listItems.isEmpty { blocks.append(.list(ordered: listOrdered, items: listItems)) }
            listItems = []
        }
        func flushAll() { flushParagraph(); flushQuote(); flushList() }

        var index = 0
        while index < lines.count {
            let line = lines[index]
            let trimmed = line.trimmingCharacters(in: .whitespaces)

            if let fence = fenceMarker(trimmed) {
                flushAll()
                let language = trimmed.dropFirst(fence.count).trimmingCharacters(in: .whitespaces)
                var code: [String] = []
                var closed = false
                index += 1
                while index < lines.count {
                    if lines[index].trimmingCharacters(in: .whitespaces).hasPrefix(fence) { closed = true; index += 1; break }
                    code.append(lines[index])
                    index += 1
                }
                blocks.append(.code(language: language.isEmpty ? nil : language, code: code.joined(separator: "\n"), closed: closed))
                continue
            }
            if trimmed.isEmpty { flushAll(); index += 1; continue }
            if let heading = heading(trimmed) { flushAll(); blocks.append(heading); index += 1; continue }
            if isRule(trimmed) { flushAll(); blocks.append(.rule); index += 1; continue }
            if trimmed.contains("|"), index + 1 < lines.count, isTableSeparator(lines[index + 1]) {
                flushAll()
                let header = cells(trimmed)
                var rows: [[String]] = []
                index += 2
                while index < lines.count {
                    let row = lines[index].trimmingCharacters(in: .whitespaces)
                    guard !row.isEmpty, row.contains("|") else { break }
                    var values = cells(row)
                    if values.count < header.count { values += Array(repeating: "", count: header.count - values.count) }
                    rows.append(Array(values.prefix(max(header.count, 1))))
                    index += 1
                }
                blocks.append(.table(header: header, rows: rows))
                continue
            }
            if trimmed.hasPrefix(">") {
                flushParagraph(); flushList()
                var text = trimmed.dropFirst()
                if text.hasPrefix(" ") { text = text.dropFirst() }
                quote.append(String(text))
                index += 1
                continue
            }
            if let found = listItem(line) {
                let (ordered, item) = found
                flushParagraph(); flushQuote()
                if !listItems.isEmpty && ordered != listOrdered && item.depth == 0 { flushList() }
                if listItems.isEmpty { listOrdered = ordered }
                listItems.append(item)
                index += 1
                continue
            }
            if !listItems.isEmpty && paragraph.isEmpty && (line.hasPrefix("  ") || line.hasPrefix("\t")) {
                // A wrapped continuation of the last list item.
                listItems[listItems.count - 1].text += "\n" + trimmed
                index += 1
                continue
            }
            flushQuote(); flushList()
            paragraph.append(trimmed)
            index += 1
        }
        flushAll()
        return blocks
    }

    private static func fenceMarker(_ line: String) -> String? {
        if line.hasPrefix("```") { return "```" }
        if line.hasPrefix("~~~") { return "~~~" }
        return nil
    }

    private static func heading(_ line: String) -> MarkdownBlock? {
        let hashes = line.prefix { $0 == "#" }.count
        guard (1...6).contains(hashes) else { return nil }
        let rest = line.dropFirst(hashes)
        guard rest.isEmpty || rest.hasPrefix(" ") else { return nil }
        var text = rest.trimmingCharacters(in: .whitespaces)
        while text.hasSuffix("#") { text.removeLast() }
        return .heading(level: hashes, text: text.trimmingCharacters(in: .whitespaces))
    }

    private static func isRule(_ line: String) -> Bool {
        let compact = line.filter { $0 != " " }
        guard compact.count >= 3, let first = compact.first, "-*_".contains(first) else { return false }
        return compact.allSatisfy { $0 == first }
    }

    private static func cells(_ line: String) -> [String] {
        var row = line.trimmingCharacters(in: .whitespaces)
        if row.hasPrefix("|") { row.removeFirst() }
        if row.hasSuffix("|") && !row.hasSuffix("\\|") { row.removeLast() }
        return row.components(separatedBy: "|").map { $0.trimmingCharacters(in: .whitespaces) }
    }

    private static func isTableSeparator(_ line: String) -> Bool {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        guard trimmed.contains("-") else { return false }
        let parts = cells(trimmed)
        return !parts.isEmpty && parts.allSatisfy { part in
            var core = Substring(part)
            if core.hasPrefix(":") { core = core.dropFirst() }
            if core.hasSuffix(":") { core = core.dropLast() }
            return !core.isEmpty && core.allSatisfy { $0 == "-" }
        }
    }

    private static func listItem(_ line: String) -> (Bool, MarkdownListItem)? {
        var spaces = 0
        for character in line {
            if character == " " { spaces += 1 } else if character == "\t" { spaces += 2 } else { break }
        }
        let depth = min(spaces / 2, 4)
        let body = line.drop { $0 == " " || $0 == "\t" }
        if let first = body.first, "-*+".contains(first), body.dropFirst().hasPrefix(" ") {
            return (false, MarkdownListItem(marker: "•", text: body.dropFirst(2).trimmingCharacters(in: .whitespaces), depth: depth))
        }
        let digits = body.prefix { $0.isASCII && $0.isNumber }
        guard !digits.isEmpty, digits.count <= 9 else { return nil }
        let after = body.dropFirst(digits.count)
        guard let delimiter = after.first, delimiter == "." || delimiter == ")", after.dropFirst().hasPrefix(" ") else { return nil }
        return (true, MarkdownListItem(marker: String(digits) + ".", text: after.dropFirst(2).trimmingCharacters(in: .whitespaces), depth: depth))
    }
}
