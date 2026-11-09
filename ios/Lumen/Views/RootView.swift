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
    @State private var settingsOpen = false
    @State private var modelsOpen = false
    @State private var discardConfirmation = false
    private struct Inventory: Equatable { let account: String; let ids: Set<String> }
    private var inventory: Inventory { Inventory(account: engine.accountID, ids: Set(engine.savedConversations.map(\.id))) }
    private enum Destination { case new, temporary, conversation(Conversation), draft(String) }
    @State private var pendingDestination: Destination?
    @FocusState private var composerFocused: Bool
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        GeometryReader { geometry in
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
                                composerFocused = false
                                sidebarOpen = true
                            }
                            .accessibilityIdentifier("openSidebar")
                        }
                        ToolbarItem(placement: .topBarTrailing) {
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

                if sidebarOpen {
                    Button("Close sidebar") { sidebarOpen = false }
                        .font(.body)
                        .foregroundStyle(.clear)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(.black.opacity(0.28))
                        .ignoresSafeArea()
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("closeSidebar")
                        .transition(.opacity)

                    SidebarView(
                        engine: engine,
                        composer: composer,
                        auth: auth,
                        newChat: requestNewChat,
                        temporaryChat: { request(.temporary) },
                        openDraft: { request(.draft($0)) },
                        open: { route in
                            sidebarOpen = false
                            path.append(route)
                        },
                        selectConversation: requestOpenConversation,
                        settings: {
                            sidebarOpen = false
                            settingsOpen = true
                        },
                        close: { sidebarOpen = false }
                    )
                    .frame(width: min(geometry.size.width * 0.86, 350))
                    .frame(maxHeight: .infinity)
                    .background(.background)
                    .shadow(color: .black.opacity(0.12), radius: 24, x: 8)
                    .transition(.move(edge: .leading))
                    .zIndex(1)
                }
            }
            .animation(reduceMotion ? nil : .snappy(duration: 0.25), value: sidebarOpen)
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { sync.retry() }
            else if phase == .background { engine.stopStreaming(); _ = composer.save(); _ = engine.checkpoint() }
        }
        .onChange(of: engine.isStreaming) { _, streaming in
            if !streaming, engine.currentConversation.historyLoaded == false { Task { await sync.loadMessages(chatID: engine.currentConversation.id) } }
        }
        .sheet(isPresented: $settingsOpen) { SettingsView(composer: composer, engine: engine, auth: auth, connections: connections, sync: sync) }
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
        sidebarOpen = false; path.removeAll()
        let chat = engine.currentConversation
        if let model = connections.models.first(where: { $0.id == chat.selectedModelId && (chat.selectedProviderId == nil || $0.providerId == chat.selectedProviderId) }) {
            engine.selectModel(model)
        } else { engine.clearSelectedModel() }
        if !engine.isTemporary { Task { await sync.loadMessages(chatID: chat.id) } }
    }
}
