import Foundation
import Observation
@preconcurrency import AVFoundation
@preconcurrency import Speech
import LumenCore

/// Voice input for the message box. Recognition runs on the iPhone only (`requiresOnDeviceRecognition`):
/// what you say is never sent to a server by Lumen.
@MainActor @Observable final class Dictation {
    enum State: Equatable { case idle, starting, listening }
    private(set) var state: State = .idle
    var errorMessage: String?
    /// Increases when listening starts and stops, for haptics.
    private(set) var changes = 0
    @ObservationIgnored private var session: DictationSession?
    @ObservationIgnored private var fake: Task<Void, Never>?
    @ObservationIgnored private var generation = 0

    var isActive: Bool { state != .idle }

    /// Starts listening; `update` receives the whole transcript so far, each time it changes.
    func start(update: @escaping @MainActor @Sendable (String) -> Void) {
        guard state == .idle else { return }
        generation += 1
        let ticket = generation
        errorMessage = nil
        state = .starting
        changes += 1
        #if DEBUG && targetEnvironment(simulator)
        if ProcessInfo.processInfo.arguments.contains("--lumen-fake-voice") {
            // UI tests: no microphone on the simulator; the transcript arrives in pieces, as when speaking.
            state = .listening
            fake = Task { @MainActor [weak self] in
                for words in ["Dictated", "Dictated fixture", "Dictated fixture question"] {
                    try? await Task.sleep(for: .milliseconds(250))
                    guard let self, self.generation == ticket, !Task.isCancelled else { return }
                    update(words)
                }
            }
            return
        }
        #endif
        Task { @MainActor [weak self] in
            guard let self else { return }
            guard await DictationSession.authorize() else {
                guard self.generation == ticket else { return }
                self.finish(error: "Allow Microphone and Speech Recognition for Lumen in Settings to talk instead of typing.")
                return
            }
            guard self.generation == ticket else { return }
            do {
                self.session = try DictationSession.begin { [weak self] text, done, failed in
                    guard let self, self.generation == ticket else { return }
                    if let text { update(text) }
                    if done { self.finish(error: failed ? "Lumen couldn't hear that. Try again, a little closer to the microphone." : nil) }
                }
                self.state = .listening
            } catch let error as DictationSession.Unavailable {
                self.finish(error: error.message)
            } catch {
                self.finish(error: "The microphone isn't available right now. Try again in a moment.")
            }
        }
    }

    func stop() {
        guard state != .idle else { return }
        finish(error: nil)
    }

    private func finish(error: String?) {
        generation += 1
        fake?.cancel(); fake = nil
        session?.end(); session = nil
        if state != .idle { changes += 1 }
        state = .idle
        errorMessage = error
    }
}

/// One recording: the microphone feeds Apple's on-device recogniser until it is ended.
/// Built outside the main actor: the audio tap and recognition callbacks run on their own queues.
final class DictationSession: @unchecked Sendable {
    struct Unavailable: Error { let message: String }
    private let engine = AVAudioEngine()
    private let request = SFSpeechAudioBufferRecognitionRequest()
    private var task: SFSpeechRecognitionTask?

    static func authorize() async -> Bool {
        let speech = await withCheckedContinuation { (done: CheckedContinuation<Bool, Never>) in
            SFSpeechRecognizer.requestAuthorization { done.resume(returning: $0 == .authorized) }
        }
        guard speech else { return false }
        return await AVAudioApplication.requestRecordPermission()
    }

    /// `update(text, finished, failed)` is delivered on the main actor.
    static func begin(update: @escaping @MainActor @Sendable (String?, Bool, Bool) -> Void) throws -> DictationSession {
        guard let recognizer = SFSpeechRecognizer(locale: Locale.current) ?? SFSpeechRecognizer(), recognizer.isAvailable else {
            throw Unavailable(message: "Voice input isn't available for your iPhone's language. Use the keyboard's microphone instead.")
        }
        guard recognizer.supportsOnDeviceRecognition else {
            throw Unavailable(message: "Voice input works on this iPhone once its dictation language is downloaded (Settings › General › Keyboard › Dictation). The keyboard's microphone works meanwhile.")
        }
        let session = DictationSession()
        try session.run(recognizer: recognizer, update: update)
        return session
    }

    private func run(recognizer: SFSpeechRecognizer, update: @escaping @MainActor @Sendable (String?, Bool, Bool) -> Void) throws {
        let audio = AVAudioSession.sharedInstance()
        try audio.setCategory(.record, mode: .measurement, options: .duckOthers)
        try audio.setActive(true, options: .notifyOthersOnDeactivation)
        request.shouldReportPartialResults = true
        request.requiresOnDeviceRecognition = true
        request.addsPunctuation = true
        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        let request = self.request
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in request.append(buffer) }
        engine.prepare()
        try engine.start()
        task = recognizer.recognitionTask(with: request) { result, error in
            let text = result?.bestTranscription.formattedString
            let done = error != nil || (result?.isFinal ?? false)
            // Ending it ourselves reports a cancellation, not a failure; silence with no words is a failure.
            let failed = error != nil && (text ?? "").isEmpty && (error as NSError?)?.code != 216 && (error as NSError?)?.code != 301
            Task { @MainActor in update(text, done, failed) }
        }
    }

    func end() {
        engine.stop()
        engine.inputNode.removeTap(onBus: 0)
        request.endAudio()
        task?.finish()
        task = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}

/// Reads a reply aloud with the iPhone's own voices (nothing leaves the phone). One reply at a time.
@MainActor @Observable final class ReadAloud: NSObject, AVSpeechSynthesizerDelegate {
    private(set) var speakingID: String?
    @ObservationIgnored private let synthesizer = AVSpeechSynthesizer()
    private var fake: Bool {
        #if DEBUG && targetEnvironment(simulator)
        ProcessInfo.processInfo.arguments.contains("--lumen-fake-voice")
        #else
        false
        #endif
    }

    override init() {
        super.init()
        synthesizer.delegate = self
    }

    func toggle(id: String, markdown: String) {
        if speakingID == id { stop(); return }
        stop()
        let text = SpeechText.plain(markdown)
        guard !text.isEmpty else { return }
        speakingID = id
        guard !fake else { return }
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio, options: .duckOthers)
        try? AVAudioSession.sharedInstance().setActive(true)
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: AVSpeechSynthesisVoice.currentLanguageCode())
        synthesizer.speak(utterance)
    }

    func stop() {
        guard speakingID != nil else { return }
        speakingID = nil
        if synthesizer.isSpeaking { synthesizer.stopSpeaking(at: .immediate) }
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        Task { @MainActor in self.finished() }
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        Task { @MainActor in self.finished() }
    }

    private func finished() {
        guard !synthesizer.isSpeaking else { return }
        speakingID = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}
