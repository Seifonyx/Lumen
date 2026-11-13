import UIKit
import Observation
@preconcurrency import UserNotifications
import LumenCore

/// Keeps a reply going for the time iOS allows after you leave Lumen, and tells you when it's done, as the AI
/// apps people know do. Notifications are local, made on this iPhone; nothing is sent to a server.
@MainActor @Observable final class ReplyNotifier: NSObject, UNUserNotificationCenterDelegate {
    static let enabledKey = "lumen.replyNotifications"
    private static let askedKey = "lumen.askedReplyNotifications"
    @ObservationIgnored private var backgroundTask: UIBackgroundTaskIdentifier = .invalid
    @ObservationIgnored private weak var engine: ChatEngine?

    /// Settings › Notifications; on unless you turn it off.
    private var enabled: Bool { UserDefaults.standard.object(forKey: Self.enabledKey) as? Bool ?? true }

    private var promptsAllowed: Bool {
        #if DEBUG && targetEnvironment(simulator)
        // UI tests: only the notification test meets the system's permission prompt.
        if DebugIntegration.enabled { return ProcessInfo.processInfo.arguments.contains("--lumen-notify-test") }
        #endif
        return true
    }

    func attach(to engine: ChatEngine) {
        self.engine = engine
        UNUserNotificationCenter.current().delegate = self
        engine.onReplyFinished = { [weak self] reply in self?.finished(reply) }
    }

    /// The first time you send, iOS asks whether Lumen may tell you when replies finish.
    func askOnce() {
        guard enabled, promptsAllowed, !UserDefaults.standard.bool(forKey: Self.askedKey) else { return }
        UserDefaults.standard.set(true, forKey: Self.askedKey)
        Task { _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) }
    }

    /// You left Lumen: a reply being written keeps going for as long as iOS allows, then stops and is saved.
    func enteredBackground() {
        guard let engine, engine.isStreaming else { return }
        guard backgroundTask == .invalid else { return }
        backgroundTask = UIApplication.shared.beginBackgroundTask(withName: "Finish reply") { [weak self] in
            MainActor.assumeIsolated {
                guard let self else { return }
                self.engine?.stopStreaming()
                _ = self.engine?.checkpoint()
                self.endBackgroundTask()
            }
        }
        if backgroundTask == .invalid { engine.stopStreaming(); _ = engine.checkpoint() }
    }

    func becameActive() {
        endBackgroundTask()
        UNUserNotificationCenter.current().removeAllDeliveredNotifications()
    }

    private func finished(_ reply: ReplyFinished) {
        defer { endBackgroundTask() }
        guard enabled, UIApplication.shared.applicationState != .active else { return }
        let content = UNMutableNotificationContent()
        // A temporary chat's words stay out of the lock screen.
        content.title = reply.temporary ? "Temporary chat" : reply.title
        content.body = reply.failed ? "The reply couldn't finish. Open Lumen to try again."
            : reply.temporary ? "Your reply is ready." : String(SpeechText.plain(reply.text).prefix(240))
        content.sound = .default
        content.threadIdentifier = reply.chatID
        content.userInfo = ["chatID": reply.chatID, "accountID": reply.accountID]
        let request = UNNotificationRequest(identifier: "reply-" + reply.chatID, content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request)
    }

    private func endBackgroundTask() {
        guard backgroundTask != .invalid else { return }
        UIApplication.shared.endBackgroundTask(backgroundTask)
        backgroundTask = .invalid
    }

    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [] // While you're in Lumen the reply is on screen already.
    }

    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        let info = response.notification.request.content.userInfo
        guard let chatID = info["chatID"] as? String, let accountID = info["accountID"] as? String else { return }
        await MainActor.run { LumenRequests.shared.openChat = ChatLink(accountID: accountID, chatID: chatID) }
    }
}
