import AppIntents

/// Siri phrases and the Shortcuts app's Lumen actions (the app's only shortcuts provider).
struct LumenShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: AskLumenIntent(), phrases: ["Ask \(.applicationName)", "Ask \(.applicationName) a question"],
                    shortTitle: "Ask Lumen", systemImageName: "text.bubble")
        AppShortcut(intent: TalkToLumenIntent(), phrases: ["Talk to \(.applicationName)", "Dictate to \(.applicationName)"],
                    shortTitle: "Talk to Lumen", systemImageName: "mic")
        AppShortcut(intent: NewLumenChatIntent(), phrases: ["New \(.applicationName) chat", "Start a chat in \(.applicationName)"],
                    shortTitle: "New Chat", systemImageName: "square.and.pencil")
    }
    static let shortcutTileColor: ShortcutTileColor = .orange
}
