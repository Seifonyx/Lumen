import SwiftUI
import LumenCore

struct ChatView: View {
    @Bindable var composer: DraftState
    @Bindable var engine: ChatEngine
    @Bindable var connections: ProviderConnections
    @Bindable var sync: CloudChatSync
    var focused: FocusState<Bool>.Binding
    @Binding var handoff: ComposerRequest?
    @Environment(Dictation.self) private var dictation
    var chooseModel: () -> Void
    var selectVersion: (Conversation) -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var typeSize
    @State private var attachmentImporting = false
    @State private var olderAnchor: String?
    @State private var loadingOlder = false
    // Like the AI apps people know: sending puts your message at the top of the screen and the reply writes
    // itself below it, without the screen chasing the text. Once the reply is longer than the screen, you
    // scroll; "Latest" takes you to the end.
    @State private var pinnedID: String?
    @State private var viewportHeight: CGFloat = 0
    @State private var tailHeight: CGFloat = 0
    @State private var atBottom = true
    @State private var pinScrollPending = false
    @ScaledMetric(relativeTo: .body) private var sendSize: CGFloat = 34
    @State private var sends = 0
    @State private var memoryNoticeVisible = false
    @AppStorage("lumen.autoModel") private var autoModel = false
    private var connectedModels: [AIModel] { connections.models.filter { connections.key(for: $0) != nil } }
    private var hasModel: Bool { autoModel ? !connectedModels.isEmpty : connections.key(for: engine.selectedModel) != nil }
    @State private var stops = 0
    @State private var editingMessage: ChatMessage?
    @State private var previewAttachment: ChatAttachment?
    @State private var versionPickerOpen = false
    @State private var editingAccount = ""
    @State private var editingConversation = ""
    private var versions: [Conversation] { engine.versions(for: engine.currentConversation.id) }
    private var canRevise: Bool { !engine.hasOlderMessages(chatID: engine.currentConversation.id) && !engine.isStreaming && engine.currentConversation.historyLoaded != false && connections.key(for: engine.selectedModel) != nil }
    private var composerAligned: Bool {
        composer.accountID == engine.accountID && composer.conversationID == engine.currentConversation.id && composer.isTemporary == engine.isTemporary
    }
    private var canSend: Bool { composerAligned && !attachmentImporting && composer.hasContent && hasModel && engine.currentConversation.historyLoaded != false }
    private var messages: [ChatMessage] { engine.currentConversation.messages }
    private var pinIndex: Int? { pinnedID.flatMap { id in messages.firstIndex { $0.id == id } } }
    /// Room under the pinned exchange so your message can reach the top of the screen; none once the reply fills it.
    private var pinSpace: CGFloat {
        guard pinIndex != nil else { return 0 }
        return max(0, viewportHeight - tailHeight - 44)
    }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                if messages.isEmpty && engine.currentConversation.historyLoaded != false {
                    // At least the visible height (centred), and taller, scrolling, at large text sizes.
                    emptyState
                        .frame(minHeight: max(0, viewportHeight - 1))
                        .contentShape(Rectangle())
                        .onTapGesture { focused.wrappedValue = false }
                } else {
                    LazyVStack(alignment: .leading, spacing: 26) {
                        if engine.currentConversation.historyLoaded == false {
                            HStack { ProgressView(); Text("Loading conversation…").foregroundStyle(.secondary) }
                        }
                        ForEach(pinIndex.map { Array(messages[..<$0]) } ?? messages) { message in
                            row(message).id(message.id)
                        }
                        if let index = pinIndex {
                            VStack(alignment: .leading, spacing: 26) {
                                ForEach(Array(messages[index...])) { message in
                                    row(message).id(message.id)
                                }
                            }
                            .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { height in
                                tailHeight = height
                                // Once the room under the question is laid out, put the question at the top.
                                if pinScrollPending, let id = pinnedID {
                                    pinScrollPending = false
                                    Task { @MainActor in
                                        await Task.yield()
                                        withAnimation(reduceMotion ? nil : .smooth(duration: 0.35)) { proxy.scrollTo(id, anchor: .top) }
                                    }
                                }
                            }
                        }
                        // The end of the last message: "Latest" shows only while this is off screen.
                        Color.clear.frame(height: 1)
                            .onScrollVisibilityChange(threshold: 0.01) { visible in atBottom = visible }
                        Color.clear.frame(height: max(1, pinSpace)).id("conversationBottom")
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 14)
                    .padding(.bottom, 8)
                    .contentShape(Rectangle())
                    .simultaneousGesture(TapGesture().onEnded { focused.wrappedValue = false })
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .background(LumenPalette.canvas)
            .onScrollGeometryChange(for: CGFloat.self) { geometry in
                geometry.containerSize.height - geometry.contentInsets.top - geometry.contentInsets.bottom
            } action: { _, height in viewportHeight = height }
            .safeAreaInset(edge: .top, spacing: 0) { topBar }
            .overlay(alignment: .bottom) {
                if !atBottom && !messages.isEmpty {
                    Button {
                        withAnimation(reduceMotion ? nil : .smooth(duration: 0.3)) { proxy.scrollTo("conversationBottom", anchor: .bottom) }
                    } label: {
                        Image(systemName: "arrow.down")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(LumenPalette.ink)
                            .frame(width: sendSize + 6, height: sendSize + 6)
                            .glassEffect(.regular.interactive(), in: .circle)
                            .frame(minWidth: 44, minHeight: 44)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Latest")
                    .accessibilityHint("Scrolls to the end of the conversation")
                    .accessibilityIdentifier("scrollToLatest")
                    .padding(.bottom, 8)
                    .transition(.opacity.combined(with: .scale(scale: 0.85)))
                }
            }
            .animation(reduceMotion ? nil : .snappy(duration: 0.2), value: atBottom)
            .onAppear { scrollToEnd(proxy) }
            .onChange(of: messages.first?.id) { _, _ in
                if let anchor = olderAnchor { proxy.scrollTo(anchor, anchor: .top) }
                olderAnchor = nil; loadingOlder = false
            }
            .onChange(of: engine.currentConversation.id) { _, _ in
                dictation.stop()
                pinnedID = nil; pinScrollPending = false; olderAnchor = nil; loadingOlder = false; atBottom = true
                scrollToEnd(proxy)
            }
            .onChange(of: engine.isStreaming) { _, streaming in
                // Send, regenerate and edit all start a reply: put the question it answers at the top.
                guard streaming, let question = messages.last(where: { $0.role == .user }) else { return }
                pinnedID = question.id
                pinScrollPending = true
                Task { @MainActor in
                    try? await Task.sleep(for: .milliseconds(40))
                    withAnimation(reduceMotion ? nil : .smooth(duration: 0.35)) { proxy.scrollTo(question.id, anchor: .top) }
                }
            }
            .onChange(of: messages.count) { _, _ in
                // A conversation that opened or loaded its history starts at its end; a reply in progress stays put.
                guard !loadingOlder, pinnedID == nil, !engine.isStreaming else { return }
                scrollToEnd(proxy)
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            VStack(spacing: 8) {
                notices
                composerBar
            }
            .padding(.horizontal, 12)
            .padding(.top, 6)
            .padding(.bottom, 8)
        }
        .overlay(alignment: .top) {
            if memoryNoticeVisible {
                Label("Memory updated", systemImage: "brain.head.profile")
                    .font(.footnote.weight(.semibold))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .glassEffect(.regular, in: .capsule)
                    .padding(.top, 8)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .accessibilityIdentifier("memoryUpdated")
            }
        }
        .onChange(of: engine.memoryUpdates) { _, _ in
            withAnimation(reduceMotion ? nil : .snappy) { memoryNoticeVisible = true }
            Task { @MainActor in
                try? await Task.sleep(for: .seconds(3))
                withAnimation(reduceMotion ? nil : .snappy) { memoryNoticeVisible = false }
            }
        }
        .sensoryFeedback(.impact(weight: .light), trigger: sends)
        .sensoryFeedback(.impact(weight: .soft), trigger: dictation.changes)
        .onChange(of: handoff) { _, next in if next != nil { takeHandoff() } }
        .onAppear { takeHandoff() }
        .sensoryFeedback(.impact(weight: .medium), trigger: stops)
        .sheet(item: $editingMessage) { message in
            EditMessageSheet(message: message) { text in
                guard engine.accountID == editingAccount, engine.currentConversation.id == editingConversation,
                      let key = connections.key(for: engine.selectedModel) else { return false }
                return engine.editAndResend(messageID: message.id, text: text, apiKey: key) != nil
            }
        }
        .sheet(item: $previewAttachment) { AttachmentPreview(file: $0) }
        .sheet(isPresented: $versionPickerOpen) {
            NavigationStack {
                List {
                    ForEach(Array(versions.enumerated()), id: \.element.id) { index, chat in
                        Button {
                            versionPickerOpen = false
                            selectVersion(chat)
                        } label: {
                            HStack(spacing: 12) {
                                Label("Version \(index + 1) · \(chat.revisionLabel ?? "Original")", systemImage: "clock.arrow.circlepath")
                                    .font(LumenType.row)
                                Spacer()
                                if chat.id == engine.currentConversation.id {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(LumenPalette.accent)
                                        .accessibilityLabel("Selected version")
                                }
                            }
                            .frame(minHeight: 44)
                        }
                        .accessibilityIdentifier("version-" + chat.id)
                    }
                }
                .scrollContentBackground(.hidden)
                .background(LumenPalette.canvas)
                .navigationTitle("Versions")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") { versionPickerOpen = false }
                    }
                }
            }
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
        }
        .onChange(of: engine.accountID) { _, _ in
            editingMessage = nil; previewAttachment = nil; versionPickerOpen = false
        }
        .onChange(of: engine.currentConversation.id) { _, _ in
            editingMessage = nil; previewAttachment = nil
        }
    }

    private func row(_ message: ChatMessage) -> some View {
        MessageRow(message: message, canRevise: canRevise,
                   modelName: message.modelID.map { id in connections.models.first { $0.id == id }?.name ?? id }, edit: {
            editingAccount = engine.accountID
            editingConversation = engine.currentConversation.id
            editingMessage = message
        }, regenerate: {
            guard let key = connections.key(for: engine.selectedModel) else { return }
            _ = engine.regenerate(messageID: message.id, apiKey: key)
        }, openAttachment: { file in
            if file.kind == .text { previewAttachment = file }
            else { do { previewAttachment = try engine.attachment(id: file.id) } catch { engine.errorMessage = error.localizedDescription } }
        })
    }

    private func scrollToEnd(_ proxy: ScrollViewProxy) {
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(30))
            proxy.scrollTo("conversationBottom", anchor: .bottom)
        }
    }

    private var emptyState: some View {
        VStack(spacing: 14) {
            Image("LumenMark")
                .resizable().scaledToFit().frame(width: 30, height: 42)
                .accessibilityHidden(true)
            Text("How can I help?")
                .font(.system(.title2, design: .default, weight: .semibold))
                .foregroundStyle(LumenPalette.ink)
            if !hasModel {
                Text("Connect a provider in Settings › Router, then choose a model.")
                    .font(.subheadline)
                    .foregroundStyle(LumenPalette.muted)
                Button("Choose a model", action: chooseModel)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(LumenPalette.accent)
                    .frame(minHeight: 44)
                    .accessibilityIdentifier("emptyChooseModel")
            }
        }
        .multilineTextAlignment(.center)
        .padding(32)
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder private var topBar: some View {
        let older = engine.currentConversation.historyLoaded == true && engine.hasOlderMessages(chatID: engine.currentConversation.id)
        if versions.count > 1 || older {
            HStack(spacing: 12) {
                if older {
                    Button("Load earlier messages") {
                        loadingOlder = true; olderAnchor = messages.first?.id
                        Task { await sync.loadMessages(chatID: engine.currentConversation.id, older: true) }
                    }
                    .disabled(engine.isStreaming || sync.isLoadingMessages(chatID: engine.currentConversation.id))
                    .accessibilityIdentifier("loadEarlierMessages")
                    if sync.isLoadingMessages(chatID: engine.currentConversation.id) { ProgressView() }
                    Text("\(messages.count) of \(engine.currentConversation.remoteMessageIDs?.count ?? 0)")
                        .foregroundStyle(.secondary).accessibilityIdentifier("loadedMessageCount")
                }
                Spacer(minLength: 0)
                if versions.count > 1 {
                    Button {
                        versionPickerOpen = true
                    } label: {
                        Label("Version \((versions.firstIndex { $0.id == engine.currentConversation.id } ?? 0) + 1) of \(versions.count)", systemImage: "clock.arrow.circlepath")
                            .foregroundStyle(LumenPalette.ink)
                            .padding(.horizontal, 12)
                            .frame(minHeight: 34)
                            .glassEffect(.regular.interactive(), in: .capsule)
                            .frame(minHeight: 44)
                    }
                    .buttonStyle(.plain)
                    .disabled(engine.isStreaming)
                    .accessibilityIdentifier("conversationVersions")
                }
            }
            .font(.caption.weight(.medium))
            .padding(.horizontal, 16)
        }
    }

    @ViewBuilder private var notices: some View {
        if engine.contextOmittedMessageCount > 0 {
            Text("Reply context uses recent messages. Earlier messages stay in your history.")
                .font(.caption2).foregroundStyle(.secondary).accessibilityIdentifier("boundedContextNotice")
        }
        if engine.contextOmittedAttachmentCount > 0 {
            Text("\(engine.contextOmittedAttachmentCount) earlier file(s) unavailable or unsupported on this iPhone were omitted from the last reply. Message text was kept.")
                .font(.caption2).foregroundStyle(.secondary).accessibilityIdentifier("historicalAttachmentsOmittedNotice")
        }
        if engine.isTemporary {
            VStack(spacing: 2) {
                Label("Temporary · Not saved to history", systemImage: "eye.slash")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(LumenPalette.ink)
                    .accessibilityIdentifier("temporaryChatIndicator")
                Text("Your AI provider still receives these messages.").font(.caption2).foregroundStyle(.secondary)
            }
        }
        if let error = dictation.errorMessage {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: "mic.slash").accessibilityHidden(true)
                Text(error).font(.footnote).frame(maxWidth: .infinity, alignment: .leading)
                Button("Dismiss", systemImage: "xmark") { dictation.errorMessage = nil }
                    .labelStyle(.iconOnly).frame(minWidth: 44, minHeight: 44)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .glassEffect(.regular, in: .rect(cornerRadius: LumenRadius.card, style: .continuous))
            .accessibilityIdentifier("dictationError")
        }
        if let error = composer.errorMessage ?? engine.errorMessage ?? sync.errorMessage {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: "exclamationmark.circle").accessibilityHidden(true)
                Text(error).font(.footnote).frame(maxWidth: .infinity, alignment: .leading)
                if composer.errorMessage != nil { Button("Retry") { _ = composer.save() }.font(.footnote.weight(.semibold)) }
                else if sync.errorMessage != nil { Button("Retry") { sync.retry() }.font(.footnote.weight(.semibold)) }
                else { Button("Dismiss", systemImage: "xmark") { engine.errorMessage = nil }.labelStyle(.iconOnly).frame(minWidth: 44, minHeight: 44) }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .glassEffect(.regular, in: .rect(cornerRadius: LumenRadius.card, style: .continuous))
            .accessibilityIdentifier("chatError")
        }
    }

    private var composerBar: some View {
        // One Liquid Glass control: + for photos and files, the message, and Send (Stop while a reply is written).
        ComposerAttachments(composer: composer, engine: engine, importing: $attachmentImporting) {
            TextField(dictation.state == .listening ? "Listening�" : "Message Lumen", text: Binding(get: { composerAligned ? composer.draft : "" }, set: { if composerAligned { composer.draft = $0 } }), axis: .vertical)
                .disabled(!composerAligned)
                // At accessibility text sizes a few lines already fill the screen: the bar stops growing
                // at three and scrolls inside, so the conversation stays visible.
                .lineLimit(typeSize.isAccessibilitySize ? 1...3 : 1...8)
                .font(.body)
                .focused(focused)
                .padding(.vertical, 11)
                .accessibilityLabel("Message Lumen")
                .accessibilityIdentifier("messageComposer")
                .frame(minHeight: 44)
                .frame(maxWidth: .infinity, alignment: .leading)
                .layoutPriority(1)
            // As in the AI apps people know: the microphone while the message is empty (or you're talking),
            // and Send once there's something to send. This also keeps the message wide at large text sizes.
            if !engine.isStreaming && (composer.draft.isEmpty || dictation.isActive) { microphone }
            if engine.isStreaming {
                Button {
                    stops += 1
                    engine.stopStreaming()
                } label: {
                    Image(systemName: "stop.fill")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(LumenPalette.canvas)
                        .frame(width: sendSize, height: sendSize)
                        .background(LumenPalette.ink, in: Circle())
                        .frame(minWidth: 44, minHeight: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Stop")
                .accessibilityIdentifier("stopStreaming")
            } else {
                Button(action: send) {
                    Image(systemName: "arrow.up")
                        .font(.callout.weight(.semibold))
                        .foregroundStyle(canSend ? LumenPalette.canvas : LumenPalette.muted)
                        .frame(width: sendSize, height: sendSize)
                        .background(canSend ? LumenPalette.ink : LumenPalette.elevated, in: Circle())
                        .frame(minWidth: 44, minHeight: 44)
                }
                .buttonStyle(.plain)
                .disabled(!canSend)
                .keyboardShortcut(.return, modifiers: .command)
                .accessibilityLabel("Send")
                .accessibilityHint(canSend ? "Send message" : "Choose a connected model before sending.")
                .accessibilityIdentifier("sendMessage")
            }
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 4)
        .glassEffect(.regular.interactive(), in: .rect(cornerRadius: 26, style: .continuous))
    }

    /// Tap to talk instead of typing; tap again to stop. The words appear in the message as you speak.
    private var microphone: some View {
        let listening = dictation.isActive
        return Button {
            if listening { dictation.stop() } else { startDictation() }
        } label: {
            Image(systemName: listening ? "waveform" : "mic")
                .font(.body.weight(listening ? .semibold : .regular))
                .foregroundStyle(listening ? LumenPalette.canvas : LumenPalette.muted)
                .symbolEffect(.variableColor.iterative, options: .repeating, isActive: listening && !reduceMotion)
                .frame(width: sendSize, height: sendSize)
                .background(listening ? LumenPalette.accent : .clear, in: Circle())
                .frame(minWidth: 44, minHeight: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!composerAligned)
        .accessibilityLabel(listening ? "Stop dictation" : "Dictate")
        .accessibilityHint(listening ? "Keeps what you said in the message" : "Say your message instead of typing it")
        .accessibilityIdentifier("dictate")
    }

    private func startDictation() {
        guard composerAligned else { return }
        let base = composer.draft, account = composer.accountID, chat = composer.conversationID
        let draft = self.composer
        dictation.start { words in
            // Only into the chat it started in: switching chats or accounts stops listening.
            guard draft.accountID == account, draft.conversationID == chat else { return }
            draft.draft = DictationText.merge(draft: base, dictated: words)
        }
    }

    /// Siri, a Shortcut or a link: put its message in the new chat, then send it, listen, or wait for typing.
    private func takeHandoff() {
        guard let next = handoff, composerAligned else { return }
        handoff = nil
        if let text = next.text { composer.draft = DictationText.merge(draft: composer.draft, dictated: text) }
        if next.send && canSend { send() }
        else if next.dictate { startDictation() }
        else { focused.wrappedValue = true }
    }

    private func send() {
        dictation.stop()
        guard composerAligned, composer.save() else { return }
        if autoModel {
            // Auto: the best connected model for this message, with the next ones as fallbacks, as on the web.
            let hasImage = composer.attachmentIDs.contains { (try? engine.attachment(id: $0))?.kind == .image }
            let size = engine.currentConversation.messages.reduce(0) { $0 + $1.content.count }
            let previous = engine.currentConversation.messages.last { $0.role == .assistant }?.modelID
            guard let plan = AutoRouter.plan(text: composer.draft, hasImage: hasImage, conversationCharacters: size,
                                             models: connectedModels, previousModelID: previous),
                  let key = connections.key(for: plan.model) else {
                engine.errorMessage = hasImage ? "None of your connected models can read photos. Connect one that can, or choose a model."
                                               : "Connect a provider in Settings › Router first."
                return
            }
            engine.selectModel(plan.model)
            let fallbacks = plan.fallbacks.compactMap { model in connections.key(for: model).map { ReplyAttempt(model: model, apiKey: $0) } }
            guard engine.submit(prompt: composer.draft, attachmentIDs: composer.attachmentIDs, apiKey: key,
                                fallbacks: fallbacks, route: plan.reason) != nil else { return }
        } else {
            guard let key = connections.key(for: engine.selectedModel),
                  engine.submit(prompt: composer.draft, attachmentIDs: composer.attachmentIDs, apiKey: key) != nil else { return }
        }
        sends += 1
        composer.discardDraft()
    }
}
