import SwiftUI
import LumenCore

struct RootView: View {
    @Bindable var composer: DraftState
    @Bindable var engine: ChatEngine
    @State private var path: [WorkspaceRoute] = []
    @State private var sidebarOpen = false
    @State private var settingsOpen = false
    @State private var modelsOpen = false
    @State private var discardConfirmation = false
    @FocusState private var composerFocused: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                NavigationStack(path: $path) {
                    ChatView(
                        composer: composer,
                        engine: engine,
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
                        WorkspaceView(route: route)
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
                        newChat: requestNewChat,
                        open: { route in
                            sidebarOpen = false
                            path.append(route)
                        },
                        selectConversation: { conv in
                            sidebarOpen = false
                            engine.selectConversation(id: conv.id)
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
        .sheet(isPresented: $settingsOpen) { SettingsView(composer: composer, engine: engine) }
        .sheet(isPresented: $modelsOpen) { ModelSheet(engine: engine) }
        .alert("Start a new chat?", isPresented: $discardConfirmation) {
            Button("Discard draft", role: .destructive) { startNewChat() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Your unsent draft will be cleared.")
        }
    }

    private func requestNewChat() {
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
