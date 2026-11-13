import SwiftUI
import LumenCore

struct RootView: View {
    @Bindable var composer: DraftState
    @Bindable var engine: ChatEngine
    @Bindable var auth: AuthEngine
    @Bindable var connections: ProviderConnections
    @Bindable var sync: CloudChatSync
    @State private var path: [WorkspaceRoute] = []
    // The sidebar sits under the chat, which slides right to reveal it and follows your finger both ways
    // (as in the AI apps people know). sidebarOpen is the settled state; sidebarProgress (0…1) is where it is.
    @State private var sidebarOpen = false
    @State private var sidebarMounted = false
    @State private var sidebarProgress: CGFloat = 0
    @State private var dragStart: CGFloat?
    @State private var dragDecided = false
    @GestureState private var dragging = false
    @State private var settingsOpen = false
    @State private var modelsOpen = false
    @State private var discardConfirmation = false
    private struct Inventory: Equatable { let account: String; let ids: Set<String> }
    private var inventory: Inventory { Inventory(account: engine.accountID, ids: Set(engine.savedConversations.map(\.id))) }
    private enum Destination { case new, temporary, conversation(Conversation), draft(String), newInProject(String), compose(ComposerRequest) }
    @Environment(LumenRequests.self) private var requests
    @Environment(Dictation.self) private var dictation
    @Environment(ReadAloud.self) private var readAloud
    /// Siri, a Shortcut or a link's message, handed to the new chat's composer.
    @State private var handoff: ComposerRequest?
    @State private var openProjectID: String?
    @State private var projectEditor: ProjectEditorTarget?
    @AppStorage("lumen.autoModel") private var autoModel = false
    @State private var pendingDestination: Destination?
    @FocusState private var composerFocused: Bool
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        GeometryReader { geometry in
            let width = min(geometry.size.width * 0.82, 340)
            ZStack(alignment: .leading) {
                if sidebarMounted {
                    SidebarView(
                        engine: engine,
                        composer: composer,
                        auth: auth,
                        newChat: requestNewChat,
                        search: {
                            setSidebar(false)
                            path.append(.search)
                        },
                        openDraft: { request(.draft($0)) },
                        open: { route in
                            setSidebar(false)
                            path.append(route)
                        },
                        selectConversation: requestOpenConversation,
                        settings: {
                            setSidebar(false)
                            settingsOpen = true
                        },
                        close: { setSidebar(false) },
                        projects: sync.projects,
                        signedIn: auth.currentUser != nil,
                        openProject: { id in
                            setSidebar(false)
                            path.removeAll()
                            openProjectID = id
                        },
                        newProject: { projectEditor = .new() }
                    )
                    .frame(width: width)
                    .frame(maxHeight: .infinity)
                    .background(LumenPalette.canvas)
                    // A little parallax, so the sidebar seems to sit beneath the chat.
                    .offset(x: -width * 0.3 * (1 - sidebarProgress))
                    .allowsHitTesting(sidebarOpen)
                    .accessibilityHidden(!sidebarOpen)
                    .accessibilityIdentifier("sidebarPanel")
                }
                NavigationStack(path: $path) {
                    ChatView(
                        composer: composer,
                        engine: engine,
                        connections: connections,
                        sync: sync,
                        focused: $composerFocused,
                        handoff: $handoff,
                        chooseModel: { modelsOpen = true },
                        selectVersion: requestOpenConversation
                    )
                    .navigationTitle(engine.isTemporary ? "Temporary chat" : engine.currentConversation.messages.isEmpty ? "Lumen" : engine.currentConversation.title)
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .topBarLeading) {
                            Button("Open sidebar", systemImage: "sidebar.left") { setSidebar(true) }
                            .accessibilityIdentifier("openSidebar")
                        }
                        ToolbarItemGroup(placement: .topBarTrailing) {
                            Button(engine.isTemporary ? "Leave temporary chat" : "Temporary chat", systemImage: "eye.slash") {
                                if engine.isTemporary { requestNewChat() }
                                else { request(.temporary) }
                            }
                            .tint(engine.isTemporary ? LumenPalette.accent : LumenPalette.muted)
                            .accessibilityIdentifier("newTemporaryChat")
                            .accessibilityHint("Temporary chats are not added to your conversation history.")
                            Button("New chat", systemImage: "square.and.pencil", action: requestNewChat)
                                .accessibilityIdentifier("newChat")
                                .keyboardShortcut("n", modifiers: .command)
                        }
                        ToolbarItem(placement: .principal) {
                            // The model you're talking to, as in the AI apps people know: tap to change it.
                            Button { modelsOpen = true } label: {
                                HStack(spacing: 4) {
                                    Text(modelTitle)
                                        .font(.headline)
                                        .foregroundStyle(LumenPalette.ink)
                                        .lineLimit(1)
                                        .accessibilityIdentifier("compactModelLabel")
                                    Image(systemName: "chevron.down")
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(LumenPalette.muted)
                                }
                                .frame(minHeight: 44)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .accessibilityShowsLargeContentViewer {
                                Label(modelTitle, systemImage: "cpu")
                            }
                            .accessibilityLabel("Model: " + (autoModel ? "Auto" : engine.selectedModel?.name ?? "Not selected"))
                            .accessibilityHint("Opens the complete model list with full model names.")
                            .accessibilityIdentifier("chooseModel")
                        }
                    }
                    .navigationDestination(item: $openProjectID) { id in
                        ProjectView(projectID: id, engine: engine, sync: sync,
                                    newChat: { request(.newInProject($0)) },
                                    openChat: requestOpenConversation,
                                    edit: { projectEditor = .edit($0) })
                    }
                    .navigationDestination(for: WorkspaceRoute.self) { route in
                        switch route {
                        case .router: ProvidersView(connections: connections, sync: sync)
                        case .search, .archive: HistorySearchView(engine: engine, initialScope: route == .archive ? .archived : .active, select: requestOpenConversation)
                        case .library:
                            LibraryView(engine: engine) { id in
                                if let chat = engine.savedConversations.first(where: { $0.id == id }) { requestOpenConversation(chat) }
                            }
                        }
                    }
                }
                .allowsHitTesting(!sidebarOpen)
                .accessibilityHidden(sidebarOpen)
                .background(LumenPalette.canvas)
                .shadow(color: .black.opacity(0.16 * sidebarProgress), radius: 18)
                .offset(x: width * sidebarProgress)

                if sidebarMounted {
                    // The visible part of the chat dims, and tapping it closes the sidebar.
                    Button { setSidebar(false) } label: {
                        Rectangle()
                            .fill(.black.opacity(0.22 * sidebarProgress))
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .frame(width: max(0, geometry.size.width - width * sidebarProgress))
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .trailing)
                    .ignoresSafeArea()
                    .allowsHitTesting(sidebarOpen)
                    .accessibilityLabel("Close sidebar")
                    .accessibilityIdentifier("closeSidebar")
                }
            }
            .simultaneousGesture(sidebarDrag(width: width), isEnabled: path.isEmpty || sidebarOpen)
            .onChange(of: dragging) { _, active in
                // A drag the system took over (a scroll, a sheet) never ends normally: settle where it is.
                guard !active else { return }
                Task { @MainActor in
                    await Task.yield() // a drag that ended normally has settled in onEnded by now
                    guard dragStart != nil else { return }
                    dragStart = nil; dragDecided = false
                    setSidebar(sidebarProgress > 0.5)
                }
            }
            .sensoryFeedback(.impact(weight: .light), trigger: sidebarOpen)
        }
        .background(LumenPalette.canvas.ignoresSafeArea())
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { sync.retry() }
            else if phase == .background { dictation.stop(); readAloud.stop(); engine.stopStreaming(); _ = composer.save(); _ = engine.checkpoint() }
        }
        .onChange(of: engine.isStreaming) { _, streaming in
            if !streaming, engine.currentConversation.historyLoaded == false { Task { await sync.loadMessages(chatID: engine.currentConversation.id) } }
        }
        .sheet(isPresented: $settingsOpen) {
            SettingsView(composer: composer, engine: engine, auth: auth, connections: connections, sync: sync,
                         openConversation: { chat in
                             settingsOpen = false
                             requestOpenConversation(chat)
                         })
        }
        .sheet(isPresented: $modelsOpen) { ModelSheet(engine: engine, connections: connections, sync: sync) }
        .sheet(item: $projectEditor) { target in
            ProjectEditorSheet(target: target, sync: sync) { id in
                setSidebar(false)
                path.removeAll()
                openProjectID = id
            }
        }
        .sensoryFeedback(.selection, trigger: engine.selectedModel?.id)
        .onAppear { _ = engine.checkpoint(); restoreComposer(); cleanupAttachments(); takeRequest() }
        .onChange(of: requests.pending) { _, _ in takeRequest() }
        .onChange(of: auth.hasRestored) { _, _ in takeRequest() }
        .onChange(of: inventory) { old, new in
            guard old.account == new.account, composer.accountID == new.account else { return }
            let removed = old.ids.subtracting(new.ids)
            if !removed.isEmpty, !composer.removeDrafts(conversationIDs: removed) { return }
            cleanupAttachments()
        }
        .onChange(of: composer.attachmentIDs) { _, _ in cleanupAttachments() }
        .onChange(of: engine.currentConversation.id) { _, _ in restoreComposer() }
        .onChange(of: engine.accountID) { _, _ in pendingDestination = nil; discardConfirmation = false; openProjectID = nil; projectEditor = nil; handoff = nil; restoreComposer(); takeRequest() }
        .onChange(of: engine.currentConversation.id) { _, _ in readAloud.stop() }
        .alert("Leave temporary chat?", isPresented: $discardConfirmation) {
            Button("Leave and clear", role: .destructive) {
                if let destination = pendingDestination { perform(destination) }
                pendingDestination = nil
            }
            Button("Cancel", role: .cancel) { pendingDestination = nil }
        } message: { Text("This temporary conversation and its drafts will be cleared from this iPhone.") }
    }

    /// The provider's familiar name for the chosen model; the full model name is in the list and read by VoiceOver.
    private var modelTitle: String {
        if autoModel { return "Auto" }
        guard let model = engine.selectedModel else { return "Choose model" }
        switch model.providerId.lowercased() {
        case "gemini": return "Gemini"
        case "anthropic": return "Claude"
        case "openai": return "OpenAI"
        case "groq": return "Groq"
        default: return model.name
        }
    }

    private func setSidebar(_ open: Bool) {
        if open { composerFocused = false; sidebarMounted = true }
        let animation: Animation? = reduceMotion ? nil : .interactiveSpring(response: 0.36, dampingFraction: 0.86)
        withAnimation(animation, completionCriteria: .logicallyComplete) {
            sidebarOpen = open
            sidebarProgress = open ? 1 : 0
        } completion: {
            if !sidebarOpen { sidebarMounted = false }
        }
    }

    /// A horizontal drag anywhere: right opens the sidebar, left closes it, following the finger; vertical
    /// drags are left to the scroll views. Where it lets go (and how fast) decides open or closed.
    private func sidebarDrag(width: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 10)
            .updating($dragging) { _, active, _ in active = true }
            .onChanged { gesture in
                let dx = gesture.translation.width, dy = gesture.translation.height
                if !dragDecided {
                    guard max(abs(dx), abs(dy)) >= 10 else { return }
                    dragDecided = true
                    let horizontal = abs(dx) > abs(dy) * 1.4
                    guard horizontal, (sidebarOpen && dx < 0) || (!sidebarOpen && dx > 0 && path.isEmpty) else { return }
                    dragStart = sidebarProgress
                    composerFocused = false
                    var instant = Transaction(); instant.disablesAnimations = true
                    withTransaction(instant) { sidebarMounted = true }
                }
                guard let start = dragStart else { return }
                var instant = Transaction(); instant.disablesAnimations = true
                withTransaction(instant) { sidebarProgress = min(1, max(0, start + dx / max(width, 1))) }
            }
            .onEnded { gesture in
                defer { dragStart = nil; dragDecided = false }
                guard let start = dragStart else { return }
                let projected = start + gesture.predictedEndTranslation.width / max(width, 1)
                setSidebar(projected > 0.5)
            }
    }

    private func cleanupAttachments() {
        guard composer.accountID == engine.accountID, composer.errorMessage == nil, composer.save() else { return }
        do { try engine.pruneAttachments(keepingDraftIDs: composer.attachmentReferences) }
        catch { engine.errorMessage = "Some unused attachment files could not be removed. Free storage and reopen Lumen to retry." }
    }

    private func restoreComposer() {
        composer.synchronize(accountID: engine.accountID, conversationID: engine.currentConversation.id, temporary: engine.isTemporary)
    }

    private func requestOpenConversation(_ chat: Conversation) {
        if engine.isTemporary, engine.versions(for: engine.currentConversation.id).contains(where: { $0.id == chat.id }) {
            perform(.conversation(chat))
        } else { request(.conversation(chat)) }
    }

    private func requestNewChat() { request(.new) }

    /// Carries out what Siri, a Shortcut or a link asked, once the account is known (so the message goes to
    /// the right account's new chat): close whatever is open and start a new chat with it.
    private func takeRequest() {
        guard auth.hasRestored, engine.accountID == (auth.currentUser?.id ?? "device"), let next = requests.pending else { return }
        requests.pending = nil
        settingsOpen = false; modelsOpen = false; projectEditor = nil
        request(.compose(next))
    }

    private func request(_ destination: Destination) {
        if engine.isTemporary && (composer.hasContent || !engine.currentConversation.messages.isEmpty) {
            pendingDestination = destination; discardConfirmation = true
        } else { perform(destination) }
    }

    private func perform(_ destination: Destination) {
        guard composer.save() else { return }
        let changed: Bool
        switch destination {
        case .new: changed = engine.startNewConversation()
        case .temporary: changed = engine.startTemporaryConversation()
        case .draft(let id):
            changed = engine.savedConversations.contains(where: { $0.id == id }) ? engine.selectConversation(id: id) : engine.startNewConversation(id: id)
        case .conversation(let chat): changed = engine.selectConversation(id: chat.id)
        case .newInProject(let id): changed = engine.startNewConversation(projectID: id)
        case .compose(let next):
            changed = engine.startNewConversation()
            if changed { handoff = next }
        }
        restoreComposer()
        guard changed else { return }
        setSidebar(false); path.removeAll(); openProjectID = nil
        let chat = engine.currentConversation
        // A new chat keeps the model you're using, even while the model list is being refreshed.
        if chat.messages.isEmpty, let current = engine.selectedModel, chat.selectedModelId == current.id,
           chat.selectedProviderId == nil || chat.selectedProviderId == current.providerId {
        } else if let model = connections.models.first(where: { $0.id == chat.selectedModelId && (chat.selectedProviderId == nil || $0.providerId == chat.selectedProviderId) }) {
            engine.selectModel(model)
        } else { engine.clearSelectedModel() }
        if !engine.isTemporary { Task { await sync.loadMessages(chatID: chat.id) } }
    }
}
