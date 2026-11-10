import SwiftUI
import UIKit
import LumenCore

struct MessageRow: View {
    let message: ChatMessage
    let canRevise: Bool
    let edit: () -> Void
    let regenerate: () -> Void
    var openAttachment: ((ChatAttachment) -> Void)? = nil
    @State private var copied = false
    private var isUser: Bool { message.role == .user }
    private var failed: Bool { if case .error = message.status { true } else { false } }

    var body: some View {
        HStack(alignment: .top) {
            if isUser { Spacer(minLength: 40) }
            VStack(alignment: isUser ? .trailing : .leading, spacing: 10) {
                VStack(alignment: .leading, spacing: 10) {
                    if !isUser && message.role == .assistant {
                        HStack(spacing: 6) {
                            Image("LumenMark")
                                .resizable()
                                .scaledToFit()
                                .frame(width: 11, height: 16)
                                .accessibilityHidden(true)
                            Text("Lumen")
                                .font(LumenType.detail.weight(.semibold))
                                .foregroundStyle(LumenPalette.muted)
                        }
                    }
                    if let files = message.attachments, !files.isEmpty {
                        ForEach(files) { file in
                            Button { openAttachment?(file) } label: { Label(file.name, systemImage: file.kind == .image ? "photo" : "doc").font(.footnote) }
                                .frame(minHeight: 44).accessibilityIdentifier("messageAttachment-" + file.id)
                        }
                    } else if let names = message.attachmentNames {
                        ForEach(Array(names.enumerated()), id: \.offset) { _, name in Label(name, systemImage: "doc").font(.footnote).foregroundStyle(.secondary) }
                    }
                    if message.content.isEmpty && message.status == .streaming { ProgressView().accessibilityLabel("Writing a reply") }
                    else { MessageContent(text: message.content) }
                    if case .error(let error) = message.status { Label(error, systemImage: "exclamationmark.circle").font(.footnote).foregroundStyle(.secondary) }
                    if message.status == .stopped { Text("Stopped").font(.caption).foregroundStyle(.secondary) }
                }
                .padding(isUser ? 14 : 0)
                .background(isUser ? LumenPalette.elevated : .clear, in: .rect(cornerRadius: LumenRadius.message))
                if message.status != .streaming {
                    HStack(spacing: 18) {
                        if !message.content.isEmpty {
                            Button(copied ? "Copied" : "Copy message", systemImage: copied ? "checkmark" : "doc.on.doc", action: copy)
                                .frame(minWidth: 44, minHeight: 44)
                                .accessibilityIdentifier("copy-" + message.id)
                            ShareLink(item: message.content) { Label("Share message", systemImage: "square.and.arrow.up") }
                                .frame(minWidth: 44, minHeight: 44)
                        }
                        if isUser {
                            Button("Edit message", systemImage: "pencil", action: edit)
                                .frame(minWidth: 44, minHeight: 44).disabled(!canRevise).accessibilityIdentifier("edit-" + message.id)
                        } else if message.role == .assistant {
                            Button(failed ? "Retry response" : "Regenerate response", systemImage: "arrow.clockwise", action: regenerate)
                                .frame(minWidth: 44, minHeight: 44).disabled(!canRevise).accessibilityIdentifier("regenerate-" + message.id)
                        }
                    }
                    .labelStyle(.iconOnly)
                    .font(.system(size: 14))
                    .foregroundStyle(LumenPalette.muted)
                    .buttonStyle(.borderless)
                    .frame(minHeight: 44)
                    .padding(.horizontal, isUser ? 12 : 0)
                }
            }
            .frame(maxWidth: .infinity, alignment: isUser ? .trailing : .leading)
            .contextMenu {
                if !message.content.isEmpty {
                    Button("Copy", systemImage: "doc.on.doc", action: copy)
                    ShareLink(item: message.content)
                }
                if canRevise {
                    if isUser { Button("Edit and resend", systemImage: "pencil", action: edit) }
                    else if message.role == .assistant { Button(failed ? "Try again" : "Regenerate", systemImage: "arrow.clockwise", action: regenerate) }
                }
            }
            if !isUser { Spacer(minLength: 12) }
        }
        .accessibilityIdentifier(message.role.rawValue + "Message")
    }
    private func copy() {
        UIPasteboard.general.string = message.content
        copied = true
        Task { @MainActor in
            try? await Task.sleep(for: .seconds(2))
            copied = false
        }
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
