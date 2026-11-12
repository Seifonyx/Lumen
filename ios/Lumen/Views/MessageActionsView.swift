import SwiftUI
import UIKit
import LumenCore

struct MessageRow: View {
    let message: ChatMessage
    let canRevise: Bool
    var modelName: String? = nil
    let edit: () -> Void
    let regenerate: () -> Void
    var openAttachment: ((ChatAttachment) -> Void)? = nil
    @State private var copied = false
    @State private var copies = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(ReadAloud.self) private var readAloud
    private var reading: Bool { readAloud.speakingID == message.id }
    private var isUser: Bool { message.role == .user }
    private var failed: Bool { if case .error = message.status { true } else { false } }

    var body: some View {
        // Your messages sit in a bubble on the right; replies read as a page across the full width,
        // with their actions underneath once they finish (as in the AI apps people already know).
        VStack(alignment: isUser ? .trailing : .leading, spacing: 6) {
            if let files = message.attachments, !files.isEmpty {
                ForEach(files) { file in
                    Button { openAttachment?(file) } label: {
                        Label(file.name, systemImage: file.kind == .image ? "photo" : "doc")
                            .font(.footnote.weight(.medium))
                            .lineLimit(1)
                            .padding(.horizontal, 12)
                            .frame(minHeight: 44)
                            .background(LumenPalette.elevated, in: Capsule())
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("messageAttachment-" + file.id)
                }
            } else if let names = message.attachmentNames {
                ForEach(Array(names.enumerated()), id: \.offset) { _, name in
                    Label(name, systemImage: "doc").font(.footnote).foregroundStyle(.secondary)
                }
            }
            if isUser {
                if !message.content.isEmpty {
                    HStack(spacing: 0) {
                        Spacer(minLength: 56)
                        Text(message.content)
                            .font(.body)
                            .lineSpacing(2)
                            .textSelection(.enabled)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 11)
                            .background(LumenPalette.elevated, in: .rect(cornerRadius: LumenRadius.message, style: .continuous))
                    }
                }
            } else if message.content.isEmpty && message.status == .streaming {
                Image(systemName: "circle.fill")
                    .font(.caption)
                    .foregroundStyle(LumenPalette.ink)
                    .symbolEffect(.pulse, options: .repeating, isActive: !reduceMotion)
                    .frame(minHeight: 28)
                    .accessibilityLabel("Writing a reply")
            } else {
                // A reply's memory lines are hidden even while they are being written.
                MessageContent(text: message.status == .streaming ? MemoryRules.hidingLines(message.content) : message.content)
            }
            if case .error(let error) = message.status {
                Label(error, systemImage: "exclamationmark.circle").font(.footnote).foregroundStyle(.secondary)
            }
            if message.status == .stopped { Text("Stopped").font(.caption).foregroundStyle(.secondary) }
            if message.status != .streaming {
                if !isUser, let modelName {
                    // Which model answered, and why Auto chose it.
                    Text(message.route.map { modelName + " · " + $0 } ?? modelName)
                        .font(.caption)
                        .foregroundStyle(LumenPalette.muted)
                        .accessibilityLabel(message.route.map { "Answered by \(modelName): \($0)" } ?? "Answered by \(modelName)")
                        .accessibilityIdentifier("replyModel-" + message.id)
                }
                actions
            }
        }
        .frame(maxWidth: .infinity, alignment: isUser ? .trailing : .leading)
        .contextMenu {
            if !message.content.isEmpty {
                Button("Copy", systemImage: "doc.on.doc", action: copy)
                ShareLink(item: message.content)
                if message.role == .assistant {
                    Button(reading ? "Stop reading" : "Read aloud", systemImage: reading ? "stop.circle" : "speaker.wave.2", action: toggleReading)
                }
            }
            if canRevise {
                if isUser { Button("Edit and resend", systemImage: "pencil", action: edit) }
                else if message.role == .assistant { Button(failed ? "Try again" : "Regenerate", systemImage: "arrow.clockwise", action: regenerate) }
            }
        }
        .sensoryFeedback(.success, trigger: copies)
        .accessibilityIdentifier(message.role.rawValue + "Message")
    }

    private var actions: some View {
        HStack(spacing: 2) {
            if !message.content.isEmpty {
                Button(copied ? "Copied" : "Copy message", systemImage: copied ? "checkmark" : "doc.on.doc", action: copy)
                    .accessibilityIdentifier("copy-" + message.id)
            }
            if isUser {
                Button("Edit message", systemImage: "pencil", action: edit)
                    .disabled(!canRevise).accessibilityIdentifier("edit-" + message.id)
            } else if message.role == .assistant {
                Button(failed ? "Retry response" : "Regenerate response", systemImage: "arrow.clockwise", action: regenerate)
                    .disabled(!canRevise).accessibilityIdentifier("regenerate-" + message.id)
                if !message.content.isEmpty {
                    Button(reading ? "Stop reading" : "Read aloud", systemImage: reading ? "stop.circle" : "speaker.wave.2", action: toggleReading)
                        .symbolEffect(.variableColor.iterative, options: .repeating, isActive: reading && !reduceMotion)
                        .foregroundStyle(reading ? LumenPalette.accent : LumenPalette.muted)
                        .accessibilityIdentifier("readAloud-" + message.id)
                    ShareLink(item: message.content) { Label("Share message", systemImage: "square.and.arrow.up") }
                }
            }
        }
        .labelStyle(.iconOnly)
        .font(.subheadline)
        .foregroundStyle(LumenPalette.muted)
        .buttonStyle(MessageActionButtonStyle())
        .padding(.leading, isUser ? 0 : -12)
    }

    private func toggleReading() { readAloud.toggle(id: message.id, markdown: message.content) }

    private func copy() {
        UIPasteboard.general.string = message.content
        copied = true
        copies += 1
        Task { @MainActor in
            try? await Task.sleep(for: .seconds(2))
            copied = false
        }
    }
}

/// Quiet icon actions under a message, each with a full 44 pt target.
private struct MessageActionButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    @ScaledMetric(relativeTo: .subheadline) private var size: CGFloat = 44

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .frame(width: max(44, size), height: max(44, size))
            .contentShape(Rectangle())
            .opacity(isEnabled ? (configuration.isPressed ? 0.45 : 1) : 0.35)
    }
}

struct EditMessageSheet: View {
    let message: ChatMessage
    let send: (String) -> Bool
    @Environment(\.dismiss) private var dismiss
    @State private var text: String
    @State private var rejected = false
    init(message: ChatMessage, send: @escaping (String) -> Bool) {
        self.message = message; self.send = send
        _text = State(initialValue: message.content)
    }
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextEditor(text: $text).frame(minHeight: 150).accessibilityIdentifier("editedPrompt")
                } footer: { Text("A new version keeps this edit. Your original conversation remains available in Versions.") }
                if rejected { Text("The edit could not be saved. Check your model connection and available storage, then try again.").foregroundStyle(.red) }
            }
            .navigationTitle("Edit message")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Send") { if send(text) { dismiss() } else { rejected = true } }
                        .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                        .accessibilityIdentifier("sendEditedPrompt")
                }
            }
        }
    }
}
