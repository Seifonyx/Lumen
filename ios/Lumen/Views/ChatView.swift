import SwiftUI
import LumenCore

struct ChatView: View {
    @Bindable var composer: DraftState
    @Bindable var engine: ChatEngine
    @Bindable var connections: ProviderConnections
    @Bindable var sync: CloudChatSync
    var focused: FocusState<Bool>.Binding
    var chooseModel: () -> Void
    var selectVersion: (Conversation) -> Void
    @State private var followsReply = true
    @State private var editingMessage: ChatMessage?
    @State private var editingAccount = ""
    @State private var editingConversation = ""
    private var versions: [Conversation] { engine.versions(for: engine.currentConversation.id) }
    private var canRevise: Bool { !engine.isStreaming && engine.currentConversation.historyLoaded != false && connections.key(for: engine.selectedModel) != nil }
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
                        if versions.count > 1 {
                            Menu {
                                ForEach(Array(versions.enumerated()), id: \.element.id) { index, chat in
                                    Button("Version \(index + 1) · \(chat.revisionLabel ?? "Original")") { selectVersion(chat) }
                                        .accessibilityIdentifier("version-" + chat.id)
                                }
                            } label: {
                                Label("Version \((versions.firstIndex { $0.id == engine.currentConversation.id } ?? 0) + 1) of \(versions.count)", systemImage: "clock.arrow.circlepath")
                            }
                            .font(.caption).foregroundStyle(.secondary)
                            .disabled(engine.isStreaming)
                            .accessibilityIdentifier("conversationVersions")
                        }
                        if engine.currentConversation.historyLoaded == false {
                            HStack { ProgressView(); Text("Loading conversation…").foregroundStyle(.secondary) }
                        }
                        ForEach(engine.currentConversation.messages) { message in
                            MessageRow(message: message, canRevise: canRevise, edit: {
                                editingAccount = engine.accountID
                                editingConversation = engine.currentConversation.id
                                editingMessage = message
                            }, regenerate: {
                                guard let key = connections.key(for: engine.selectedModel) else { return }
                                _ = engine.regenerate(messageID: message.id, apiKey: key)
                            }).id(message.id)
                        }
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
        .sheet(item: $editingMessage) { message in
            EditMessageSheet(message: message) { text in
                guard engine.accountID == editingAccount, engine.currentConversation.id == editingConversation,
                      let key = connections.key(for: engine.selectedModel) else { return false }
                return engine.editAndResend(messageID: message.id, text: text, apiKey: key) != nil
            }
        }
        .onChange(of: engine.accountID) { _, _ in editingMessage = nil }
        .onChange(of: engine.currentConversation.id) { _, _ in editingMessage = nil }
    }
}
