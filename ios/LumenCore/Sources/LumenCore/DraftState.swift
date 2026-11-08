import Foundation
import Observation

@MainActor @Observable
public final class DraftState {
    @ObservationIgnored private let defaults: UserDefaults
    private static let key = "lumen.unsent-draft"

    public var draft: String {
        didSet { defaults.set(draft, forKey: Self.key) }
    }

    public var hasContent: Bool {
        !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    public init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        draft = defaults.string(forKey: Self.key) ?? ""
    }

    public func discardDraft() {
        draft = ""
    }
}
