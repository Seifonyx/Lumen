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
    @State private var pendingConversation: Conversation?
    @FocusState private var composerFocused: Bool
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
                        chooseModel: { modelsOpen = true }
                    )
                    .navigationTitle(engine.currentConversation.messages.isEmpty ? "Lumen" : engine.currentConversation.title)
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
                        else if route == .search { HistorySearchView(engine: engine, select: openConversation) }
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
                        auth: auth,
                        newChat: requestNewChat,
                        open: { route in
                            sidebarOpen = false
                            path.append(route)
                        },
                        selectConversation: { conv in
                            if composer.hasContent { pendingConversation = conv; discardConfirmation = true }
                            else { openConversation(conv) }
                        },
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
        .onChange(of: engine.isStreaming) { _, streaming in
            if !streaming, engine.currentConversation.historyLoaded == false { Task { await sync.loadMessages(chatID: engine.currentConversation.id) } }
        }
        .sheet(isPresented: $settingsOpen) { SettingsView(composer: composer, engine: engine, auth: auth, connections: connections, sync: sync) }
        .sheet(isPresented: $modelsOpen) { ModelSheet(engine: engine, connections: connections, sync: sync) }
        .alert("Discard this draft?", isPresented: $discardConfirmation) {
            Button("Discard draft", role: .destructive) {
                composer.discardDraft()
                if let chat = pendingConversation { openConversation(chat) }
                else { startNewChat() }
                pendingConversation = nil
            }
            Button("Cancel", role: .cancel) { pendingConversation = nil }
        } message: {
            Text("Your unsent draft will be cleared.")
        }
    }

    private func openConversation(_ chat: Conversation) {
        sidebarOpen = false
        path.removeAll()
        engine.selectConversation(id: chat.id)
        if let model = connections.models.first(where: { $0.id == chat.selectedModelId && (chat.selectedProviderId == nil || $0.providerId == chat.selectedProviderId) }) {
            engine.selectModel(model)
        } else { engine.clearSelectedModel() }
        Task { await sync.loadMessages(chatID: chat.id) }
    }

    private func requestNewChat() {
        pendingConversation = nil
        if composer.hasContent { discardConfirmation = true }
        else { startNewChat() }
    }

    private func startNewChat() {
        composer.discardDraft()
        engine.startNewConversation()
        path.removeAll()
        sidebarOpen = false
    }
}
