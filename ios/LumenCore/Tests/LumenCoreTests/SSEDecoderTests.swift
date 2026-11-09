import Foundation
import Testing
@testable import LumenCore

@Suite struct SSEDecoderTests {
    @Test func fragmentedUnicodeAndCRLFArePreserved() throws {
        var parser = SSEDecoder()
        let bytes = Array("data: مرحباً 🌍\r\n\r\n".utf8)
        var events: [SSEEvent] = []
        for byte in bytes { events += try parser.append(Data([byte])) }
        #expect(events.map(\.data) == ["مرحباً 🌍"])
    }

    @Test func multilineDataAndEventTypeAreCombined() throws {
        var parser = SSEDecoder()
        let events = try parser.append(Data(": keepalive\nevent: content_block_delta\ndata: first\ndata: second\n\n".utf8))
        #expect(events.count == 1)
        #expect(events.first?.name == "content_block_delta")
        #expect(events.first?.data == "first\nsecond")
    }

    @Test func finalEventWithoutTrailingBlankLineIsDelivered() throws {
        var parser = SSEDecoder()
        #expect(try parser.append(Data("data: [DONE]".utf8)).isEmpty)
        #expect(try parser.finish().map(\.data) == ["[DONE]"])
    }

    @Test func oversizedUnterminatedEventIsRejected() throws {
        var parser = SSEDecoder()
        #expect(throws: (any Error).self) {
            _ = try parser.append(Data(repeating: 65, count: 2_000_001))
        }
    }
}
