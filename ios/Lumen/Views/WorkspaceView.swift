import SwiftUI

enum WorkspaceRoute: String, CaseIterable, Identifiable, Hashable {
    case search, projects, library, router
    var id: Self { self }
    var title: String {
        switch self {
        case .search: "Search"
        case .projects: "Projects"
        case .library: "Library"
        case .router: "Models & providers"
        }
    }
    var icon: String {
        switch self {
        case .search: "magnifyingglass"
        case .projects: "folder"
        case .library: "books.vertical"
        case .router: "cpu"
        }
    }
    var emptyTitle: String {
        switch self {
        case .search: "No conversations to search"
        case .projects: "No projects yet"
        case .library: "Your library is empty"
        case .router: "No providers connected"
        }
    }
    var detail: String {
        switch self {
        case .search: "Find messages and conversations here."
        case .projects: "Keep related chats and files together."
        case .library: "Documents and attachments will appear here."
        case .router: "Your connected providers and models will appear here."
        }
    }
}

struct WorkspaceView: View {
    let route: WorkspaceRoute
    var body: some View {
        ContentUnavailableView(route.emptyTitle, systemImage: route.icon, description: Text(route.detail))
            .navigationTitle(route.title)
            .navigationBarTitleDisplayMode(.inline)
    }
}

struct ModelSheet: View {
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        NavigationStack {
            ContentUnavailableView("No models connected", systemImage: "cpu",
                description: Text("Your connected models will appear here."))
                .navigationTitle("Models")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") { dismiss() }
                    }
                }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}
