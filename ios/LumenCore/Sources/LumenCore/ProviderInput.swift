import Foundation

/// Provider wire formats are kept separate from transport so attachments can be verified without network calls.
public enum ProviderInput {
    public static func body(messages: [ChatMessage], model: AIModel) throws -> [String: Any] {
        for message in messages {
            for file in message.attachments ?? [] {
                try file.validate()
                if file.kind == .image && !model.supportsImages { throw AttachmentError.modelCannotReadImages }
            }
        }
        let system = messages.filter { $0.role == .system }.map(\.content).joined(separator: "\n")
        let conversation = messages.filter { $0.role != .system }
        func text(_ message: ChatMessage) -> String {
            ([message.content] + (message.attachments ?? []).filter { $0.kind == .text }.map {
                "\n\nAttached file: \($0.name)\n\($0.text ?? "")\nEnd of attached file."
            }).joined()
        }
        func images(_ message: ChatMessage) -> [ChatAttachment] { (message.attachments ?? []).filter { $0.kind == .image } }
        switch model.providerId {
        case "gemini":
            var body: [String: Any] = ["contents": conversation.map { message -> [String: Any] in
                var parts: [[String: Any]] = [["text": text(message)]]
                parts += images(message).map { ["inlineData": ["mimeType": $0.mime, "data": $0.data!.base64EncodedString()]] }
                return ["role": message.role == .assistant ? "model" : "user", "parts": parts]
            }]
            if !system.isEmpty { body["systemInstruction"] = ["parts": [["text": system]]] }
            return body
        case "anthropic":
            var body: [String: Any] = ["model": model.id, "stream": true, "max_tokens": 8192,
                                      "messages": conversation.map { message -> [String: Any] in
                let photos = images(message)
                if photos.isEmpty { return ["role": message.role.rawValue, "content": text(message)] }
                var content: [[String: Any]] = [["type": "text", "text": text(message).isEmpty ? "Review the attached image." : text(message)]]
                content += photos.map { ["type": "image", "source": ["type": "base64", "media_type": $0.mime, "data": $0.data!.base64EncodedString()]] }
                return ["role": message.role.rawValue, "content": content]
            }]
            if !system.isEmpty { body["system"] = system }
            return body
        case "groq", "openai":
            return ["model": model.id, "stream": true, "messages": messages.map { message -> [String: Any] in
                let photos = images(message)
                if photos.isEmpty { return ["role": message.role.rawValue, "content": text(message)] }
                var content: [[String: Any]] = [["type": "text", "text": text(message).isEmpty ? "Review the attached image." : text(message)]]
                content += photos.map { ["type": "image_url", "image_url": ["url": "data:\($0.mime);base64,\($0.data!.base64EncodedString())"]] }
                return ["role": message.role.rawValue, "content": content]
            }]
        default: throw ProviderRequestError.unsupportedProvider(model.providerId)
        }
    }
}
