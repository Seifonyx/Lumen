import SwiftUI
import UIKit
import LumenCore

/// A reply as formatted text: paragraphs, headings, lists, quotes, tables and code, each selectable.
/// Inline formatting (bold, italics, `code`, links) comes from Foundation's Markdown support.
struct MessageContent: View {
    let text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            ForEach(Array(MarkdownBlocks.parse(text).enumerated()), id: \.offset) { _, block in
                MarkdownBlockView(block: block)
            }
        }
        .textSelection(.enabled)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private func inline(_ text: String) -> AttributedString {
    (try? AttributedString(markdown: text, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace))) ?? AttributedString(text)
}

private struct MarkdownBlockView: View {
    let block: MarkdownBlock

    var body: some View {
        switch block {
        case .paragraph(let text):
            Text(inline(text))
                .font(.body)
                .lineSpacing(3)
                .fixedSize(horizontal: false, vertical: true)
        case .heading(let level, let text):
            Text(inline(text))
                .font(level == 1 ? .title3.weight(.bold) : level == 2 ? .headline : .subheadline.weight(.semibold))
                .padding(.top, level <= 2 ? 6 : 2)
                .accessibilityAddTraits(.isHeader)
        case .list(_, let items):
            VStack(alignment: .leading, spacing: 8) {
                ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text(item.marker)
                            .font(.body.monospacedDigit())
                            .foregroundStyle(LumenPalette.muted)
                            .frame(minWidth: 14, alignment: .trailing)
                            .accessibilityHidden(item.marker == "•")
                        Text(inline(item.text))
                            .font(.body)
                            .lineSpacing(3)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(.leading, CGFloat(item.depth) * 18)
                }
            }
        case .quote(let text):
            HStack(alignment: .top, spacing: 12) {
                RoundedRectangle(cornerRadius: 1.5)
                    .fill(LumenPalette.stroke)
                    .frame(width: 3)
                    .accessibilityHidden(true)
                Text(inline(text))
                    .font(.body)
                    .foregroundStyle(LumenPalette.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
        case .code(let language, let code, _):
            CodeBlock(language: language, code: code)
        case .table(let header, let rows):
            MarkdownTable(header: header, rows: rows)
        case .rule:
            Divider().padding(.vertical, 4)
        }
    }
}

private struct CodeBlock: View {
    let language: String?
    let code: String
    @State private var copied = 0
    @State private var showingCopied = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text(language ?? "Code")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(LumenPalette.muted)
                Spacer()
                Button {
                    UIPasteboard.general.string = code
                    copied += 1
                    showingCopied = true
                    Task { @MainActor in
                        try? await Task.sleep(for: .seconds(1.5))
                        showingCopied = false
                    }
                } label: {
                    Label(showingCopied ? "Copied" : "Copy", systemImage: showingCopied ? "checkmark" : "doc.on.doc")
                        .font(.caption.weight(.medium))
                        .foregroundStyle(LumenPalette.muted)
                        .frame(minHeight: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(showingCopied ? "Copied code" : "Copy code")
                .sensoryFeedback(.success, trigger: copied)
            }
            .padding(.leading, 14)
            .padding(.trailing, 10)
            Divider().opacity(0.6)
            ScrollView(.horizontal) {
                Text(code.isEmpty ? " " : code)
                    .font(.system(.footnote, design: .monospaced))
                    .lineSpacing(2)
                    .fixedSize(horizontal: true, vertical: true)
                    .padding(14)
            }
            .scrollIndicators(.hidden)
        }
        .background(LumenPalette.elevated, in: .rect(cornerRadius: LumenRadius.compact, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: LumenRadius.compact, style: .continuous)
                .strokeBorder(LumenPalette.stroke.opacity(0.6), lineWidth: 1)
                .allowsHitTesting(false)
        }
    }
}

private struct MarkdownTable: View {
    let header: [String]
    let rows: [[String]]

    var body: some View {
        ScrollView(.horizontal) {
            Grid(alignment: .leading, horizontalSpacing: 18, verticalSpacing: 10) {
                GridRow {
                    ForEach(Array(header.enumerated()), id: \.offset) { _, cell in
                        Text(inline(cell)).font(.subheadline.weight(.semibold))
                    }
                }
                Divider().gridCellUnsizedAxes(.horizontal)
                ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                    GridRow {
                        ForEach(Array(row.enumerated()), id: \.offset) { _, cell in
                            Text(inline(cell)).font(.subheadline)
                        }
                    }
                }
            }
            .padding(14)
        }
        .scrollIndicators(.hidden)
        .background(LumenPalette.elevated.opacity(0.6), in: .rect(cornerRadius: LumenRadius.compact, style: .continuous))
    }
}
