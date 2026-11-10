import SwiftUI
import PhotosUI
import UniformTypeIdentifiers
import ImageIO
import LumenCore

struct ComposerAttachments: View {
    @Bindable var composer: DraftState
    @Bindable var engine: ChatEngine
    @State private var photo: PhotosPickerItem?
    @State private var filesOpen = false
    @Binding var importing: Bool
    @State private var error: String?
    @State private var preview: ChatAttachment?
    private var canAttach: Bool { !importing && !engine.isStreaming && composer.attachmentIDs.count < 4 }
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if !composer.attachmentIDs.isEmpty {
                ScrollView(.horizontal) {
                    HStack {
                        ForEach(composer.attachmentIDs, id: \.self) { id in
                            HStack(spacing: 4) {
                                Button { do { preview = try engine.attachment(id: id) } catch { self.error = error.localizedDescription } } label: {
                                    Label((try? engine.attachment(id: id).name) ?? "Unavailable file", systemImage: "doc")
                                        .lineLimit(1).frame(maxWidth: 170)
                                }.accessibilityIdentifier("previewAttachment-" + id)
                                Button("Remove attachment", systemImage: "xmark.circle.fill") {
                                    composer.attachmentIDs.removeAll { $0 == id }
                                }.labelStyle(.iconOnly).frame(minWidth: 44, minHeight: 44)
                                    .accessibilityIdentifier("removeAttachment-" + id)
                            }
                            .font(.footnote)
                            .padding(.leading, 10)
                            .background(LumenPalette.elevated, in: .capsule)
                            .overlay(Capsule().strokeBorder(LumenPalette.stroke, lineWidth: 1))
                        }
                    }
                }.scrollIndicators(.hidden)
            }
            HStack(spacing: 14) {
                Menu {
                    PhotosPicker(selection: $photo, matching: .images, photoLibrary: .shared()) {
                        Label("Choose photo", systemImage: "photo")
                    }
                    Button("Choose file", systemImage: "folder") { filesOpen = true }
                    #if DEBUG && targetEnvironment(simulator)
                    if DebugIntegration.enabled {
                        Button("Add fixture text") { importFixture(image: false) }.accessibilityIdentifier("attachFixtureText")
                        Button("Add fixture photo") { importFixture(image: true) }.accessibilityIdentifier("attachFixturePhoto")
                    }
                    #endif
                } label: {
                    Label("Attach", systemImage: "plus.circle")
                        .font(LumenType.control)
                        .foregroundStyle(LumenPalette.accent)
                        .frame(minHeight: 44)
                }
                .disabled(!canAttach).accessibilityIdentifier("attachFile")
                if importing { ProgressView(); Text("Preparing attachment…").font(.caption).foregroundStyle(.secondary) }
                else if !composer.attachmentIDs.isEmpty { Text("\(composer.attachmentIDs.count) of 4 files").font(.caption).foregroundStyle(.secondary) }
            }
            if let error {
                HStack(alignment: .top) {
                    Text(error).font(.footnote).foregroundStyle(.red)
                    Button("Dismiss", systemImage: "xmark") { self.error = nil }.labelStyle(.iconOnly).frame(minWidth: 44, minHeight: 44)
                }.accessibilityIdentifier("attachmentError")
            }
        }
        .fileImporter(isPresented: $filesOpen, allowedContentTypes: [.image, .pdf, .text, .data], allowsMultipleSelection: false) { result in
            switch result {
            case .success(let urls): if let url = urls.first { prepare { try AttachmentImporter.fromURL(url) } }
            case .failure(let failure): if (failure as NSError).code != NSUserCancelledError { error = failure.localizedDescription }
            }
        }
        .onChange(of: photo) { _, item in
            guard let item else { return }
            let account = engine.accountID, chat = engine.currentConversation.id, temporary = engine.isTemporary
            importing = true; error = nil
            Task {
                defer { importing = false; photo = nil }
                do {
                    guard let data = try await item.loadTransferable(type: Data.self) else { throw AttachmentError.invalid }
                    let file = try await Task.detached { try AttachmentImporter.fromData(data, name: "Photo", type: .image) }.value
                    try accept(file, account: account, chat: chat, temporary: temporary)
                } catch { if engine.accountID == account && engine.currentConversation.id == chat { self.error = error.localizedDescription } }
            }
        }
        .sheet(item: $preview) { AttachmentPreview(file: $0) }
        .onChange(of: engine.accountID) { _, _ in preview = nil; error = nil }
        .onChange(of: engine.currentConversation.id) { _, _ in preview = nil; error = nil }
    }
    private func prepare(_ convert: @escaping @Sendable () throws -> ChatAttachment) {
        let account = engine.accountID, chat = engine.currentConversation.id, temporary = engine.isTemporary
        importing = true; error = nil
        Task {
            defer { importing = false }
            do { let file = try await Task.detached { try convert() }.value; try accept(file, account: account, chat: chat, temporary: temporary) }
            catch { if engine.accountID == account && engine.currentConversation.id == chat { self.error = error.localizedDescription } }
        }
    }
    private func accept(_ file: ChatAttachment, account: String, chat: String, temporary: Bool) throws {
        guard engine.accountID == account, engine.currentConversation.id == chat, engine.isTemporary == temporary,
              composer.accountID == account, composer.conversationID == chat, composer.isTemporary == temporary else { return }
        guard composer.attachmentIDs.count < 4 else { throw AttachmentError.tooMany }
        try engine.storeAttachment(file)
        composer.attachmentIDs.append(file.id)
    }
    #if DEBUG && targetEnvironment(simulator)
    private func importFixture(image: Bool) {
        prepare {
            if image {
                let data = Data(base64Encoded: "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGMwaDhAEmIY1TCqYfhqAAAUDXAQAvzJWwAAAABJRU5ErkJggg==")!
                return try AttachmentImporter.fromData(data, name: "fixture-photo.png", type: .png)
            }
            return try AttachmentImporter.fromData(Data("NATIVE_ATTACHMENT_FILE_CONTENT".utf8), name: "fixture-notes.txt", type: .plainText)
        }
    }
    #endif
}

struct AttachmentPreview: View {
    let file: ChatAttachment
    @Environment(\.dismiss) private var dismiss
    private var image: CGImage? {
        guard let data = file.data, let source = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
        return CGImageSourceCreateThumbnailAtIndex(source, 0, [kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true, kCGImageSourceThumbnailMaxPixelSize: 1200] as CFDictionary)
    }
    var body: some View {
        NavigationStack {
            ScrollView {
                if let image { Image(decorative: image, scale: 1).resizable().scaledToFit().padding().accessibilityLabel(file.name) }
                else { Text(file.text ?? "This file is unavailable on this iPhone.").textSelection(.enabled).frame(maxWidth: .infinity, alignment: .leading).padding() }
            }
            .navigationTitle(file.name).navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
    }
}
