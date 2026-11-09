import SwiftUI

struct MessageContent: View {
    let text: String
    var body: some View {
        let sections = text.components(separatedBy: "```")
        VStack(alignment: .leading, spacing: 12) {
            ForEach(Array(sections.enumerated()), id: \.offset) { index, section in
                if index.isMultiple(of: 2) {
                    Text((try? AttributedString(markdown: section, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace))) ?? AttributedString(section))
                        .font(.body).textSelection(.enabled)
                } else {
                    let lines = section.split(separator: "\n", maxSplits: 1, omittingEmptySubsequences: false)
                    VStack(alignment: .leading, spacing: 8) {
                        if let language = lines.first, !language.isEmpty { Text(language).font(.caption).foregroundStyle(.secondary) }
                        ScrollView(.horizontal) { Text(lines.count > 1 ? String(lines[1]) : section).font(.system(.subheadline, design: .monospaced)).textSelection(.enabled) }
                    }
                    .padding(12)
                    .background(Color(uiColor: .tertiarySystemFill), in: .rect(cornerRadius: 12))
                }
            }
        }
    }
}
