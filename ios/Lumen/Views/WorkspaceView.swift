import SwiftUI
import LumenCore

enum WorkspaceRoute: String, CaseIterable, Identifiable, Hashable {
    case search, projects, library, router
    var id: Self { self }
    var title: String {
        switch self {
        case .search: "Search"
        case .projects: "Projects"
        case .library: "Library"
        case .router: "Models & providers"
        }
    }
    var icon: String {
        switch self {
        case .search: "magnifyingglass"
        case .projects: "folder"
        case .library: "books.vertical"
        case .router: "cpu"
        }
    }
    var emptyTitle: String {
        switch self {
        case .search: "No conversations to search"
        case .projects: "No projects yet"
        case .library: "Your library is empty"
        case .router: "No providers connected"
        }
    }
    var detail: String {
        switch self {
        case .search: "Find messages and conversations here."
        case .projects: "Keep related chats and files together."
        case .library: "Documents and attachments will appear here."
        case .router: "Your connected providers and models will appear here."
        }
    }
}

struct WorkspaceView: View {
    let route: WorkspaceRoute
    var body: some View {
        ContentUnavailableView(route.title, systemImage: route.icon, description: Text("Coming in a later native update. Your existing web content stays in your account."))
            .navigationTitle(route.title)
            .navigationBarTitleDisplayMode(.inline)
    }
}

struct HistorySearchView: View {
    @Bindable var engine: ChatEngine
    var select: (Conversation) -> Void
    @State private var query = ""
    private var results: [Conversation] {
        engine.savedConversations.filter { $0.archived != true && (query.isEmpty || $0.title.localizedCaseInsensitiveContains(query)) }
    }
    var body: some View {
        List(results) { chat in
            Button { select(chat) } label: {
                VStack(alignment: .leading, spacing: 4) {
                    Text(chat.title).foregroundStyle(.primary)
                    Text(chat.updatedAt, style: .date).font(.caption).foregroundStyle(.secondary)
                }
            }
        }
        .overlay { if results.isEmpty { ContentUnavailableView.search(text: query) } }
        .searchable(text: $query, prompt: "Search chat titles")
        .navigationTitle("Search")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct ModelSheet: View {
    @Bindable var engine: ChatEngine
    @Bindable var connections: ProviderConnections
    @Bindable var sync: CloudChatSync
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    var body: some View {
        NavigationStack {
            List {
                if !connections.loading.isEmpty {
                    HStack { ProgressView(); Text("Loading your models…").foregroundStyle(.secondary) }
                }
                ForEach(AIProviderID.allCases) { provider in
                    let models = connections.models.filter { $0.providerId == provider.rawValue && (query.isEmpty || $0.name.localizedCaseInsensitiveContains(query)) }
                    if !models.isEmpty {
                        Section(provider.name) {
                            ForEach(models) { model in
                                Button {
                                    engine.selectModel(model)
                                    dismiss()
                                } label: {
                                    HStack {
                                        Text(model.name).foregroundStyle(.primary)
                                        Spacer()
                                        if engine.selectedModel?.id == model.id && engine.selectedModel?.providerId == model.providerId { Image(systemName: "checkmark").bold() }
                                    }
                                    .padding(.vertical, 5)
                                }
                                .accessibilityIdentifier("model-" + model.providerId + "-" + model.id)
                            }
                        }
                    }
                }
                if connections.models.isEmpty && connections.loading.isEmpty {
                    Section {
                        Text("Connect a provider to choose from the models available with your API key.")
                            .foregroundStyle(.secondary)
                        ForEach(connections.errors.keys.sorted(), id: \.self) { id in
                            if let error = connections.errors[id] { Text(error).font(.footnote).foregroundStyle(.red) }
                        }
                    }
                }
                Section {
                    NavigationLink { ProvidersView(connections: connections, sync: sync) } label: {
                        Label("Connect a provider", systemImage: "plus.circle")
                    }
                }
            }
            .searchable(text: $query, prompt: "Find a model")
            .navigationTitle("Models")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}
