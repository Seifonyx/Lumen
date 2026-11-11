import SwiftUI
import LumenCore

enum WorkspaceRoute: String, CaseIterable, Identifiable, Hashable {
    case search, archive, router
    var id: Self { self }
    var title: String {
        switch self {
        case .search: "Search"
        case .archive: "Archived chats"
        case .router: "Router"
        }
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
            .scrollContentBackground(.hidden)
            .background(LumenPalette.canvas)
            .navigationTitle("Models")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}
