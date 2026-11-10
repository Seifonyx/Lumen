import Foundation
@testable import LumenCore

@MainActor final class MemoryDraftStore: DraftStore {
    var accounts: [String: [String: ChatDraft]] = [:]
    var failWrites = false
    func load(accountID: String) throws -> [String: ChatDraft] { accounts[accountID] ?? [:] }
    func save(_ drafts: [String: ChatDraft], accountID: String) throws {
        if failWrites { throw CocoaError(.fileWriteOutOfSpace) }
        accounts[accountID] = drafts
    }
}
