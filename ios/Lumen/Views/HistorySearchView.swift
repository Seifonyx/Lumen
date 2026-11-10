import SwiftUI
import LumenCore

struct ConversationActions: View {
    let chat: Conversation
    let engine: ChatEngine
    let rename: () -> Void
    let delete: () -> Void
    var body: some View {
        Button("Rename", systemImage: "pencil", action: rename)
        Button(chat.pinned == true ? "Unpin" : "Pin", systemImage: chat.pinned == true ? "pin.slash" : "pin") {
            _ = engine.setPinned(id: chat.id, pinned: chat.pinned != true)
        }
        Button(chat.archived == true ? "Unarchive" : "Archive", systemImage: "archivebox") {
            _ = engine.setArchived(id: chat.id, archived: chat.archived != true)
        }
        Button("Delete chat", systemImage: "trash", role: .destructive, action: delete)
    }
}

struct RenameConversationSheet: View {
    let chat: Conversation
    let engine: ChatEngine
    @Environment(\.dismiss) private var dismiss
    @State private var title: String
    @State private var account: String
    @State private var error: String?
    init(chat: Conversation, engine: ChatEngine) {
        self.chat = chat; self.engine = engine
        _title = State(initialValue: chat.title)
        _account = State(initialValue: engine.accountID)
    }
    var body: some View {
        NavigationStack {
            Form {
                TextField("Conversation name", text: $title).accessibilityIdentifier("conversationName")
                if let error { Text(error).foregroundStyle(.red) }
            }
            .scrollContentBackground(.hidden)
            .background(LumenPalette.canvas)
            .navigationTitle("Rename chat").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        guard engine.accountID == account else { dismiss(); return }
                        if engine.renameConversation(id: chat.id, title: title) { dismiss() }
                        else { error = engine.errorMessage ?? "This conversation could not be renamed." }
                    }
                    .disabled(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    .accessibilityIdentifier("saveConversationName")
                }
            }
        }
        .onChange(of: engine.accountID) { _, _ in dismiss() }
    }
}

struct HistorySearchView: View {
    @Bindable var engine: ChatEngine
    var select: (Conversation) -> Void
    @State private var query = ""
    @State private var scope: HistoryScope
    @State private var renaming: Conversation?
    @State private var deleting: Conversation?
    init(engine: ChatEngine, initialScope: HistoryScope = .active, select: @escaping (Conversation) -> Void) {
        self.engine = engine; self.select = select
        _scope = State(initialValue: initialScope)
    }
    private var results: [ConversationSearchResult] { engine.searchConversations(query: query, scope: scope) }
    var body: some View {
        List {
            Section {
                Picker("Conversations", selection: $scope) {
                    ForEach(HistoryScope.allCases) { Text($0.rawValue).tag($0) }
                }.pickerStyle(.segmented).accessibilityIdentifier("historyScope")
            }
            Section {
                ForEach(results) { result in
                    Button { select(result.conversation) } label: {
                        VStack(alignment: .leading, spacing: 7) {
                            HStack {
                                if result.conversation.pinned == true { Image(systemName: "pin.fill").font(.caption) }
                                Text(result.conversation.title)
                                    .font(LumenType.row)
                                    .foregroundStyle(.primary)
                            }
                            if let preview = result.preview, !preview.isEmpty {
                                Text(preview).font(.subheadline).foregroundStyle(.secondary).lineLimit(2)
                            }
                            Text(result.conversation.updatedAt, style: .date).font(.caption).foregroundStyle(.secondary)
                        }
                        .padding(.vertical, 8)
                    }
                    .accessibilityIdentifier("search-chat-" + result.conversation.id)
                    .contextMenu {
                        ConversationActions(chat: result.conversation, engine: engine,
                                            rename: { renaming = result.conversation }, delete: { deleting = result.conversation })
                    }
                    .swipeActions(edge: .trailing) {
                        Button("Delete", role: .destructive) { deleting = result.conversation }
                        Button(result.conversation.archived == true ? "Unarchive" : "Archive") {
                            _ = engine.setArchived(id: result.conversation.id, archived: result.conversation.archived != true)
                        }.tint(.orange)
                    }
                }
            } footer: { Text("Message search includes conversations opened on this iPhone. All saved conversation titles are searchable.") }
        }
        .overlay {
            if results.isEmpty {
                ContentUnavailableView(query.isEmpty ? "No \(scope.rawValue.lowercased())" : "No matches", systemImage: "magnifyingglass",
                                       description: Text(query.isEmpty ? "Conversations will appear here." : "Try another name or phrase."))
                    .allowsHitTesting(false)
            }
        }
        .scrollContentBackground(.hidden)
        .background(LumenPalette.canvas)
        .searchable(text: $query, prompt: "Search conversations")
        .navigationTitle(scope == .archived ? "Archived chats" : "Search")
        .navigationBarTitleDisplayMode(.inline)
        .listStyle(.insetGrouped)
        .sheet(item: $renaming) { RenameConversationSheet(chat: $0, engine: engine) }
        .alert("Delete chat?", isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } })) {
            Button("Delete", role: .destructive) { if let deleting { _ = engine.deleteConversation(id: deleting.id) }; deleting = nil }
            Button("Cancel", role: .cancel) { deleting = nil }
        } message: { Text("This removes the conversation, all versions and their saved attachments from your account.") }
        .onChange(of: engine.accountID) { _, _ in renaming = nil; deleting = nil }
    }
}
