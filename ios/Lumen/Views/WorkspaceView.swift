import SwiftUI
import LumenCore

enum WorkspaceRoute: String, CaseIterable, Identifiable, Hashable {
    case search, archive, projects, library, router
    var id: Self { self }
    var title: String {
        switch self {
        case .search: "Search"
        case .archive: "Archived chats"
        case .projects: "Projects"
        case .library: "Library"
        case .router: "Models & providers"
        }
    }
    var icon: String {
        switch self {
        case .search: "magnifyingglass"
        case .archive: "archivebox"
        case .projects: "folder"
        case .library: "books.vertical"
        case .router: "cpu"
        }
    }
    var emptyTitle: String {
        switch self {
        case .search: "No conversations to search"
        case .archive: "No archived chats"
        case .projects: "No projects yet"
        case .library: "Your library is empty"
        case .router: "No providers connected"
        }
    }
    var detail: String {
        switch self {
        case .search: "Find messages and conversations here."
        case .archive: "Archived conversations stay available here."
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

struct ModelSheet: View {
    @Bindable var engine: ChatEngine
    @Bindable var connections: ProviderConnections
    @Bindable var sync: CloudChatSync
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    var body: some View {
        NavigationStack {
            List {
                if sync.isLoadingKeys || !connections.loading.isEmpty {
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
                                        if model.supportsImages { Label("Images", systemImage: "photo").font(.caption).foregroundStyle(.secondary) }
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
                if connections.models.isEmpty && connections.loading.isEmpty && !sync.isLoadingKeys {
                    Section {
                        Text("Connect a provider to choose from the models available with your API key.")
                            .foregroundStyle(.secondary)
                        if let error = sync.keyErrorMessage { Text(error).font(.footnote).foregroundStyle(.red) }
                        if connections.accountID != "device" {
                            Button("Load account providers") { Task { await sync.refreshKeys() } }
                        }
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
