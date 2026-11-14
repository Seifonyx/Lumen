import AppIntents
import Observation
import LumenCore

// Compiled into the app and its widgets: Control Center buttons and widget buttons name these intents, and iOS
// runs them in the app (each opens Lumen).

/// Something Siri, a Shortcut or a link asked of Lumen; the chat screen carries it out once the account is known.
struct ComposerRequest: Equatable, Identifiable {
    let id = UUID()
    var text: String?
    /// Only Siri and Shortcuts (which you set up yourself) may send; links only fill in the message.
    var send = false
    var dictate = false
}

@MainActor @Observable final class LumenRequests {
    static let shared = LumenRequests()
    var pending: ComposerRequest?
    /// A reply notification you tapped: open that chat.
    var openChat: ChatLink?
}

struct ChatLink: Equatable, Sendable {
    let accountID: String
    let chatID: String
}

struct AskLumenIntent: AppIntent {
    static let title: LocalizedStringResource = "Ask Lumen"
    static let description = IntentDescription("Starts a new chat in Lumen and sends your question to the model you're using.")
    static let openAppWhenRun = true

    @Parameter(title: "Question", requestValueDialog: "What would you like to ask?")
    var question: String

    static var parameterSummary: some ParameterSummary { Summary("Ask Lumen \(\.$question)") }

    @MainActor func perform() async throws -> some IntentResult {
        LumenRequests.shared.pending = ComposerRequest(text: LumenLink.clean(question), send: true)
        return .result()
    }
}

struct NewLumenChatIntent: AppIntent {
    static let title: LocalizedStringResource = "New Lumen Chat"
    static let description = IntentDescription("Opens a new chat in Lumen, ready to type.")
    static let openAppWhenRun = true

    @MainActor func perform() async throws -> some IntentResult {
        LumenRequests.shared.pending = ComposerRequest()
        return .result()
    }
}

struct TalkToLumenIntent: AppIntent {
    static let title: LocalizedStringResource = "Talk to Lumen"
    static let description = IntentDescription("Opens a new chat in Lumen and starts listening, so you can say your message.")
    static let openAppWhenRun = true

    @MainActor func perform() async throws -> some IntentResult {
        LumenRequests.shared.pending = ComposerRequest(dictate: true)
        return .result()
    }
}
