import SwiftUI

struct SidebarView: View {
    var newChat: () -> Void
    var open: (WorkspaceRoute) -> Void
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
                    Text("Your chats will appear here.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .padding(.top, 8)
                }
                .padding(20)
            }

            Divider()
            row("Settings", icon: "person.crop.circle", action: settings)
                .accessibilityIdentifier("openSettings")
                .padding(16)
        }
        .accessibilityElement(children: .contain)
        .accessibilityAction(.escape, close)
        .onAppear { headingFocused = true }
    }

    private func row(_ title: String, icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(title, systemImage: icon)
                .font(.body)
                .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}
