import SwiftUI
import LumenCore

struct SidebarView: View {
    @Bindable var engine: ChatEngine
    @Bindable var composer: DraftState
    @Bindable var auth: AuthEngine
    var newChat: () -> Void
    var search: () -> Void
    var openDraft: (String) -> Void
    var open: (WorkspaceRoute) -> Void
    var selectConversation: (Conversation) -> Void
    var settings: () -> Void
    var close: () -> Void
    @AccessibilityFocusState private var headingFocused: Bool
    @State private var pendingDeletion: Conversation?
    @State private var renaming: Conversation?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Image("LumenMark")
                    .resizable().scaledToFit().frame(width: 22, height: 30)
                    .accessibilityHidden(true)
                Text("Lumen")
                    .font(LumenType.brand)
                    .accessibilityAddTraits(.isHeader)
                    .accessibilityFocused($headingFocused)
                Spacer()
                Button("Search chats", systemImage: "magnifyingglass", action: search)
                    .labelStyle(.iconOnly)
                    .font(.title3.weight(.medium))
                    .foregroundStyle(LumenPalette.accent)
                    .frame(minWidth: 44, minHeight: 44)
                    .accessibilityIdentifier("sidebarSearchButton")
            }
            .padding(.horizontal, LumenSpacing.screen)
            .padding(.top, 12)
            .padding(.bottom, 8)

            ScrollView {
                VStack(alignment: .leading, spacing: 6) {
                    row("New chat", icon: "square.and.pencil", action: newChat)
                        .accessibilityIdentifier("sidebarNewChat")
                        .padding(.bottom, 14)

                    if !composer.savedDrafts.isEmpty {
                        Text("Drafts").font(LumenType.section).foregroundStyle(LumenPalette.muted).accessibilityAddTraits(.isHeader)
                        ForEach(composer.savedDrafts) { draft in
                            row(draft.text.isEmpty ? "Attachment draft" : String(draft.text.prefix(48)), icon: "pencil.line") { openDraft(draft.conversationID) }
                                .accessibilityIdentifier("draft-" + draft.conversationID)
                                .contextMenu {
                                    Button("Delete draft", role: .destructive) {
                                        if composer.removeDrafts(conversationIDs: [draft.conversationID]) {
                                            do { try engine.pruneAttachments(keepingDraftIDs: composer.attachmentReferences) }
                                            catch { engine.errorMessage = "Unused attachment files could not be removed. Reopen Lumen to retry." }
                                        }
                                    }
                                }
                        }
                        Divider().padding(.vertical, 12)
                    }
                    LumenSectionHeader(title: "Conversations")

                    if engine.historyConversations.allSatisfy({ $0.archived == true }) {
                        Text("Your chats will appear here.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .padding(.top, 8)
                    } else {
                        VStack(alignment: .leading, spacing: 4) {
                            ForEach(engine.historyConversations.filter { $0.archived != true }) { conv in
                                Button {
                                    selectConversation(conv)
                                } label: {
                                    HStack {
                                        Image(systemName: "bubble.left")
                                            .frame(width: 20)
                                            .foregroundStyle(.secondary)
                                            .accessibilityHidden(true)
                                        if conv.pinned == true {
                                            Image(systemName: "pin.fill").font(.caption2).foregroundStyle(.secondary)
                                                .accessibilityLabel("Pinned")
                                        }
                                        Text(conv.title)
                                            .lineLimit(1)
                                            .font(LumenType.row)
                                        Spacer()
                                    }
                                    .padding(.vertical, 8)
                                    .padding(.horizontal, 8)
                                    .background(engine.currentConversation.id == conv.id ? LumenPalette.selection : .clear, in: .rect(cornerRadius: LumenRadius.compact))
                                    .overlay(alignment: .leading) {
                                        if engine.currentConversation.id == conv.id {
                                            RoundedRectangle(cornerRadius: 2)
                                                .fill(LumenPalette.accent)
                                                .frame(width: 3, height: 26)
                                                .allowsHitTesting(false)
                                        }
                                    }
                                }
                                .buttonStyle(LumenRowButtonStyle())
                                .accessibilityAddTraits(engine.currentConversation.id == conv.id ? .isSelected : [])
                                .accessibilityHint("Opens this chat. Touch and hold for more options.")
                                .accessibilityIdentifier("history-" + conv.id)
                                .contextMenu {
                                    ConversationActions(chat: conv, engine: engine, rename: { renaming = conv }, delete: { pendingDeletion = conv })
                                }
                            }
                        }
                        .padding(.top, 8)
                    }
                }
                .padding(20)
            }

            Divider()
            Button(action: settings) {
                // Your name and Settings, as in the AI apps people know; the email address stays in Settings.
                HStack(spacing: 12) {
                    Text(initial)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(LumenPalette.accentOnFill)
                        .frame(width: 32, height: 32)
                        .background(LumenPalette.accent, in: Circle())
                        .accessibilityHidden(true)
                    Text(auth.currentUser?.displayName ?? "Settings")
                        .font(.body.weight(.medium))
                        .foregroundStyle(LumenPalette.ink)
                        .lineLimit(1)
                    Spacer(minLength: 0)
                    Image(systemName: "gearshape")
                        .foregroundStyle(LumenPalette.muted)
                        .accessibilityHidden(true)
                }
                .padding(.horizontal, 8)
            }
            .buttonStyle(LumenRowButtonStyle())
            .accessibilityLabel((auth.currentUser?.displayName).map { "\($0), Settings" } ?? "Settings")
            .accessibilityIdentifier("openSettings")
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
        }
        .background(LumenPalette.canvas)
        .accessibilityElement(children: .contain)
        .accessibilityAction(.escape, close)
        .onAppear { headingFocused = true }
        .sheet(item: $renaming) { RenameConversationSheet(chat: $0, engine: engine) }
        .onChange(of: engine.accountID) { _, _ in renaming = nil; pendingDeletion = nil }
        .alert("Delete chat?", isPresented: Binding(get: { pendingDeletion != nil }, set: { if !$0 { pendingDeletion = nil } })) {
            Button("Delete", role: .destructive) {
                if let chat = pendingDeletion { _ = engine.deleteConversation(id: chat.id) }
                pendingDeletion = nil
                close()
            }
            Button("Cancel", role: .cancel) { pendingDeletion = nil }
        } message: { Text("This removes the conversation and its versions. Uploaded file originals stay in your account until you delete the account.") }
    }

    private var initial: String {
        let name = auth.currentUser?.displayName.trimmingCharacters(in: .whitespaces) ?? ""
        return name.first.map { String($0).uppercased() } ?? "L"
    }

    private func row(_ title: String, icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .frame(width: 24)
                    .accessibilityHidden(true)
                Text(title)
                Spacer(minLength: 0)
            }
            .font(LumenType.row)
        }
        .buttonStyle(LumenRowButtonStyle())
    }
}

