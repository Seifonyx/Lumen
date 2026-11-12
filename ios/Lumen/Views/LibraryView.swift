import SwiftUI
import LumenCore

/// Every file and photo in your chats, in one place, as on the web: a view of the chats, not a second copy.
struct LibraryView: View {
    @Bindable var engine: ChatEngine
    var openChat: (String) -> Void
    @State private var kind: LibraryItem.Kind = .all
    @State private var query = ""
    @State private var preview: ChatAttachment?
    @State private var error: String?

    private var all: [LibraryItem] { LibraryIndex.items(in: engine.savedConversations) }
    private var shown: [LibraryItem] { LibraryIndex.filter(all, kind: kind, query: query) }

    var body: some View {
        List {
            Section {
                Picker("Show", selection: $kind) {
                    ForEach(LibraryItem.Kind.allCases) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
                .accessibilityIdentifier("libraryKind")
            }
            .listRowBackground(Color.clear)
            .listRowInsets(EdgeInsets(top: 0, leading: 0, bottom: 0, trailing: 0))

            if shown.isEmpty {
                ContentUnavailableView(query.isEmpty ? "Nothing here yet" : "No matches",
                                       systemImage: kind == .photos ? "photo.on.rectangle" : "doc.on.doc",
                                       description: Text(query.isEmpty ? "Files and photos from your chats appear here." : "Try another name."))
                    .listRowBackground(Color.clear)
            } else {
                Section {
                    ForEach(shown) { item in
                        Button { open(item) } label: { row(item) }
                            .accessibilityIdentifier("library-item-" + item.file.id)
                            .contextMenu {
                                Button("Open chat", systemImage: "bubble.left") { openChat(item.chatID) }
                            }
                    }
                } footer: {
                    Text("From the chats saved on this iPhone. Open a web chat once to include its files.")
                }
            }
            if let error {
                Section { Text(error).font(.footnote).foregroundStyle(.red) }
            }
        }
        .searchable(text: $query, prompt: "Find a file")
        .scrollContentBackground(.hidden)
        .background(LumenPalette.canvas)
        .navigationTitle("Library")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $preview) { AttachmentPreview(file: $0) }
    }

    private func row(_ item: LibraryItem) -> some View {
        HStack(spacing: 12) {
            Image(systemName: item.kind == .photos ? "photo" : item.kind == .generated ? "sparkles.rectangle.stack" : "doc.text")
                .font(.title3)
                .foregroundStyle(LumenPalette.accent)
                .frame(width: 36, height: 36)
                .background(LumenPalette.elevated, in: .rect(cornerRadius: 8, style: .continuous))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(item.file.name).font(LumenType.row).foregroundStyle(LumenPalette.ink).lineLimit(1)
                Text(item.chatTitle + " · " + item.date.formatted(date: .abbreviated, time: .omitted))
                    .font(.caption).foregroundStyle(.secondary).lineLimit(1)
            }
            Spacer(minLength: 0)
        }
        .frame(minHeight: 44)
        .accessibilityElement(children: .combine)
    }

    /// Text previews from the chat itself; photos from this iPhone's copy, or the chat when there is none.
    private func open(_ item: LibraryItem) {
        error = nil
        if item.file.kind == .text, item.file.text != nil { preview = item.file; return }
        if let file = try? engine.attachment(id: item.file.id) { preview = file; return }
        openChat(item.chatID)
    }
}
