import SwiftUI
import LumenCore

struct RootView: View {
    @Bindable var composer: DraftState
    @Bindable var engine: ChatEngine
    @Bindable var auth: AuthEngine
    @Bindable var connections: ProviderConnections
    @Bindable var sync: CloudChatSync
    @State private var path: [WorkspaceRoute] = []
    @State private var sidebarOpen = false
    @State private var sidebarPresented = false
    @State private var sidebarProgress: CGFloat = 0
    @State private var sidebarDragAxis: SidebarDragAxis = .undecided
    @State private var sidebarDragStartProgress: CGFloat = 0
    @State private var settingsOpen = false
    @State private var modelsOpen = false
    @State private var discardConfirmation = false
    private struct Inventory: Equatable { let account: String; let ids: Set<String> }
    private var inventory: Inventory { Inventory(account: engine.accountID, ids: Set(engine.savedConversations.map(\.id))) }
    private enum Destination { case new, temporary, conversation(Conversation), draft(String) }
    private enum SidebarDragAxis: Equatable { case undecided, horizontal, vertical, ignored }
    @State private var pendingDestination: Destination?
    @FocusState private var composerFocused: Bool
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        GeometryReader { geometry in
            let sidebarWidth = min(geometry.size.width * 0.86, 350)
            ZStack(alignment: .leading) {
                NavigationStack(path: $path) {
                    ChatView(
                        composer: composer,
                        engine: engine,
                        connections: connections,
                        sync: sync,
                        focused: $composerFocused,
                        chooseModel: { modelsOpen = true },
                        selectVersion: requestOpenConversation
                    )
                    .navigationTitle(engine.isTemporary ? "Temporary chat" : engine.currentConversation.messages.isEmpty ? "Lumen" : engine.currentConversation.title)
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .topBarLeading) {
                            Button("Open sidebar", systemImage: "sidebar.left") {
                                presentSidebar()
                            }
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
                        ToolbarItemGroup(placement: .keyboard) {
                            Spacer()
                            Button("Hide keyboard", systemImage: "keyboard.chevron.compact.down") {
                                composerFocused = false
                            }
                            .accessibilityIdentifier("hideKeyboard")
                        }
                    }
                    .navigationDestination(for: WorkspaceRoute.self) { route in
                        if route == .router { ProvidersView(connections: connections, sync: sync) }
                        else if route == .search || route == .archive { HistorySearchView(engine: engine, initialScope: route == .archive ? .archived : .active, select: requestOpenConversation) }
                        else { WorkspaceView(route: route) }
                    }
                }
                .allowsHitTesting(!sidebarOpen)
                .accessibilityHidden(sidebarOpen)

                if sidebarPresented {
                    Button {
                        dismissSidebar()
                    } label: {
                        Rectangle()
                            .fill(.black.opacity(0.28 * sidebarProgress))
                            .contentShape(Rectangle())
                            .ignoresSafeArea()
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Close sidebar")
                    .accessibilityIdentifier("closeSidebar")

                    SidebarView(
                        engine: engine,
                        composer: composer,
                        auth: auth,
                        newChat: requestNewChat,
                        search: {
                            dismissSidebar()
                            path.append(.search)
                        },
                        openDraft: { request(.draft($0)) },
                        open: { route in
                            dismissSidebar()
                            path.append(route)
                        },
                        selectConversation: requestOpenConversation,
                        settings: {
                            dismissSidebar()
                            settingsOpen = true
                        },
                        close: dismissSidebar
                    )
                    .frame(width: sidebarWidth)
                    .frame(maxHeight: .infinity)
                    .background(LumenPalette.canvas)
                    .shadow(color: .black.opacity(0.18), radius: 24, x: 8)
                    .offset(x: -sidebarWidth * (1 - sidebarProgress))
                    .accessibilityIdentifier("sidebarPanel")
                    .zIndex(1)
                }
            }
            .simultaneousGesture(sidebarPanGesture(width: sidebarWidth), isEnabled: path.isEmpty || sidebarOpen)
        }
        .background(LumenPalette.canvas.ignoresSafeArea())
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { sync.retry() }
            else if phase == .background { engine.stopStreaming(); _ = composer.save(); _ = engine.checkpoint() }
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
        .onAppear { _ = engine.checkpoint(); restoreComposer(); cleanupAttachments() }
        .onChange(of: inventory) { old, new in
            guard old.account == new.account, composer.accountID == new.account else { return }
            let removed = old.ids.subtracting(new.ids)
            if !removed.isEmpty, !composer.removeDrafts(conversationIDs: removed) { return }
            cleanupAttachments()
        }
        .onChange(of: composer.attachmentIDs) { _, _ in cleanupAttachments() }
        .onChange(of: engine.currentConversation.id) { _, _ in restoreComposer() }
        .onChange(of: engine.accountID) { _, _ in pendingDestination = nil; discardConfirmation = false; restoreComposer() }
        .alert("Leave temporary chat?", isPresented: $discardConfirmation) {
            Button("Leave and clear", role: .destructive) {
                if let destination = pendingDestination { perform(destination) }
                pendingDestination = nil
            }
            Button("Cancel", role: .cancel) { pendingDestination = nil }
        } message: { Text("This temporary conversation and its drafts will be cleared from this iPhone.") }
    }

    private func cleanupAttachments() {
        guard composer.accountID == engine.accountID, composer.errorMessage == nil, composer.save() else { return }
        do { try engine.pruneAttachments(keepingDraftIDs: composer.attachmentReferences) }
        catch { engine.errorMessage = "Some unused attachment files could not be removed. Free storage and reopen Lumen to retry." }
    }

    private var sidebarSettleAnimation: Animation? {
        reduceMotion ? nil : .interactiveSpring(response: 0.34, dampingFraction: 0.86, blendDuration: 0.12)
    }

    private func presentSidebar() {
        composerFocused = false
        sidebarPresented = true
        withAnimation(sidebarSettleAnimation) {
            sidebarOpen = true
            sidebarProgress = 1
        }
    }

    private func dismissSidebar() {
        guard sidebarPresented else { return }
        withAnimation(sidebarSettleAnimation, completionCriteria: .logicallyComplete) {
            sidebarOpen = false
            sidebarProgress = 0
        } completion: {
            if !sidebarOpen { sidebarPresented = false }
        }
    }

    private func sidebarPanGesture(width: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 0).onChanged { gesture in
            let delta = gesture.translation
            let horizontal = abs(delta.width)
            let vertical = abs(delta.height)

            if sidebarDragAxis == .undecided {
                guard max(horizontal, vertical) >= 12 else { return }
                guard horizontal > vertical * 1.3 else {
                    sidebarDragAxis = .vertical
                    return
                }

                let opening = !sidebarOpen && path.isEmpty && delta.width > 0
                let closing = sidebarOpen && delta.width < 0
                guard opening || closing else {
                    sidebarDragAxis = .ignored
                    return
                }

                sidebarDragAxis = .horizontal
                sidebarDragStartProgress = sidebarProgress
                if opening {
                    composerFocused = false
                    var transaction = Transaction()
                    transaction.animation = nil
                    withTransaction(transaction) { sidebarPresented = true }
                }
            }

            guard sidebarDragAxis == .horizontal else { return }
            var transaction = Transaction()
            transaction.animation = nil
            withTransaction(transaction) {
                sidebarProgress = min(1, max(0, sidebarDragStartProgress + delta.width / max(width, 1)))
            }
        }.onEnded { gesture in
            guard sidebarDragAxis == .horizontal else {
                sidebarDragAxis = .undecided
                return
            }

            let projectedProgress = sidebarDragStartProgress + gesture.predictedEndTranslation.width / max(width, 1)
            sidebarDragAxis = .undecided
            if projectedProgress >= 0.5 { presentSidebar() }
            else { dismissSidebar() }
        }
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
        }
        restoreComposer()
        guard changed else { return }
        dismissSidebar(); path.removeAll()
        let chat = engine.currentConversation
        if let model = connections.models.first(where: { $0.id == chat.selectedModelId && (chat.selectedProviderId == nil || $0.providerId == chat.selectedProviderId) }) {
            engine.selectModel(model)
        } else { engine.clearSelectedModel() }
        if !engine.isTemporary { Task { await sync.loadMessages(chatID: chat.id) } }
    }
}
