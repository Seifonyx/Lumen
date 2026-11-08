import SwiftUI
import LumenCore

struct SettingsView: View {
    @Bindable var composer: DraftState
    @Bindable var engine: ChatEngine
    @Bindable var auth: AuthEngine
    @Environment(\.dismiss) private var dismiss
    @AppStorage("lumen.appearance") private var appearance = "system"
    @AppStorage("lumen.api-key") private var apiKey = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Appearance") {
                    Picker("Appearance", selection: $appearance) {
                        Text("System").tag("system")
                        Text("Light").tag("light")
                        Text("Dark").tag("dark")
                    }
                    .pickerStyle(.segmented)
                    .accessibilityIdentifier("appearancePicker")
                }

                Section("AI Provider API Key") {
                    SecureField("Enter API Key (Groq / OpenAI / Gemini)", text: $apiKey)
                        .accessibilityIdentifier("apiKeyField")
                    if let model = engine.selectedModel {
                        LabeledContent("Selected Model", value: model.name)
                    }
                }

                Section("Account") {
                    if let user = auth.currentUser {
                        HStack(spacing: 12) {
                            Image(systemName: "person.crop.circle.fill")
                                .font(.title)
                                .foregroundStyle(.tint)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(user.displayName)
                                    .font(.headline)
                                Text(user.email)
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        Button("Sign out", role: .destructive) {
                            auth.signOut()
                        }
                    } else {
                        Label("Not signed in", systemImage: "person.crop.circle")
                            .foregroundStyle(.secondary)
                        Button("Sign in with Google") {
                            auth.signInPreview()
                        }
                    }
                }

                Section("About") {
                    LabeledContent("Version", value: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "")
                    LabeledContent("Build", value: Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "")
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
