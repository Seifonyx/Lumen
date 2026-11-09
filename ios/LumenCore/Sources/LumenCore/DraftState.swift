import Foundation
import Observation

@MainActor @Observable public final class DraftState {
    @ObservationIgnored private let store: any DraftStore
    @ObservationIgnored private let defaults: UserDefaults?
    @ObservationIgnored private var suppressSaving = false
    @ObservationIgnored private var readable = true
    @ObservationIgnored private var migrationKeys: [String] = []
    public private(set) var accountID = "device"
    public private(set) var conversationID = "new"
    public private(set) var isTemporary = false
    public private(set) var errorMessage: String?
    @ObservationIgnored private var volatileRecords: [String: ChatDraft] = [:]
    @ObservationIgnored private var recovery: [String: [String: ChatDraft]] = [:]
    private var records: [String: ChatDraft] = [:]
    public var draft = "" { didSet { if !suppressSaving { _ = save() } } }
    public var attachmentIDs: [String] = [] { didSet { if !suppressSaving { _ = save() } } }
    public var hasContent: Bool { !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !attachmentIDs.isEmpty }
    public var savedDrafts: [ChatDraft] { records.values.filter(\.hasContent).sorted { $0.updatedAt > $1.updatedAt } }

    public init(store: any DraftStore = FileDraftStore(), defaults: UserDefaults? = .standard) {
        self.store = store; self.defaults = defaults
        load(accountID: accountID, conversationID: conversationID)
    }

    /// Fails without switching when an ordinary draft cannot be saved. Temporary text never touches the store.
    @discardableResult public func activate(accountID: String, conversationID: String, temporary: Bool, force: Bool = false) -> Bool {
        guard self.accountID != accountID || self.conversationID != conversationID || isTemporary != temporary else { return true }
        let sameAccount = self.accountID == accountID
        let saved = save()
        if sameAccount, !saved, !force { return false }
        suppressSaving = true
        defer { suppressSaving = false }
        if self.accountID == accountID, self.conversationID == "new", !temporary,
           let initial = records["new"], records[conversationID] == nil {
            records[conversationID] = ChatDraft(conversationID: conversationID, text: initial.text, attachmentIDs: initial.attachmentIDs)
            records["new"] = nil
            do { try store.save(records, accountID: accountID) }
            catch {
                recovery[accountID] = records
                errorMessage = "The draft could not be moved. Its saved original is kept."
                if !force { return false }
            }
        }
        if self.accountID != accountID {
            self.accountID = accountID; records = [:]; volatileRecords = [:]; migrationKeys = []; readable = true
            do { records = try store.load(accountID: accountID); errorMessage = nil }
            catch { readable = false; errorMessage = "Saved drafts could not load. Reopen Lumen before editing." }
            if let unsaved = recovery[accountID] { records = unsaved; readable = true; errorMessage = "Recovered unsaved drafts. Tap Retry to save them." }
        }
        // Set mode before assigning text so no transient temporary value can be written.
        if !temporary { volatileRecords = [:] }
        isTemporary = temporary
        if temporary { errorMessage = nil }
        else if recovery[accountID] != nil { errorMessage = "Recovered unsaved drafts. Tap Retry to save them." }
        self.conversationID = conversationID
        let record = (temporary ? volatileRecords : records)[conversationID]
        draft = record?.text ?? ""
        attachmentIDs = record?.attachmentIDs ?? []
        if !temporary { migrateLegacyIfNeeded() }
        return true
    }

    /// The engine already owns this identity. Align even if saving the previous draft failed; keep its recovery in RAM.
    public func synchronize(accountID: String, conversationID: String, temporary: Bool) {
        _ = activate(accountID: accountID, conversationID: conversationID, temporary: temporary, force: true)
    }

    public func switchAccount(to id: String) { _ = activate(accountID: id, conversationID: "new", temporary: false) }

    @discardableResult public func save() -> Bool {
        if isTemporary { volatileRecords[conversationID] = ChatDraft(conversationID: conversationID, text: draft, attachmentIDs: attachmentIDs); return true }
        guard readable else { return false }
        var next = records
        let record = ChatDraft(conversationID: conversationID, text: draft, attachmentIDs: attachmentIDs)
        next[conversationID] = record.hasContent ? record : nil
        records = next
        do {
            try store.save(next, accountID: accountID)
            recovery[accountID] = nil; errorMessage = nil
            migrationKeys.forEach { defaults?.removeObject(forKey: $0) }; migrationKeys = []
            return true
        } catch { recovery[accountID] = next; errorMessage = "This iPhone could not save the draft. Free storage and tap Retry before leaving this chat."; return false }
    }

    @discardableResult public func discardDraft() -> Bool {
        let text = draft, attachments = attachmentIDs
        suppressSaving = true; draft = ""; attachmentIDs = []; suppressSaving = false
        guard save() else {
            suppressSaving = true; draft = text; attachmentIDs = attachments; suppressSaving = false
            return false
        }
        return true
    }

    private func load(accountID: String, conversationID: String) {
        suppressSaving = true; defer { suppressSaving = false }
        do { records = try store.load(accountID: accountID) }
        catch { readable = false; errorMessage = "Saved drafts could not load. Reopen Lumen before editing." }
        draft = records[conversationID]?.text ?? ""
        attachmentIDs = records[conversationID]?.attachmentIDs ?? []
        migrateLegacyIfNeeded()
    }

    private func migrateLegacyIfNeeded() {
        guard readable, !isTemporary, let defaults else { return }
        let key = "lumen.draft." + Data(accountID.utf8).base64EncodedString()
        let keys = accountID == "device" ? [key, "lumen.unsent-draft"] : [key]
        if let legacy = keys.compactMap({ defaults.string(forKey: $0) }).first, !legacy.isEmpty {
            // Preserve an existing protected draft and import legacy content as a separate accessible draft.
            if !hasContent { draft = legacy; migrationKeys = keys; _ = save() }
            else if draft != legacy {
                let id = "legacy-" + UUID().uuidString
                var next = records; next[id] = ChatDraft(conversationID: id, text: legacy)
                do { try store.save(next, accountID: accountID); records = next; keys.forEach { defaults.removeObject(forKey: $0) } }
                catch { errorMessage = "A legacy draft could not be migrated. Its original is kept." }
            } else { migrationKeys = keys; _ = save() }
        } else { keys.forEach { defaults.removeObject(forKey: $0) } }
    }
}
