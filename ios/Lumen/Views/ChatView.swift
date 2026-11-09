import SwiftUI
import LumenCore

struct ChatView: View {
    @Bindable var composer: DraftState
    @Bindable var engine: ChatEngine
    @Bindable var connections: ProviderConnections
    @Bindable var sync: CloudChatSync
    var focused: FocusState<Bool>.Binding
    var chooseModel: () -> Void
    @State private var followsReply = true
    private var canSend: Bool { composer.hasContent && connections.key(for: engine.selectedModel) != nil && engine.currentConversation.historyLoaded != false }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                if engine.currentConversation.messages.isEmpty && engine.currentConversation.historyLoaded != false {
                    VStack(spacing: 18) {
                        Image("LumenMark").resizable().scaledToFit().frame(width: 44, height: 62).accessibilityHidden(true)
                        Text("Start a conversation").font(.title2.weight(.semibold))
                        Text(connections.key(for: engine.selectedModel) != nil ? "Ready with \(engine.selectedModel?.name ?? "your model")" : "Choose a connected model to begin.")
                            .foregroundStyle(.secondary)
                    }
                    .multilineTextAlignment(.center)
                    .padding(32)
                    .frame(maxWidth: .infinity)
                    .containerRelativeFrame(.vertical)
                } else {
                    LazyVStack(alignment: .leading, spacing: 24) {
                        if engine.currentConversation.historyLoaded == false {
                            HStack { ProgressView(); Text("Loading conversation…").foregroundStyle(.secondary) }
                        }
                        ForEach(engine.currentConversation.messages) { message in MessageRow(message: message).id(message.id) }
                        Color.clear.frame(height: 1).id("conversationBottom")
                    }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 18)
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .background(Color(uiColor: .systemBackground))
            .onScrollGeometryChange(for: Bool.self) { geometry in
                geometry.contentSize.height - geometry.contentOffset.y - geometry.containerSize.height < 140
            } action: { _, nearBottom in followsReply = nearBottom }
            .onChange(of: engine.currentConversation.id) { _, _ in followsReply = true }
            .onChange(of: engine.currentConversation.messages.count) { _, _ in
                if engine.currentConversation.messages.last?.role == .user || engine.isStreaming { followsReply = true }
                if followsReply { proxy.scrollTo("conversationBottom", anchor: .bottom) }
            }
            .onChange(of: engine.currentConversation.messages.last?.content) { _, _ in
                if followsReply { proxy.scrollTo("conversationBottom", anchor: .bottom) }
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            VStack(spacing: 10) {
                if let error = engine.errorMessage ?? sync.errorMessage {
                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: "exclamationmark.circle")
                        Text(error).font(.footnote).frame(maxWidth: .infinity, alignment: .leading)
                        if sync.errorMessage != nil { Button("Retry") { sync.retry() }.font(.footnote.weight(.semibold)) }
                        else { Button("Dismiss", systemImage: "xmark") { engine.errorMessage = nil }.labelStyle(.iconOnly) }
                    }
                    .padding(12)
                    .background(Color(uiColor: .secondarySystemBackground), in: .rect(cornerRadius: 14))
                    .accessibilityIdentifier("chatError")
                }
                VStack(alignment: .leading, spacing: 12) {
                    TextField("Message Lumen", text: $composer.draft, axis: .vertical)
                        .lineLimit(1...6)
                        .font(.body)
                        .focused(focused)
                        .accessibilityLabel("Message Lumen")
                        .accessibilityIdentifier("messageComposer")
                        .padding(.horizontal, 4)
                    HStack {
                        Button(action: chooseModel) {
                            HStack(spacing: 6) {
                                Image(systemName: "cpu")
                                Text(engine.selectedModel?.name ?? "Choose model").lineLimit(1)
                                Image(systemName: "chevron.down").font(.caption2.weight(.semibold))
                            }
                            .font(.subheadline.weight(.medium))
                            .padding(.vertical, 7)
                            .frame(minHeight: 44)
                        }
                        .accessibilityIdentifier("chooseModel")
                        Spacer(minLength: 12)
                        if engine.isStreaming {
                            Button("Stop", systemImage: "stop.circle.fill") { engine.stopStreaming() }
                                .font(.system(size: 34)).labelStyle(.iconOnly)
                                .frame(minWidth: 44, minHeight: 44)
                                .accessibilityIdentifier("stopStreaming")
                        } else {
                            Button("Send", systemImage: "arrow.up.circle.fill") {
                                guard let key = connections.key(for: engine.selectedModel), engine.submit(prompt: composer.draft, apiKey: key) != nil else { return }
                                composer.discardDraft()
                            }
                            .font(.system(size: 34)).labelStyle(.iconOnly)
                            .frame(minWidth: 44, minHeight: 44)
                            .disabled(!canSend)
                            .accessibilityHint(canSend ? "Send message" : "Choose a connected model before sending.")
                            .accessibilityIdentifier("sendMessage")
                        }
                    }
                }
                .padding(16)
                .glassEffect(.regular, in: .rect(cornerRadius: 26))
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
        }
    }
}

private struct MessageRow: View {
    let message: ChatMessage
    var body: some View {
        HStack(alignment: .top) {
            if message.role == .user { Spacer(minLength: 40) }
            VStack(alignment: .leading, spacing: 10) {
                if let names = message.attachmentNames {
                    ForEach(Array(names.enumerated()), id: \.offset) { _, name in Label(name, systemImage: "doc").font(.footnote).foregroundStyle(.secondary) }
                }
                if message.content.isEmpty && message.status == .streaming { ProgressView().accessibilityLabel("Writing a reply") }
                else { MessageContent(text: message.content) }
                if case .error(let error) = message.status { Label(error, systemImage: "exclamationmark.circle").font(.footnote).foregroundStyle(.secondary) }
                if message.status == .stopped { Text("Stopped").font(.caption).foregroundStyle(.secondary) }
            }
            .padding(message.role == .user ? 14 : 0)
            .background(message.role == .user ? Color(uiColor: .secondarySystemBackground) : .clear, in: .rect(cornerRadius: 20))
            .frame(maxWidth: .infinity, alignment: message.role == .user ? .trailing : .leading)
            if message.role != .user { Spacer(minLength: 12) }
        }
        .accessibilityIdentifier(message.role.rawValue + "Message")
    }
}

private struct MessageContent: View {
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
