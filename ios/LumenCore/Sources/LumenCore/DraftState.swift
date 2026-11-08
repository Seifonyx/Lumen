import Foundation
import Observation

@MainActor @Observable
public final class DraftState {
    @ObservationIgnored private let defaults: UserDefaults
    private var accountID = "device"
    private var key: String { "lumen.draft." + Data(accountID.utf8).base64EncodedString() }

    public var draft: String {
        didSet { defaults.set(draft, forKey: key) }
    }

    public var hasContent: Bool {
        !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    public init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        draft = ""
        draft = defaults.string(forKey: key) ?? defaults.string(forKey: "lumen.unsent-draft") ?? ""
        defaults.removeObject(forKey: "lumen.unsent-draft")
    }

    public func switchAccount(to id: String) {
        guard id != accountID else { return }
        accountID = id
        draft = defaults.string(forKey: key) ?? ""
    }

    public func discardDraft() {
        draft = ""
    }
}
