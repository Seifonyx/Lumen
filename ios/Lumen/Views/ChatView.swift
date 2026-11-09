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
    @State private var attachmentImporting = false
    @State private var olderAnchor: String?
    @State private var followsReply = true
    @State private var editingMessage: ChatMessage?
    @State private var previewAttachment: ChatAttachment?
    @State private var editingAccount = ""
    @State private var editingConversation = ""
    private var versions: [Conversation] { engine.versions(for: engine.currentConversation.id) }
    private var canRevise: Bool { !engine.hasOlderMessages(chatID: engine.currentConversation.id) && !engine.isStreaming && engine.currentConversation.historyLoaded != false && connections.key(for: engine.selectedModel) != nil }
    private var composerAligned: Bool {
        composer.accountID == engine.accountID && composer.conversationID == engine.currentConversation.id && composer.isTemporary == engine.isTemporary
    }
    private var canSend: Bool { composerAligned && !attachmentImporting && composer.hasContent && connections.key(for: engine.selectedModel) != nil && engine.currentConversation.historyLoaded != false }

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
                            }, openAttachment: { file in
                                if file.kind == .text { previewAttachment = file }
                                else { do { previewAttachment = try engine.attachment(id: file.id) } catch { engine.errorMessage = error.localizedDescription } }
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
            .safeAreaInset(edge: .top, spacing: 0) {
                if engine.hasOlderMessages(chatID: engine.currentConversation.id) {
                    HStack {
                        Button("Load earlier messages") {
                            followsReply = false; olderAnchor = engine.currentConversation.messages.first?.id
                            Task { await sync.loadMessages(chatID: engine.currentConversation.id, older: true) }
                        }.disabled(engine.isStreaming || sync.isLoadingMessages(chatID: engine.currentConversation.id))
                            .accessibilityIdentifier("loadEarlierMessages")
                        Spacer()
                        if sync.isLoadingMessages(chatID: engine.currentConversation.id) { ProgressView() }
                        Text("\(engine.currentConversation.messages.count) of \(engine.currentConversation.remoteMessageIDs?.count ?? 0)")
                            .foregroundStyle(.secondary).accessibilityIdentifier("loadedMessageCount")
                    }.font(.caption).padding(.horizontal, 20).padding(.vertical, 10).background(.bar)
                }
            }
            .overlay(alignment: .bottomTrailing) {
                if !followsReply {
                    Button("Latest", systemImage: "arrow.down") { followsReply = true; proxy.scrollTo("conversationBottom", anchor: .bottom) }
                        .padding(10).glassEffect(.regular, in: .capsule).padding(12).accessibilityIdentifier("scrollToLatest")
                }
            }
            .onChange(of: engine.currentConversation.messages.first?.id) { _, _ in
                if let anchor = olderAnchor { proxy.scrollTo(anchor, anchor: .top); olderAnchor = nil }
            }
            .onChange(of: engine.currentConversation.id) { _, _ in followsReply = true; olderAnchor = nil }
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
                if engine.contextOmittedMessageCount > 0 {
                    Text("Reply context uses recent messages. Earlier messages stay in your history.")
                        .font(.caption2).foregroundStyle(.secondary).accessibilityIdentifier("boundedContextNotice")
                }
                if engine.isTemporary {
                    Label("Temporary · Not saved to history", systemImage: "eye.slash")
                        .font(.footnote).foregroundStyle(.secondary).accessibilityIdentifier("temporaryChatIndicator")
                    Text("Your AI provider still receives these messages.").font(.caption2).foregroundStyle(.secondary)
                }
                if let error = composer.errorMessage ?? engine.errorMessage ?? sync.errorMessage {
                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: "exclamationmark.circle")
                        Text(error).font(.footnote).frame(maxWidth: .infinity, alignment: .leading)
                        if composer.errorMessage != nil { Button("Retry") { _ = composer.save() }.font(.footnote.weight(.semibold)) }
                        else if sync.errorMessage != nil { Button("Retry") { sync.retry() }.font(.footnote.weight(.semibold)) }
                        else { Button("Dismiss", systemImage: "xmark") { engine.errorMessage = nil }.labelStyle(.iconOnly) }
                    }
                    .padding(12)
                    .background(Color(uiColor: .secondarySystemBackground), in: .rect(cornerRadius: 14))
                    .accessibilityIdentifier("chatError")
                }
                VStack(alignment: .leading, spacing: 12) {
                    ComposerAttachments(composer: composer, engine: engine, importing: $attachmentImporting)
                    TextField("Message Lumen", text: Binding(get: { composerAligned ? composer.draft : "" }, set: { if composerAligned { composer.draft = $0 } }), axis: .vertical)
                        .disabled(!composerAligned)
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
                                guard composerAligned, composer.save(), let key = connections.key(for: engine.selectedModel), engine.submit(prompt: composer.draft, attachmentIDs: composer.attachmentIDs, apiKey: key) != nil else { return }
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
        .sheet(item: $previewAttachment) { AttachmentPreview(file: $0) }
        .onChange(of: engine.accountID) { _, _ in editingMessage = nil; previewAttachment = nil }
        .onChange(of: engine.currentConversation.id) { _, _ in editingMessage = nil; previewAttachment = nil }
    }
}
