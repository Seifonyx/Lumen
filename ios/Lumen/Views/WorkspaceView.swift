import SwiftUI
import LumenCore

enum WorkspaceRoute: String, CaseIterable, Identifiable, Hashable {
    case search, archive, router, library
    var id: Self { self }
    var title: String {
        switch self {
        case .search: "Search"
        case .archive: "Archived chats"
        case .router: "Router"
        case .library: "Library"
        }
    }
}

struct ModelSheet: View {
    @Bindable var engine: ChatEngine
    @Bindable var connections: ProviderConnections
    @Bindable var sync: CloudChatSync
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @AppStorage("lumen.autoModel") private var autoModel = false
    var body: some View {
        NavigationStack {
            List {
                if query.isEmpty && !connections.models.isEmpty {
                    Section {
                        Button {
                            autoModel = true
                            dismiss()
                        } label: {
                            HStack(spacing: 12) {
                                Image(systemName: "sparkles").foregroundStyle(LumenPalette.accent).accessibilityHidden(true)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Auto").foregroundStyle(.primary)
                                    Text("Picks the best of your models for each message").font(.caption).foregroundStyle(.secondary)
                                }
                                Spacer()
                                if autoModel { Image(systemName: "checkmark").bold().accessibilityLabel("Selected") }
                            }
                            .padding(.vertical, 5)
                        }
                        .accessibilityIdentifier("model-auto")
                    }
                }
                if sync.isLoadingKeys || !connections.loading.isEmpty {
                    HStack { ProgressView(); Text("Loading your models…").foregroundStyle(.secondary) }
                }
                ForEach(AIProviderID.allCases) { provider in
                    let models = connections.models.filter { $0.providerId == provider.rawValue && (query.isEmpty || $0.name.localizedCaseInsensitiveContains(query)) }
                    if !models.isEmpty {
                        Section(provider.name) {
                            ForEach(models) { model in
                                Button {
                                    autoModel = false
                                    engine.selectModel(model)
                                    dismiss()
                                } label: {
                                    HStack {
                                        Text(model.name).foregroundStyle(.primary)
                                        if model.supportsImages { Label("Images", systemImage: "photo").font(.caption).foregroundStyle(.secondary) }
                                        Spacer()
                                        if !autoModel && engine.selectedModel?.id == model.id && engine.selectedModel?.providerId == model.providerId { Image(systemName: "checkmark").bold() }
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
        // Full height: on a small iPhone half a sheet showed only Auto and one model, under the search field.
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }
}
