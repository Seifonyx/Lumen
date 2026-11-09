import XCTest

@MainActor
final class LumenUITests: XCTestCase {
    private static var verifiedSimulatorInput = false
    private let app = XCUIApplication()
    private var composer: XCUIElement {
        app.descendants(matching: .any).matching(identifier: "messageComposer").firstMatch
    }

    private func launchCleanChat() {
        continueAfterFailure = false
        app.launchArguments = ["--lumen-integration", "--lumen-reset-qa", "-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()
        app.launchArguments.removeAll { $0 == "--lumen-reset-qa" }
        XCTAssertTrue(app.buttons["openSidebar"].waitForExistence(timeout: 10))
        if !Self.verifiedSimulatorInput {
            // On a fresh runtime, bootstatus may finish while Apple's boot overlay still swallows taps.
            // Require an observed response to input before starting the journeys, rather than sleeping.
            executionTimeAllowance = 600
            let deadline = Date().addingTimeInterval(300)
            while !app.buttons["openSettings"].exists && Date() < deadline {
                app.buttons["openSidebar"].tap()
                if app.buttons["openSettings"].waitForExistence(timeout: 5) { break }
            }
            XCTAssertTrue(app.buttons["openSettings"].exists, "The simulator did not become interactive after boot")
            app.buttons["sidebarCloseButton"].tap()
            XCTAssertTrue(app.buttons["openSettings"].waitForNonExistence(timeout: 5))
            XCTAssertTrue(app.buttons["openSidebar"].isHittable)
            Self.verifiedSimulatorInput = true
        }
        newChat()
    }

    override func tearDown() {
        if (testRun?.failureCount ?? 0) > 0 {
            let screenshot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
            screenshot.name = "failure-screen"
            screenshot.lifetime = .keepAlways
            add(screenshot)
        }
        super.tearDown()
    }

    private func newChat() {
        app.buttons["newChat"].tap()
        if app.buttons["Discard draft"].waitForExistence(timeout: 1) {
            app.buttons["Discard draft"].tap()
        }
        XCTAssertTrue(composer.waitForExistence(timeout: 3))
    }

    private func settings() {
        app.buttons["openSidebar"].tap()
        XCTAssertTrue(app.buttons["openSettings"].waitForExistence(timeout: 3))
        app.buttons["openSettings"].tap()
        XCTAssertTrue(app.navigationBars["Settings"].waitForExistence(timeout: 3))
    }

    private func appearance(_ name: String) {
        settings()
        app.segmentedControls.buttons[name].tap()
        app.buttons["Done"].tap()
        XCTAssertTrue(app.buttons["openSidebar"].waitForExistence(timeout: 3))
    }

    private func capture(_ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    private func enterDraft(_ text: String) {
        composer.tap()
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 10),
                      "The software keyboard must be ready before typing")
        composer.typeText(text)
    }

    func testDraftSurvivesWorkspaceNavigationAndRelaunch() {
        launchCleanChat()
        defer { app.terminate() }
        enterDraft("Keep this draft")
        app.buttons["openSidebar"].tap()
        app.buttons["sidebar-library"].tap()
        XCTAssertTrue(app.navigationBars["Library"].waitForExistence(timeout: 3))
        app.navigationBars.buttons.element(boundBy: 0).tap()
        XCTAssertEqual(composer.value as? String, "Keep this draft")
        app.terminate()
        app.launch()
        XCTAssertTrue(composer.waitForExistence(timeout: 10))
        XCTAssertEqual(composer.value as? String, "Keep this draft")
    }

    func testNewChatKeepsAnIndependentDraftAndRestoresIt() {
        launchCleanChat()
        defer { app.terminate() }
        enterDraft("First independent draft")
        app.buttons["newChat"].tap()
        XCTAssertNotEqual(composer.value as? String, "First independent draft")
        enterDraft("Second independent draft")
        app.buttons["openSidebar"].tap()
        app.buttons["First independent draft"].tap()
        XCTAssertEqual(composer.value as? String, "First independent draft")
        capture("restored-conversation-draft")
        app.terminate(); app.launch()
        XCTAssertTrue(composer.waitForExistence(timeout: 10))
        XCTAssertEqual(composer.value as? String, "First independent draft")
        app.buttons["openSidebar"].tap()
        app.buttons["Second independent draft"].tap()
        XCTAssertEqual(composer.value as? String, "Second independent draft")
    }

