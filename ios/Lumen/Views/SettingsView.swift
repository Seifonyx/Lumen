import SwiftUI
import LumenCore

struct SettingsView: View {
    @Bindable var composer: DraftState
    @Bindable var engine: ChatEngine
    @Bindable var auth: AuthEngine
    @Bindable var connections: ProviderConnections
    @Bindable var sync: CloudChatSync
    @Environment(\.dismiss) private var dismiss
    @AppStorage("lumen.appearance") private var appearance = "system"
    var openConversation: (Conversation) -> Void

    var body: some View {
        NavigationStack {
            Form {
                Section("Account") {
                    if let user = auth.currentUser {
                        Label {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(user.displayName).font(.headline)
                                Text(AccountDisplay.email(user.email)).font(.subheadline).foregroundStyle(.secondary)
                            }
                        } icon: { Image(systemName: "person.crop.circle.fill").font(.title) }
                        Text(sync.status).font(.footnote).foregroundStyle(.secondary)
                        Button("Sign out", role: .destructive) { auth.signOut() }.accessibilityIdentifier("signOut")
                    } else {
                        Text("Sign in with the same Google account you use on the web to open your saved chats.")
                            .foregroundStyle(.secondary)
                        Button { Task { await auth.signIn() } } label: {
                            HStack {
                                Label("Sign in with Google", systemImage: "person.crop.circle.badge.checkmark")
                                if auth.isLoading { Spacer(); ProgressView() }
                            }
                        }
                        .disabled(auth.isLoading)
                        .accessibilityIdentifier("googleSignIn")
                    }
                    if let error = auth.errorMessage { Text(error).foregroundStyle(.red).font(.footnote) }
                    if let error = sync.errorMessage {
                        Text(error).foregroundStyle(.red).font(.footnote)
                        Button("Retry cloud sync") { sync.retry() }
                    }
                }
                if auth.currentUser != nil {
                    Section("Personalization") {
                        NavigationLink { PersonalizationView(sync: sync) } label: {
                            Label("Memory and instructions", systemImage: "brain.head.profile")
                        }
                        .accessibilityIdentifier("personalizationSettings")
                    }
                }
                Section("AI services") {
                    NavigationLink { ProvidersView(connections: connections, sync: sync) } label: {
                        Label("Router", systemImage: "arrow.triangle.branch")
                    }.accessibilityIdentifier("providerSettings")
                }
                Section("Chats & data") {
                    NavigationLink {
                        HistorySearchView(engine: engine, initialScope: .archived) { chat in
                            dismiss()
                            openConversation(chat)
                        }
                    } label: {
                        Label("Archived chats", systemImage: "archivebox")
                    }
                    .accessibilityIdentifier("archivedChatsEntry")
                }
                Section("Appearance") {
                    Picker("Appearance", selection: $appearance) {
                        Text("System").tag("system")
                        Text("Light").tag("light")
                        Text("Dark").tag("dark")
                    }
                    .pickerStyle(.segmented)
                    .accessibilityIdentifier("appearancePicker")
                }
                Section("About") {
                    LabeledContent("Version", value: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "")
                    LabeledContent("Build", value: Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "")
                }
            }
            .scrollContentBackground(.hidden)
            .background(LumenPalette.canvas)
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
    }
}

struct ProvidersView: View {
    @Bindable var connections: ProviderConnections
    @Bindable var sync: CloudChatSync
    var body: some View {
        List {
            Section {
                ForEach(AIProviderID.allCases) { provider in
                    NavigationLink { ProviderConnectionView(provider: provider, connections: connections) } label: {
                        HStack {
                            Text(provider.name)
                            Spacer()
                            if connections.loading.contains(provider.rawValue) { ProgressView() }
                            else if connections.connected.contains(provider.rawValue) {
                                Label("Connected", systemImage: "checkmark.circle.fill")
                                    .font(.caption).foregroundStyle(.green)
                            } else {
                                Text("Not connected").font(.caption).foregroundStyle(LumenPalette.muted)
                            }
                        }
                    }.accessibilityIdentifier("provider-" + provider.rawValue)
                }
            } footer: {
                Text("Keys are saved in this iPhone's Keychain. Messages go directly to the provider you choose.")
            }
            if connections.accountID != "device" {
                Section {
                    Button("Load keys from my Lumen account") { Task { await sync.refreshKeys() } }
                    if let error = sync.keyErrorMessage { Text(error).font(.footnote).foregroundStyle(.red) }
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(LumenPalette.canvas)
        .navigationTitle("Router")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct ProviderConnectionView: View {
    let provider: AIProviderID
    @Bindable var connections: ProviderConnections
    @State private var key = ""
    @State private var removeConfirmation = false
    @FocusState private var keyFocused: Bool
    var body: some View {
        Form {
            Section("API key") {
                SecureField(provider.name + " API key", text: $key)
                    .textContentType(.password)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .focused($keyFocused)
                    .accessibilityIdentifier("apiKeyField")
                Button {
                    keyFocused = false
                    Task { await connections.connect(provider: provider, key: key) }
                } label: {
                    HStack {
                        Text("Connect and refresh models")
                        if connections.loading.contains(provider.rawValue) { Spacer(); ProgressView() }
                    }
                }
                .disabled(key.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || connections.loading.contains(provider.rawValue))
                .buttonStyle(.borderedProminent)
                .accessibilityIdentifier("connectProvider")
                if let error = connections.errors[provider.rawValue] { Text(error).font(.footnote).foregroundStyle(.red) }
            }
            if connections.connected.contains(provider.rawValue) {
                Section {
                    LabeledContent("Available models", value: String(connections.models.filter { $0.providerId == provider.rawValue }.count))
                    Button("Remove saved key", role: .destructive) { removeConfirmation = true }
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(LumenPalette.canvas)
        .navigationTitle(provider.name)
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { key = connections.savedKey(provider: provider) }
        .confirmationDialog("Remove the \(provider.name) key from this iPhone?", isPresented: $removeConfirmation, titleVisibility: .visible) {
            Button("Remove key", role: .destructive) { connections.disconnect(provider: provider); key = "" }
        }
    }
}

/// How an account's email address is shown. The simulator QA account has to use an address on the Firestore
/// invite list (the rules are not changed for tests), so QA runs show a placeholder instead: the release
/// screenshots are published, and must never carry a real person's address.
@MainActor enum AccountDisplay {
    static func email(_ email: String) -> String {
        #if DEBUG && targetEnvironment(simulator)
        if DebugIntegration.enabled { return "native-qa@example.test" }
        #endif
        return email
    }
}
