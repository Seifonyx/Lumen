import Foundation
import ImageIO
import PDFKit
import UniformTypeIdentifiers
import LumenCore

/// Conversion runs off the UI actor; no imported URL is retained after the bounded read.
enum AttachmentImporter {
    static func fromURL(_ url: URL) throws -> ChatAttachment {
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        let values = try url.resourceValues(forKeys: [.fileSizeKey, .isRegularFileKey])
        guard values.isRegularFile == true else { throw AttachmentError.invalid }
        guard (values.fileSize ?? Int.max) <= 15_000_000 else { throw AttachmentError.tooLarge }
        return try fromData(Data(contentsOf: url), name: url.lastPathComponent, type: UTType(filenameExtension: url.pathExtension))
    }
    static func fromData(_ data: Data, name: String, type: UTType?) throws -> ChatAttachment {
        guard data.count <= 15_000_000 else { throw AttachmentError.tooLarge }
        if type?.conforms(to: .image) == true {
            guard let source = CGImageSourceCreateWithData(data as CFData, nil),
                  let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
                  let width = properties[kCGImagePropertyPixelWidth] as? Int,
                  let height = properties[kCGImagePropertyPixelHeight] as? Int,
                  width > 0, height > 0, width <= 40_000, height <= 40_000,
                  Double(width) * Double(height) <= 80_000_000 else { throw AttachmentError.invalid }
            var longest = 1600
            while longest >= 400 {
                let options: [CFString: Any] = [kCGImageSourceCreateThumbnailFromImageAlways: true,
                    kCGImageSourceCreateThumbnailWithTransform: true, kCGImageSourceThumbnailMaxPixelSize: longest]
                guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else { throw AttachmentError.invalid }
                let bytes = NSMutableData()
                guard let destination = CGImageDestinationCreateWithData(bytes, UTType.jpeg.identifier as CFString, 1, nil) else { throw AttachmentError.invalid }
                CGImageDestinationAddImage(destination, image, [kCGImageDestinationLossyCompressionQuality: 0.8] as CFDictionary)
                guard CGImageDestinationFinalize(destination) else { throw AttachmentError.invalid }
                if bytes.length <= 600_000 {
                    let file = ChatAttachment(name: String(name.prefix(150)) + (name.lowercased().hasSuffix(".jpg") ? "" : ".jpg"), kind: .image, mime: "image/jpeg", data: bytes as Data)
                    try file.validate(); return file
                }
                longest /= 2
            }
            throw AttachmentError.tooLarge
        }
        let text: String
        if type?.conforms(to: .pdf) == true {
            guard let pdf = PDFDocument(data: data), !pdf.isLocked, pdf.pageCount <= 100 else { throw AttachmentError.unsupported }
            text = pdf.string ?? ""
        } else {
            let extensions = Set(["txt","md","markdown","csv","tsv","json","html","xml","js","jsx","ts","tsx","py","java","c","cpp","h","go","rs","rb","php","sql","css","log","yaml","yml","toml","sh"])
            guard type?.conforms(to: .text) == true || extensions.contains((name as NSString).pathExtension.lowercased()) else { throw AttachmentError.unsupported }
            guard !data.contains(0), let string = String(data: data, encoding: .utf8) else { throw AttachmentError.invalid }
            text = string
        }
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw AttachmentError.unsupported }
        let file = ChatAttachment(name: String(name.prefix(160)), kind: .text, mime: "text/plain", text: text)
        try file.validate(); return file
    }
}