    func testTemporaryConversationClearsOnLeavingAndNeverAppearsInHistory() {
        executionTimeAllowance = 180
        launchCleanChat()
        defer { app.terminate() }
        signInAndChooseModel()
        app.buttons["openSidebar"].tap()
        app.buttons["newTemporaryChat"].tap()
        XCTAssertTrue(app.staticTexts["temporaryChatIndicator"].waitForExistence(timeout: 5))
        enterDraft("LUMEN_TEMPORARY_SECRET")
        app.buttons["sendMessage"].tap()
        XCTAssertTrue(app.staticTexts["A native streamed reply."].waitForExistence(timeout: 15))
        capture("temporary-conversation")
        app.buttons["newChat"].tap()
        XCTAssertTrue(app.alerts["Leave temporary chat?"].waitForExistence(timeout: 3))
        app.buttons["Cancel"].tap()
        XCTAssertTrue(app.staticTexts["LUMEN_TEMPORARY_SECRET"].exists)
        app.buttons["newChat"].tap(); app.buttons["Leave and clear"].tap()
        XCTAssertFalse(app.staticTexts["LUMEN_TEMPORARY_SECRET"].exists)
        app.terminate(); app.launch()
        XCTAssertTrue(composer.waitForExistence(timeout: 10))
        XCTAssertFalse(app.staticTexts["temporaryChatIndicator"].exists)
        app.buttons["openSidebar"].tap()
        XCTAssertFalse(app.buttons["LUMEN_TEMPORARY_SECRET"].exists)
        app.buttons["sidebarCloseButton"].tap()
        settings()
        XCTAssertTrue(app.staticTexts["Up to date"].waitForExistence(timeout: 15))
    }

    func testComposerStaysAboveKeyboardAndDoesNotSubmitWithoutAModel() {
        launchCleanChat()
        defer { app.terminate() }
        enterDraft("A draft above the keyboard")
        let keyboard = app.keyboards.firstMatch
        XCTAssertTrue(keyboard.waitForExistence(timeout: 3))
        XCTAssertTrue(composer.isHittable)
        XCTAssertLessThanOrEqual(composer.frame.maxY, keyboard.frame.minY + 2)
        XCTAssertFalse(app.buttons["sendMessage"].isEnabled)
        XCTAssertEqual(app.tabBars.count, 0)
        capture("chat-keyboard")
        app.buttons["hideKeyboard"].tap()
        XCTAssertEqual(composer.value as? String, "A draft above the keyboard")
    }

