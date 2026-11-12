import SwiftUI
import LumenCore

/// One project: its instructions, a new chat that starts inside it, and its chats. The same projects as on the web.
struct ProjectView: View {
    let projectID: String
    @Bindable var engine: ChatEngine
    @Bindable var sync: CloudChatSync
    var newChat: (String) -> Void
    var openChat: (Conversation) -> Void
    var edit: (LumenProject) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var confirmingDelete = false
    @State private var deleting = false
    @State private var error: String?
    @State private var renaming: Conversation?
    @State private var pendingDeletion: Conversation?

    private var project: LumenProject? { sync.projects.first { $0.id == projectID } }
    private var chats: [Conversation] {
        engine.historyConversations.filter { $0.projectId == projectID && $0.archived != true }
    }

    var body: some View {
        List {
            if let project {
                Section {
                    Button { newChat(projectID) } label: {
                        Label("New chat in this project", systemImage: "square.and.pencil")
                            .font(LumenType.row)
                            .frame(minHeight: 44, alignment: .leading)
                    }
                    .accessibilityIdentifier("projectNewChat")
                }
                Section {
                    Button { edit(project) } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(project.instructions.isEmpty ? "Add instructions" : project.instructions)
                                .foregroundStyle(project.instructions.isEmpty ? LumenPalette.accent : LumenPalette.ink)
                                .lineLimit(4)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .frame(minHeight: 44)
                    }
                    .accessibilityHint("Edits the project's name and instructions")
                    .accessibilityIdentifier("projectInstructions")
                } header: {
                    Text("Instructions")
                } footer: {
                    Text("Sent with every message in this project.")
                }
                Section("Chats") {
                    if chats.isEmpty {
                        Text("Chats you start in this project appear here.")
                            .foregroundStyle(.secondary)
                    }
                    ForEach(chats) { chat in
                        Button { openChat(chat) } label: {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(chat.title).font(LumenType.row).foregroundStyle(LumenPalette.ink).lineLimit(1)
                                Text(chat.updatedAt, style: .date).font(.caption).foregroundStyle(.secondary)
                            }
                            .frame(minHeight: 44, alignment: .leading)
                        }
                        .accessibilityIdentifier("history-" + chat.id)
                        .contextMenu {
                            ConversationActions(chat: chat, engine: engine, projects: sync.projects,
                                                rename: { renaming = chat }, delete: { pendingDeletion = chat })
                        }
                    }
                }
                if let error {
                    Section { Text(error).font(.footnote).foregroundStyle(.red) }
                }
            } else {
                ContentUnavailableView("Project removed", systemImage: "folder",
                                       description: Text("This project was deleted, possibly on another device."))
            }
        }
        .scrollContentBackground(.hidden)
        .background(LumenPalette.canvas)
        .navigationTitle(project?.name ?? "Project")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if let project {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu("Project options", systemImage: "ellipsis") {
                        Button("Edit project", systemImage: "pencil") { edit(project) }
                        Button("Delete project", systemImage: "trash", role: .destructive) { confirmingDelete = true }
                    }
                    .accessibilityIdentifier("projectOptions")
                }
            }
        }
        .sheet(item: $renaming) { RenameConversationSheet(chat: $0, engine: engine) }
        .alert("Delete chat?", isPresented: Binding(get: { pendingDeletion != nil }, set: { if !$0 { pendingDeletion = nil } })) {
            Button("Delete", role: .destructive) {
                if let chat = pendingDeletion { _ = engine.deleteConversation(id: chat.id) }
                pendingDeletion = nil
            }
            Button("Cancel", role: .cancel) { pendingDeletion = nil }
        } message: { Text("This removes the conversation and its versions.") }
        .confirmationDialog("Delete \(project?.name ?? "this project")?", isPresented: $confirmingDelete, titleVisibility: .visible) {
            Button("Delete project", role: .destructive) {
                Task {
                    deleting = true; error = nil
                    do { try await sync.saveProject(.delete(id: projectID)); dismiss() }
                    catch { self.error = error.localizedDescription }
                    deleting = false
                }
            }
        } message: {
            Text("Its chats are kept, outside any project. This changes the project on the web too.")
        }
        .disabled(deleting)
    }
}

/// What the project editor is editing: a new project, or an existing one.
struct ProjectEditorTarget: Identifiable {
    let id: String
    let existing: LumenProject?
    static func new() -> ProjectEditorTarget { ProjectEditorTarget(id: UUID().uuidString, existing: nil) }
    static func edit(_ project: LumenProject) -> ProjectEditorTarget { ProjectEditorTarget(id: project.id, existing: project) }
}

struct ProjectEditorSheet: View {
    let target: ProjectEditorTarget
    @Bindable var sync: CloudChatSync
    var created: (String) -> Void = { _ in }
    @Environment(\.dismiss) private var dismiss
    @State private var name: String
    @State private var instructions: String
    @State private var saving = false
    @State private var error: String?
    @State private var saves = 0
    @FocusState private var nameFocused: Bool

    init(target: ProjectEditorTarget, sync: CloudChatSync, created: @escaping (String) -> Void = { _ in }) {
        self.target = target
        self.sync = sync
        self.created = created
        _name = State(initialValue: target.existing?.name ?? "")
        _instructions = State(initialValue: target.existing?.instructions ?? "")
    }

    private var canSave: Bool {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        return !trimmed.isEmpty && trimmed.count <= ProjectSettings.maximumNameLength && !saving
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Name") {
                    TextField("Project name", text: $name)
                        .focused($nameFocused)
                        .submitLabel(.done)
                        .accessibilityIdentifier("projectName")
                }
                Section {
                    TextEditor(text: $instructions)
                        .frame(minHeight: 160)
                        .accessibilityLabel("Instructions")
                        .accessibilityIdentifier("projectInstructionsField")
                } header: {
                    Text("Instructions")
                } footer: {
                    Text("Sent with every message in this project, on the web and on this iPhone.")
                }
                if let error {
                    Section { Text(error).foregroundStyle(.red).font(.footnote) }
                }
            }
            .scrollContentBackground(.hidden)
            .background(LumenPalette.canvas)
            .navigationTitle(target.existing == nil ? "New project" : "Edit project")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    if saving { ProgressView() }
                    else {
                        Button("Save", action: save)
                            .disabled(!canSave)
                            .accessibilityIdentifier("saveProject")
                    }
                }
            }
            .onAppear { if target.existing == nil { nameFocused = true } }
            .sensoryFeedback(.success, trigger: saves)
        }
        .presentationDetents([.medium, .large])
        .interactiveDismissDisabled(saving)
    }

    private func save() {
        let edit: ProjectEdit = target.existing == nil
            ? .create(id: target.id, name: name, instructions: instructions)
            : .update(id: target.id, name: name, instructions: instructions)
        saving = true; error = nil
        Task {
            do {
                try await sync.saveProject(edit)
                saves += 1
                if target.existing == nil { created(target.id) }
                dismiss()
            } catch {
                self.error = error.localizedDescription
            }
            saving = false
        }
    }
}
