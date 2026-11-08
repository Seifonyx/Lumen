import Foundation

struct SSEEvent: Equatable, Sendable {
    var name: String?
    var data: String
}

struct SSEDecoder {
    private var buffer = Data()
    private var dataLines: [String] = []
    private var eventName: String?
    private var eventBytes = 0
    private var isFirstLine = true
    private let limit = 2_000_000

    mutating func append(_ bytes: Data) throws -> [SSEEvent] {
        buffer.append(bytes)
        var events: [SSEEvent] = []
        while let newline = buffer.firstIndex(of: 10) {
            var lineBytes = Data(buffer[..<newline])
            buffer.removeSubrange(...newline)
            if lineBytes.last == 13 { lineBytes.removeLast() }
            guard var line = String(data: lineBytes, encoding: .utf8) else { throw ProviderRequestError.invalidResponse }
            if isFirstLine {
                if line.hasPrefix("\u{FEFF}") { line.removeFirst() }
                isFirstLine = false
            }
            if line.isEmpty {
                if !dataLines.isEmpty { events.append(SSEEvent(name: eventName, data: dataLines.joined(separator: "\n"))) }
                dataLines.removeAll(keepingCapacity: true)
                eventName = nil
                eventBytes = 0
                continue
            }
            if line.hasPrefix(":") { continue }
            let parts = line.split(separator: ":", maxSplits: 1, omittingEmptySubsequences: false)
            let field = parts[0]
            var value = parts.count > 1 ? String(parts[1]) : ""
            if value.hasPrefix(" ") { value.removeFirst() }
            switch field {
            case "event": eventName = value
            case "data":
                eventBytes += value.utf8.count
                guard eventBytes <= limit else { throw ProviderRequestError.responseTooLarge }
                dataLines.append(value)
            default: break
            }
        }
        guard buffer.count <= limit else { throw ProviderRequestError.responseTooLarge }
        return events
    }

    mutating func finish() throws -> [SSEEvent] {
        try append(Data("\n\n".utf8))
    }
}
