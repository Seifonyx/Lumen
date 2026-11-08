import SwiftUI
import LumenCore

struct SidebarView: View {
    @Bindable var engine: ChatEngine
    @Bindable var auth: AuthEngine
    var newChat: () -> Void
    var open: (WorkspaceRoute) -> Void
    var selectConversation: (Conversation) -> Void
    var settings: () -> Void
    var close: () -> Void
    @AccessibilityFocusState private var headingFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("Lumen")
                    .font(.title2.weight(.semibold))
                    .accessibilityAddTraits(.isHeader)
                    .accessibilityFocused($headingFocused)
                Spacer()
                Button("Close sidebar", systemImage: "xmark", action: close)
                    .labelStyle(.iconOnly)
                    .frame(minWidth: 44, minHeight: 44)
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)

            ScrollView {
                VStack(alignment: .leading, spacing: 6) {
                    row("New chat", icon: "square.and.pencil", action: newChat)
                        .accessibilityIdentifier("sidebarNewChat")
                    ForEach(WorkspaceRoute.allCases) { route in
                        row(route.title, icon: route.icon) { open(route) }
                            .accessibilityIdentifier("sidebar-\(route.rawValue)")
                    }

                    Divider().padding(.vertical, 18)

                    Text("Conversations")
                        .font(.subheadline.weight(.semibold))
                        .accessibilityAddTraits(.isHeader)

                    if engine.savedConversations.isEmpty {
                        Text("Your chats will appear here.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .padding(.top, 8)
                    } else {
                        VStack(alignment: .leading, spacing: 4) {
                            ForEach(engine.savedConversations.filter { $0.archived != true }) { conv in
                                Button {
                                    selectConversation(conv)
                                } label: {
                                    HStack {
                                        Image(systemName: "bubble.left")
                                            .frame(width: 20)
                                            .foregroundStyle(.secondary)
                                        Text(conv.title)
                                            .lineLimit(1)
                                            .font(.subheadline)
                                        Spacer()
                                    }
                                    .padding(.vertical, 8)
                                    .padding(.horizontal, 8)
                                    .background(engine.currentConversation.id == conv.id ? Color.primary.opacity(0.08) : .clear, in: .rect(cornerRadius: 8))
                                }
                                .buttonStyle(.plain)
                                .accessibilityIdentifier("history-" + conv.id)
                            }
                        }
                        .padding(.top, 8)
                    }
                }
                .padding(20)
            }

            Divider()
            Button(action: settings) {
                HStack(spacing: 12) {
                    Image(systemName: "person.crop.circle")
                        .frame(width: 24)
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(auth.currentUser?.displayName ?? "Settings")
                            .font(.body)
                        if let email = auth.currentUser?.email, !email.isEmpty {
                            Text(email)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    Spacer(minLength: 0)
                }
            }
            .buttonStyle(SidebarRowStyle())
            .accessibilityIdentifier("openSettings")
            .padding(16)
        }
        .accessibilityElement(children: .contain)
        .accessibilityAction(.escape, close)
        .onAppear { headingFocused = true }
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
            .font(.body)
        }
        .buttonStyle(SidebarRowStyle())
    }
}

private struct SidebarRowStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
            .background(configuration.isPressed ? Color.primary.opacity(0.08) : .clear,
                        in: .rect(cornerRadius: 8))
            .contentShape(.interaction, Rectangle())
    }
}
