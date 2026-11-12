import SwiftUI
import LumenCore

/// Memory, About you and custom instructions: the same settings and memories as on the web, shared by every device.
struct PersonalizationView: View {
    @Bindable var sync: CloudChatSync
    @State private var draft = Personalization()
    @State private var loaded = false
    @State private var newMemory = ""
    @State private var saving = false
    @State private var error: String?
    @State private var saves = 0

    var body: some View {
        Form {
            Section {
                Toggle("Memory", isOn: $draft.memory)
                    .accessibilityIdentifier("memoryToggle")
                Toggle("Save memories automatically", isOn: $draft.memoryAuto)
                    .disabled(!draft.memory)
            } footer: {
                Text("Lumen remembers what you ask it to, and lasting facts you share, and uses them in every chat on the web and on this iPhone. Temporary chats never use or change memory.")
            }
            Section {
                TextEditor(text: $draft.aboutMe)
                    .frame(minHeight: 96)
                    .accessibilityLabel("About you")
                    .accessibilityIdentifier("aboutMeField")
            } header: { Text("About you") } footer: {
                Text("\(draft.aboutMe.count) of \(MemoryRules.maximumAboutCharacters) characters")
            }
            Section("Custom instructions") {
                TextEditor(text: $draft.customInstructions)
                    .frame(minHeight: 96)
                    .accessibilityLabel("Custom instructions")
                    .accessibilityIdentifier("customInstructionsField")
            }
            Section {
                Button {
                    save()
                } label: {
                    HStack { Text("Save"); if saving { Spacer(); ProgressView() } }
                }
                .disabled(saving || draft == sync.personalization || draft.aboutMe.count > MemoryRules.maximumAboutCharacters)
                .accessibilityIdentifier("savePersonalization")
            }
            Section {
                HStack {
                    TextField("Add a memory", text: $newMemory)
                        .submitLabel(.done)
                        .onSubmit(add)
                        .accessibilityIdentifier("newMemoryField")
                    Button("Add", action: add)
                        .disabled(newMemory.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                        .accessibilityIdentifier("addMemory")
                }
                ForEach(sync.memories) { memory in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(memory.text)
                        if memory.projectID != nil {
                            Text("This project only").font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    .accessibilityIdentifier("memory-" + memory.id)
                }
                .onDelete { offsets in
                    let ids = offsets.map { sync.memories[$0].id }
                    Task { for id in ids { await run { try await sync.deleteMemory(id) } } }
                }
            } header: {
                Text("Saved memories (\(sync.memories.count))")
            } footer: {
                Text("Swipe a memory to delete it.")
            }
            if let error {
                Section { Text(error).font(.footnote).foregroundStyle(.red) }
            }
        }
        .scrollContentBackground(.hidden)
        .background(LumenPalette.canvas)
        .navigationTitle("Personalization")
        .navigationBarTitleDisplayMode(.inline)
        .sensoryFeedback(.success, trigger: saves)
        .onAppear {
            if !loaded { draft = sync.personalization; loaded = true }
        }
    }

    private func save() {
        saving = true
        Task {
            await run {
                try await sync.savePersonalization(draft)
                saves += 1
            }
            saving = false
        }
    }

    private func add() {
        let text = newMemory
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        newMemory = ""
        Task { await run { try await sync.addMemory(text) } }
    }

    private func run(_ action: () async throws -> Void) async {
        error = nil
        do { try await action() } catch { self.error = error.localizedDescription }
    }
}