    func testNativeScreensInLightAndDark() {
        // Capture both themes and navigate every screen without XCTest killing
        // the journey during slower hosted simulator accessibility operations.
        executionTimeAllowance = 240
        launchCleanChat()
        defer { app.terminate() }
        for theme in ["Light", "Dark"] {
            appearance(theme)
            capture("chat-\(theme.lowercased())")
            app.buttons["chooseModel"].tap()
            XCTAssertTrue(app.navigationBars["Models"].waitForExistence(timeout: 3))
            capture("models-\(theme.lowercased())")
            app.buttons["Done"].tap()
            app.buttons["openSidebar"].tap()
            XCTAssertTrue(app.buttons["sidebar-projects"].waitForExistence(timeout: 3))
            capture("sidebar-\(theme.lowercased())")
            let projects = app.buttons["sidebar-projects"]
            XCTAssertTrue(projects.isHittable)
            // The empty trailing part must work just like the icon and title.
            projects.coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.5)).tap()
            XCTAssertTrue(app.navigationBars["Projects"].waitForExistence(timeout: 3))
            capture("projects-\(theme.lowercased())")
            app.navigationBars.buttons.element(boundBy: 0).tap()
            settings()
            capture("settings-\(theme.lowercased())")
            app.buttons["Done"].tap()
        }
    }
    func testConnectProviderWithAValidKeyAndSend() {
        launchCleanChat()
        defer { app.terminate() }
        settings()
        app.buttons["providerSettings"].tap()
        app.buttons["provider-groq"].tap()
        let key = app.secureTextFields["apiKeyField"]
        XCTAssertTrue(key.waitForExistence(timeout: 5))
        key.tap()
        key.typeText("fixture-provider-key")
        app.buttons["connectProvider"].tap()
        if !app.staticTexts["Available models"].waitForExistence(timeout: 15) {
            capture("direct-provider-failure")
            XCTFail("Direct provider connection unavailable: " + app.debugDescription)
            return
        }
        capture("direct-provider-connected")
        app.navigationBars["Groq"].buttons["BackButton"].tap()
        app.navigationBars["Models & providers"].buttons["BackButton"].tap()
        app.navigationBars["Settings"].buttons["Done"].tap()
        app.buttons["chooseModel"].tap()
        let model = app.buttons["model-groq-fixture-model"]
        XCTAssertTrue(model.waitForExistence(timeout: 5))
        model.tap()
        enterDraft("Manual provider check")
        app.buttons["sendMessage"].tap()
        XCTAssertTrue(app.staticTexts["A native streamed reply."].waitForExistence(timeout: 10))
        capture("direct-provider-reply")
    }

    private func signInAndChooseModel() {
        settings()
        let signIn = app.buttons["googleSignIn"]
        XCTAssertTrue(signIn.waitForExistence(timeout: 5))
        signIn.tap()
        XCTAssertTrue(app.staticTexts["Native QA"].waitForExistence(timeout: 15))
        app.buttons["Done"].tap()
        app.buttons["chooseModel"].tap()
        let model = app.buttons["model-groq-fixture-model"]
        // A cold emulator connection can report unavailable once; exercise the visible recovery action.
        let reload = app.buttons["Load account providers"]
        let deadline = Date().addingTimeInterval(25)
        while !model.exists && !reload.exists && Date() < deadline {
            if model.waitForExistence(timeout: 1) { break }
        }
        if !model.exists && reload.exists { reload.tap() }
        if !model.waitForExistence(timeout: 20) {
            capture("model-import-failure")
            XCTFail("Connected model unavailable: " + app.debugDescription)
            return
        }
        model.tap()
    }

    func testAttachmentsPreviewRestoreAndSendActualTextAndImageBytes() {
        executionTimeAllowance = 240
        launchCleanChat()
        defer { app.terminate() }
        signInAndChooseModel()
        app.buttons["attachFile"].tap(); app.buttons["attachFixtureText"].tap()
        let preview = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "previewAttachment-")).firstMatch
        XCTAssertTrue(preview.waitForExistence(timeout: 10))
        preview.tap()
        XCTAssertTrue(app.staticTexts["NATIVE_ATTACHMENT_FILE_CONTENT"].waitForExistence(timeout: 5))
        capture("attachment-text-preview")
        app.buttons["Done"].tap()
        app.terminate(); app.launch()
        XCTAssertTrue(app.buttons["attachFile"].waitForExistence(timeout: 10))
        XCTAssertTrue(preview.exists)
        app.buttons["attachFile"].tap(); app.buttons["attachFixturePhoto"].tap()
        let chips = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "previewAttachment-"))
        XCTAssertTrue(chips.element(boundBy: 1).waitForExistence(timeout: 10))
        app.buttons["chooseModel"].tap()
        let vision = app.buttons["model-groq-meta-llama/llama-4-scout-17b-16e-instruct"]
        XCTAssertTrue(vision.waitForExistence(timeout: 10)); vision.tap()
        enterDraft("Review these native attachments")
        capture("attachment-composer")
        app.buttons["sendMessage"].tap()
        XCTAssertTrue(app.staticTexts["A native streamed reply."].waitForExistence(timeout: 15))
        settings()
        XCTAssertTrue(app.staticTexts["Up to date"].waitForExistence(timeout: 20))
    }

    func testALongHistoryLoadsOlderAndSendsOnlyBoundedRecentContext() {
        executionTimeAllowance = 240
        launchCleanChat()
        defer { app.terminate() }
        signInAndChooseModel()
        app.buttons["openSidebar"].tap()
        let history = app.buttons["history-long-fixture"]
        XCTAssertTrue(history.waitForExistence(timeout: 10)); history.tap()
        // The history row is visible as soon as Firestore metadata arrives, but the
        // first 60 message documents load asynchronously. Wait for real page readiness.
        let older = app.buttons["loadEarlierMessages"]
        XCTAssertTrue(older.waitForExistence(timeout: 45), "The latest history page never became ready")
        let count = app.staticTexts["loadedMessageCount"]
        let firstPage = XCTNSPredicateExpectation(predicate: NSPredicate(format: "label == %@", "60 of 180"), object: count)
        XCTAssertEqual(XCTWaiter.wait(for: [firstPage], timeout: 15), .completed)
        older.tap()
        let secondPage = XCTNSPredicateExpectation(predicate: NSPredicate(format: "label == %@", "120 of 180"), object: count)
        XCTAssertEqual(XCTWaiter.wait(for: [secondPage], timeout: 25), .completed)
        capture("long-conversation-page")
        enterDraft("NATIVE_LONG_FOLLOWUP")
        app.buttons["sendMessage"].tap()
        XCTAssertTrue(app.staticTexts["A native streamed reply."].waitForExistence(timeout: 15))
        XCTAssertTrue(app.staticTexts["boundedContextNotice"].exists)
        capture("long-conversation-bounded-context")
        app.terminate(); app.launch()
        XCTAssertTrue(composer.waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["NATIVE_LONG_FOLLOWUP"].waitForExistence(timeout: 15))
        settings(); XCTAssertTrue(app.staticTexts["Up to date"].waitForExistence(timeout: 20))
    }

    func testConnectedDeleteCleansTheCloudConversation() {
        launchCleanChat()
        defer { app.terminate() }
        signInAndChooseModel()
        app.buttons["openSidebar"].tap()
        let target = app.buttons["history-delete-fixture"]
        XCTAssertTrue(target.waitForExistence(timeout: 10))
        target.press(forDuration: 1)
        app.buttons["Delete chat"].tap()
        XCTAssertTrue(app.alerts["Delete chat?"].waitForExistence(timeout: 3))
        capture("delete-confirmation")
        app.alerts.buttons["Delete"].tap()
        settings()
        XCTAssertTrue(app.staticTexts["Up to date"].waitForExistence(timeout: 15))
        app.buttons["Done"].tap()
        app.buttons["openSidebar"].tap()
        XCTAssertFalse(target.exists)
        capture("deleted-chat-history")
    }

    func testConnectedSendWebHistorySyncAndSignOut() {
        executionTimeAllowance = 180
        launchCleanChat()
        defer { app.terminate() }
        signInAndChooseModel()
        enterDraft("A native question")
        XCTAssertTrue(app.buttons["sendMessage"].isEnabled)
        app.buttons["sendMessage"].tap()
        XCTAssertTrue(app.staticTexts["A native streamed reply."].waitForExistence(timeout: 15))
        XCTAssertNotEqual(composer.value as? String, "A native question")
        capture("connected-reply")
        app.buttons["openSidebar"].tap()
        let webChat = app.buttons["history-web-fixture"]
        XCTAssertTrue(webChat.waitForExistence(timeout: 10))
        webChat.tap()
        XCTAssertTrue(app.staticTexts["An existing web reply."].waitForExistence(timeout: 15))
        enterDraft("Native follow-up")
        app.buttons["sendMessage"].tap()
        XCTAssertTrue(app.staticTexts["A native streamed reply."].waitForExistence(timeout: 15))
        settings()
        XCTAssertTrue(app.staticTexts["Up to date"].waitForExistence(timeout: 15))
        app.buttons["Done"].tap()
        capture("web-history-with-native-reply")
        app.terminate()
        app.launch()
        XCTAssertTrue(app.buttons["openSidebar"].waitForExistence(timeout: 10))
        app.buttons["openSidebar"].tap()
        XCTAssertTrue(webChat.waitForExistence(timeout: 15))
        webChat.tap()
        XCTAssertTrue(app.staticTexts["Native follow-up"].waitForExistence(timeout: 15))
        settings()
        app.buttons["signOut"].tap()
        XCTAssertTrue(app.buttons["googleSignIn"].waitForExistence(timeout: 5))
        app.buttons["Done"].tap()
        app.buttons["openSidebar"].tap()
        XCTAssertFalse(webChat.exists, "Signed-out history must not expose the account's chats")
        capture("signed-out-private-history")
    }

    func testConnectedStopPersistsPartialReplyAfterRelaunch() {
        // Cold simulator process shutdown and restart can exceed XCTest's global
        // 120s limit. Preserve the real stop/relaunch assertions instead of
        // treating normal iOS process lifecycle work as a failed app test.
        executionTimeAllowance = 240
        launchCleanChat()
        defer { app.terminate() }
        signInAndChooseModel()
        enterDraft("Stop this reply")
        app.buttons["sendMessage"].tap()
        let partial = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Partial reply.")).firstMatch
        XCTAssertTrue(partial.waitForExistence(timeout: 10))
        app.buttons["stopStreaming"].tap()
        XCTAssertTrue(app.staticTexts["Stopped"].waitForExistence(timeout: 3))
        capture("stopped-reply")
        app.terminate()
        app.launch()
        XCTAssertTrue(app.buttons["openSidebar"].waitForExistence(timeout: 10))
        app.buttons["openSidebar"].tap()
        let history = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Stop this reply")).firstMatch
        XCTAssertTrue(history.waitForExistence(timeout: 15))
        history.tap()
        XCTAssertTrue(app.staticTexts["Stopped"].waitForExistence(timeout: 10))
        XCTAssertTrue(partial.exists)
        XCTAssertFalse(app.buttons["stopStreaming"].exists)
    }

    func testEditRegenerateAndReturnToTheOriginalVersion() {
        executionTimeAllowance = 240
        launchCleanChat()
        defer { app.terminate() }
        signInAndChooseModel()
        app.buttons["openSidebar"].tap()
        app.buttons["history-revision-fixture"].tap()
        XCTAssertTrue(app.staticTexts["A native streamed reply."].waitForExistence(timeout: 15))
        let edit = app.buttons["Edit message"].firstMatch
        let ready = XCTNSPredicateExpectation(predicate: NSPredicate(format: "enabled == true"), object: edit)
        XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 20), .completed)
        edit.tap()
        let editor = app.textViews["editedPrompt"]
        XCTAssertTrue(editor.waitForExistence(timeout: 5))
        editor.coordinate(withNormalizedOffset: CGVector(dx: 0.95, dy: 0.08)).tap()
        editor.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: "Original revision question".count))
        editor.typeText("Edited revision question")
        app.buttons["sendEditedPrompt"].tap()
        XCTAssertTrue(app.staticTexts["Edited revision question"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["A native streamed reply."].waitForExistence(timeout: 15))
        capture("edited-conversation")
        let regenerate = app.buttons["Regenerate response"].firstMatch
        let synced = XCTNSPredicateExpectation(predicate: NSPredicate(format: "enabled == true"), object: regenerate)
        XCTAssertEqual(XCTWaiter.wait(for: [synced], timeout: 20), .completed)
        regenerate.tap()
        XCTAssertTrue(app.staticTexts["A native streamed reply."].waitForExistence(timeout: 15))
        if app.buttons["hideKeyboard"].exists { app.buttons["hideKeyboard"].tap() }
        let versions = app.buttons["conversationVersions"]
        XCTAssertTrue(versions.waitForExistence(timeout: 10))
        let done = XCTNSPredicateExpectation(predicate: NSPredicate(format: "enabled == true"), object: versions)
        XCTAssertEqual(XCTWaiter.wait(for: [done], timeout: 20), .completed)
        versions.tap()
        app.buttons["Version 1 · Original"].tap()
        XCTAssertTrue(app.staticTexts["Original revision question"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.staticTexts["Edited revision question"].exists)
        capture("message-versions-original")
        settings()
        XCTAssertTrue(app.staticTexts["Up to date"].waitForExistence(timeout: 15))
    }

    func testHistoryRenamePinArchiveAndSearchCachedMessages() {
        executionTimeAllowance = 240
        launchCleanChat()
        defer { app.terminate() }
        signInAndChooseModel()
        app.buttons["openSidebar"].tap()
        let row = app.buttons["history-metadata-fixture"]
        XCTAssertTrue(row.waitForExistence(timeout: 10))
        row.tap()
        // Firestore message documents may arrive after their chat metadata on a
        // cold iOS simulator. Wait for the actual message, not merely the sidebar
        // row that appears when metadata is received.
        XCTAssertTrue(app.staticTexts["Recovery notes from last winter"].waitForExistence(timeout: 60),
                      "Opening a synced chat must eventually load its message documents")
        app.buttons["openSidebar"].tap()
        row.press(forDuration: 1)
        app.buttons["Rename"].tap()
        let name = app.textFields["conversationName"]
        XCTAssertTrue(name.waitForExistence(timeout: 5))
        name.coordinate(withNormalizedOffset: CGVector(dx: 0.97, dy: 0.5)).tap()
        name.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: "History management fixture".count))
        name.typeText("Renamed training chat")
        app.buttons["saveConversationName"].tap()
        XCTAssertTrue(app.staticTexts["Renamed training chat"].waitForExistence(timeout: 5))
        row.press(forDuration: 1)
        app.buttons["Pin"].tap()
        row.press(forDuration: 1)
        app.buttons["Archive"].tap()
        XCTAssertTrue(row.waitForNonExistence(timeout: 5))
        app.buttons["sidebar-archive"].tap()
        XCTAssertTrue(app.navigationBars["Archived chats"].waitForExistence(timeout: 5))
        let result = app.buttons["search-chat-metadata-fixture"]
        XCTAssertTrue(result.waitForExistence(timeout: 5))
        capture("archived-and-renamed-chat")
        result.press(forDuration: 1)
        app.buttons["Unarchive"].tap()
        app.segmentedControls.buttons["Chats"].tap()
        let search = app.searchFields.firstMatch
        search.tap()
        search.typeText("winter")
        XCTAssertTrue(result.waitForExistence(timeout: 5))
        capture("history-message-search")
        result.tap()
        XCTAssertTrue(app.staticTexts["Recovery notes from last winter"].waitForExistence(timeout: 5))
        settings()
        XCTAssertTrue(app.staticTexts["Up to date"].waitForExistence(timeout: 20))
    }

    func testRejectedProviderKeyShowsErrorAndKeepsTheDraft() {
        launchCleanChat()
        defer { app.terminate() }
        enterDraft("Keep my question")
        settings()
        app.buttons["providerSettings"].tap()
        app.buttons["provider-groq"].tap()
        let key = app.secureTextFields["apiKeyField"]
        XCTAssertTrue(key.waitForExistence(timeout: 5))
        key.tap()
        key.typeText("fixture-invalid-key")
        app.buttons["connectProvider"].tap()
        XCTAssertTrue(app.staticTexts["Groq rejected the API key. Check it in Settings."].waitForExistence(timeout: 10))
        capture("provider-rejected-key")
        app.navigationBars["Groq"].buttons["BackButton"].tap()
        app.navigationBars["Models & providers"].buttons["BackButton"].tap()
        app.navigationBars["Settings"].buttons["Done"].tap()
        XCTAssertEqual(composer.value as? String, "Keep my question")
        XCTAssertFalse(app.buttons["sendMessage"].isEnabled)
    }

}
