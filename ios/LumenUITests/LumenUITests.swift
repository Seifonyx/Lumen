import XCTest

@MainActor
final class LumenUITests: XCTestCase {
    private static var verifiedSimulatorInput = false
    private let app = XCUIApplication()
    private var composer: XCUIElement {
        app.descendants(matching: .any).matching(identifier: "messageComposer").firstMatch
    }

    private func launchCleanChat(_ extraArguments: [String] = []) {
        continueAfterFailure = false
        app.launchArguments = ["--lumen-integration", "--lumen-reset-qa", "-AppleLanguages", "(en)", "-AppleLocale", "en_US"] + extraArguments
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
            closeSidebarByBackdrop()
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

    private func closeSidebarByBackdrop() {
        // Tap the visible, dimmed part of the chat beside the sidebar. Wait for the sidebar's own
        // content to go: the chat's openSidebar button exists underneath the whole time.
        let backdrop = app.buttons["closeSidebar"]
        let panel = app.buttons["sidebarNewChat"]
        XCTAssertTrue(backdrop.waitForExistence(timeout: 5))
        XCTAssertTrue(panel.waitForExistence(timeout: 5))
        backdrop.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        XCTAssertTrue(panel.waitForNonExistence(timeout: 5),
                      "Tapping the exposed chat must close the sidebar")
        XCTAssertTrue(app.buttons["openSidebar"].isHittable)
        XCTAssertFalse(app.buttons["openSettings"].exists)
    }

    private func verifySidebarEdgeSwipe() {
        // The sidebar follows the finger both ways, from anywhere on the screen (no handles).
        let panel = app.buttons["sidebarNewChat"]
        XCTAssertTrue(panel.waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["sidebarDismissHandle"].exists, "No separate drag handle")
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.7, dy: 0.55))
            .press(forDuration: 0.05, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.05, dy: 0.55)))
        XCTAssertTrue(panel.waitForNonExistence(timeout: 5), "Swiping left must close the sidebar")
        XCTAssertTrue(app.buttons["openSidebar"].isHittable)
        XCTAssertFalse(app.buttons["openSettings"].exists)
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.2, dy: 0.55))
            .press(forDuration: 0.05, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.55)))
        XCTAssertTrue(panel.waitForExistence(timeout: 5), "Swiping right on the chat must open the sidebar")
        XCTAssertTrue(app.buttons["openSettings"].isHittable)
        closeSidebarByBackdrop()
        XCTAssertFalse(app.buttons["sidebarEdgeHandle"].exists, "No visible edge tab on the chat")
    }

    private func openModelPicker() {
        // The chosen model is the title of the chat screen; tapping it opens the full list.
        let picker = app.buttons["chooseModel"]
        XCTAssertTrue(picker.waitForExistence(timeout: 5), "The chat title must offer the model list")
        picker.tap()
    }

    /// Taps a model in the list, scrolling it into view first: in the half-height sheet a row can sit
    /// beneath the floating search field.
    private func tapModel(_ model: XCUIElement) {
        XCTAssertTrue(model.waitForExistence(timeout: 10))
        for _ in 0..<4 where !model.isHittable { app.collectionViews.firstMatch.swipeUp() }
        model.tap()
    }

    private func dismissKeyboardByTappingTheConversation() {
        // No keyboard button: tapping the conversation (or dragging it down) puts the keyboard away.
        // (A point in the window, just below the bar: "the first scroll view" can be the keyboard's own
        // suggestion strip, and tapping that types a word instead.)
        app.windows.firstMatch.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.22)).tap()
        XCTAssertTrue(app.keyboards.firstMatch.waitForNonExistence(timeout: 5),
                      "Tapping the conversation must hide the keyboard")
    }

    private func newChat() {
        app.buttons["newChat"].tap()
        if app.buttons["Discard draft"].waitForExistence(timeout: 1) {
            app.buttons["Discard draft"].tap()
        }
        XCTAssertTrue(composer.waitForExistence(timeout: 3))
    }

    /// Opens the sidebar, tapping again if the first tap landed while a sheet was still closing.
    private func openSidebar() {
        for _ in 0..<3 {
            app.buttons["openSidebar"].tap()
            if app.buttons["openSettings"].waitForExistence(timeout: 3) { waitForSidebarToSettle(); return }
        }
        XCTFail("The sidebar did not open")
    }

    /// The sidebar slides in with a spring; a touch-and-hold that starts while rows are still moving is
    /// cancelled by iOS and becomes a tap. Wait until the sidebar stops moving.
    private func waitForSidebarToSettle() {
        let row = app.buttons["openSettings"]
        var last = row.frame
        for _ in 0..<20 {
            RunLoop.current.run(until: Date().addingTimeInterval(0.15))
            let now = row.frame
            if now == last { return }
            last = now
        }
    }

    private func settings() {
        openSidebar()
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
        app.buttons["sidebarSearchButton"].tap()
        XCTAssertTrue(app.navigationBars["Search"].waitForExistence(timeout: 3))
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
        XCTAssertTrue(app.buttons["newTemporaryChat"].exists)
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
        closeSidebarByBackdrop()
        settings()
        XCTAssertTrue(app.staticTexts["Up to date"].waitForExistence(timeout: 15))
    }

    func testComposerStaysAboveKeyboardAndDoesNotSubmitWithoutAModel() {
        launchCleanChat()
        defer { app.terminate() }
        XCTAssertTrue(app.buttons["attachFile"].exists, "The composer must show the plus button")
        XCTAssertTrue(app.buttons["sendMessage"].exists, "The composer must show Send")
        XCTAssertTrue(app.buttons["chooseModel"].exists, "The chat title must show the model")
        XCTAssertFalse(app.buttons["hideKeyboard"].exists, "No separate keyboard button above the keyboard")
        enterDraft("A draft above the keyboard")
        let keyboard = app.keyboards.firstMatch
        XCTAssertTrue(keyboard.waitForExistence(timeout: 3))
        XCTAssertTrue(composer.isHittable)
        XCTAssertLessThanOrEqual(composer.frame.maxY, keyboard.frame.minY + 2)
        XCTAssertFalse(app.buttons["sendMessage"].isEnabled)
        XCTAssertEqual(app.tabBars.count, 0)
        capture("chat-keyboard")
        dismissKeyboardByTappingTheConversation()
        XCTAssertEqual(composer.value as? String, "A draft above the keyboard", "Hiding the keyboard keeps the draft")
    }

    func testNativeScreensInLightAndDark() {
        // Capture both themes and navigate every screen without XCTest killing
        // the journey during slower hosted simulator accessibility operations.
        executionTimeAllowance = 240
        launchCleanChat()
        defer { app.terminate() }
        for theme in ["Light", "Dark"] {
            appearance(theme)
            XCTAssertTrue(app.buttons["attachFile"].exists)
            XCTAssertTrue(app.buttons["sendMessage"].exists)
            XCTAssertTrue(app.buttons["chooseModel"].exists)
            capture("chat-\(theme.lowercased())")
            composer.tap()
            XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 10))
            capture("composer-focused-\(theme.lowercased())")
            dismissKeyboardByTappingTheConversation()
            openModelPicker()
            XCTAssertTrue(app.navigationBars["Models"].waitForExistence(timeout: 3))
            capture("models-\(theme.lowercased())")
            app.buttons["Done"].tap()
            app.buttons["openSidebar"].tap()
            XCTAssertTrue(app.buttons["sidebarNewChat"].waitForExistence(timeout: 3))
            capture("sidebar-\(theme.lowercased())")
            // Test the swipe once per theme, separately from startup and data journeys.
            verifySidebarEdgeSwipe()
            app.buttons["openSidebar"].tap()
            let newChatRow = app.buttons["sidebarNewChat"]
            XCTAssertTrue(newChatRow.waitForExistence(timeout: 5))
            XCTAssertTrue(app.buttons["sidebarSearchButton"].exists)
            // Nothing in the sidebar leads to a screen that isn't built yet; Router lives in Settings.
            XCTAssertTrue(app.buttons["sidebar-library"].exists, "Library is real now, and in the sidebar")
            for placeholder in ["sidebar-projects", "sidebar-router", "sidebar-search", "sidebar-archive"] {
                XCTAssertFalse(app.buttons[placeholder].exists, placeholder + " must not be offered")
            }
            XCTAssertFalse(app.staticTexts["Coming in a later native update. Your existing web content stays in your account."].exists)
            XCTAssertFalse(app.buttons["sidebarCloseButton"].exists)
            XCTAssertTrue(newChatRow.isHittable)
            closeSidebarByBackdrop()
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
        app.navigationBars["Router"].buttons["BackButton"].tap()
        app.navigationBars["Settings"].buttons["Done"].tap()
        openModelPicker()
        tapModel(app.buttons["model-groq-fixture-model"])
        XCTAssertNotEqual(app.buttons["chooseModel"].label, "Model: Not selected", "The title must name the chosen model")
        enterDraft("Manual provider check")
        app.buttons["sendMessage"].tap()
        XCTAssertTrue(app.keyboards.firstMatch.waitForNonExistence(timeout: 5), "Sending puts the keyboard away")
        XCTAssertTrue(app.staticTexts["A native streamed reply."].waitForExistence(timeout: 10))
        // As in the AI apps people know, a new question moves to the top of the screen and its reply writes
        // below it, instead of the screen following the end of the text.
        enterDraft("Pinned follow-up question")
        app.buttons["sendMessage"].tap()
        let question = app.staticTexts["Pinned follow-up question"]
        XCTAssertTrue(question.waitForExistence(timeout: 5))
        let deadline = Date().addingTimeInterval(6)
        while question.frame.minY >= app.frame.height * 0.35 && Date() < deadline {
            RunLoop.current.run(until: Date().addingTimeInterval(0.2))
        }
        XCTAssertLessThan(question.frame.minY, app.frame.height * 0.35,
                          "The sent message must be pinned near the top (at \(question.frame.minY) of \(app.frame.height))")
        XCTAssertTrue(app.buttons["Regenerate response"].firstMatch.waitForExistence(timeout: 15))
        XCTAssertFalse(app.buttons["scrollToLatest"].exists, "A short reply needs no Latest button")
        capture("direct-provider-reply")
    }

    private func signInAndChooseModel() {
        settings()
        let signIn = app.buttons["googleSignIn"]
        XCTAssertTrue(signIn.waitForExistence(timeout: 5))
        signIn.tap()
        XCTAssertTrue(app.staticTexts["Native QA"].waitForExistence(timeout: 15))
        app.buttons["Done"].tap()
        XCTAssertTrue(app.navigationBars["Settings"].waitForNonExistence(timeout: 10),
                      "Account setup must close before opening the model picker")
        openModelPicker()
        XCTAssertTrue(app.navigationBars["Models"].waitForExistence(timeout: 10),
                      "Model picker must be visible before checking imported account models")
        let model = app.buttons["model-groq-fixture-model"]
        let reload = app.buttons["Load account providers"]
        // Hosted Firestore/Auth emulators sometimes finish connecting just after login.
        // Retry the real account-key recovery action in a bounded window, and still fail
        // if the expected connected model never becomes available.
        let deadline = Date().addingTimeInterval(45)
        var reloads = 0
        while !model.exists && Date() < deadline {
            if reload.exists && reload.isEnabled && reloads < 2 {
                reload.tap()
                reloads += 1
            }
            if model.waitForExistence(timeout: 4) { break }
        }
        if !model.exists {
            capture("model-import-failure")
            XCTFail("Connected model unavailable after account sync and \(reloads) explicit refresh(es): " + app.debugDescription)
            return
        }
        tapModel(model)
        XCTAssertTrue(app.navigationBars["Models"].waitForNonExistence(timeout: 10),
                      "Selecting a model must close the picker")
    }

    func testAttachmentsPreviewRestoreAndSendActualTextAndImageBytes() {
        executionTimeAllowance = 240
        launchCleanChat()
        defer { app.terminate() }
        signInAndChooseModel()
        XCTAssertTrue(app.buttons["attachFile"].exists)
        XCTAssertFalse(app.staticTexts["Attach"].exists, "The plus button must not display an Attach label")
        app.buttons["attachFile"].tap()
        XCTAssertTrue(app.buttons["attachFixtureText"].waitForExistence(timeout: 5),
                      "Plus must expose files and photos menu actions")
        app.buttons["attachFixtureText"].tap()
        let preview = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "previewAttachment-")).firstMatch
        XCTAssertTrue(preview.waitForExistence(timeout: 10))
        preview.tap()
        XCTAssertTrue(app.staticTexts["NATIVE_ATTACHMENT_FILE_CONTENT"].waitForExistence(timeout: 5))
        capture("attachment-text-preview")
        app.buttons["Done"].tap()
        app.terminate(); app.launch()
        XCTAssertTrue(app.buttons["attachFile"].waitForExistence(timeout: 10))
        XCTAssertTrue(preview.exists)
        app.buttons["attachFile"].tap()
        XCTAssertTrue(app.buttons["attachFixturePhoto"].waitForExistence(timeout: 5))
        app.buttons["attachFixturePhoto"].tap()
        let chips = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "previewAttachment-"))
        XCTAssertTrue(chips.element(boundBy: 1).waitForExistence(timeout: 10))
        openModelPicker()
        tapModel(app.buttons["model-groq-meta-llama/llama-4-scout-17b-16e-instruct"])
        enterDraft("Review these native attachments")
        capture("attachment-composer")
        app.buttons["sendMessage"].tap()
        XCTAssertTrue(app.staticTexts["A native streamed reply."].waitForExistence(timeout: 15))
        // The Library gathers the files and photos from the chats.
        openSidebar()
        app.buttons["sidebar-library"].tap()
        XCTAssertTrue(app.navigationBars["Library"].waitForExistence(timeout: 5))
        let items = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'library-item-'"))
        XCTAssertTrue(items.firstMatch.waitForExistence(timeout: 5), "Sent files must appear in the Library")
        XCTAssertGreaterThanOrEqual(items.count, 2, "Both the text file and the photo")
        app.segmentedControls.buttons["Photos"].tap()
        XCTAssertEqual(items.count, 1, "Photos shows only the photo")
        capture("library")
        app.navigationBars["Library"].buttons.element(boundBy: 0).tap()
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
        let firstPage = XCTNSPredicateExpectation(predicate: NSPredicate(format: "label MATCHES %@", #"60 of [0-9]+"#), object: count)
        XCTAssertEqual(XCTWaiter.wait(for: [firstPage], timeout: 15), .completed,
                       "The first history page must load 60 messages")
        let totalMessages = Int(count.label.components(separatedBy: " of ").last ?? "") ?? 0
        XCTAssertGreaterThanOrEqual(totalMessages, 180, "The long-history fixture must retain its 180 seeded messages")
        older.tap()
        let secondPage = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "label == %@", "120 of \(totalMessages)"), object: count)
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
        let target = app.buttons["history-delete-fixture"]
        // On the hosted compact simulator a touch-and-hold occasionally registers as a tap and opens the chat;
        // reopen the sidebar and hold again (the menu itself is what this test checks).
        for _ in 0..<3 {
            openSidebar()
            XCTAssertTrue(target.waitForExistence(timeout: 30), "The cloud chat list must load")
            target.press(forDuration: 1.2)
            if app.buttons["Delete chat"].waitForExistence(timeout: 3) { break }
        }
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
        if app.keyboards.firstMatch.exists { dismissKeyboardByTappingTheConversation() }
        let versions = app.buttons["conversationVersions"]
        XCTAssertTrue(versions.waitForExistence(timeout: 10))
        let done = XCTNSPredicateExpectation(predicate: NSPredicate(format: "enabled == true"), object: versions)
        XCTAssertEqual(XCTWaiter.wait(for: [done], timeout: 20), .completed)
        versions.tap()
        XCTAssertTrue(app.navigationBars["Versions"].waitForExistence(timeout: 10),
                      "Version history must open a stable, accessible picker")
        let originalVersion = app.buttons.matching(
            NSPredicate(format: "label CONTAINS %@", "Version 1 · Original")
        ).firstMatch
        XCTAssertTrue(originalVersion.waitForExistence(timeout: 10),
                      "The original version must be selectable after edit and regeneration")
        originalVersion.tap()
        XCTAssertTrue(app.navigationBars["Versions"].waitForNonExistence(timeout: 10))
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
        app.buttons["sidebarSearchButton"].tap()
        XCTAssertTrue(app.navigationBars["Search"].waitForExistence(timeout: 5))
        app.segmentedControls.buttons["Archived"].tap()
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

    func testLargestTextSizeKeepsEveryChatControlUsable() {
        // Accessibility text sizes: the chat bar, its buttons and the sidebar must stay on screen and tappable.
        executionTimeAllowance = 240
        launchCleanChat(["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXL"])
        defer { app.terminate() }
        for control in ["attachFile", "sendMessage", "chooseModel", "newChat", "openSidebar"] {
            XCTAssertTrue(app.buttons[control].isHittable, control + " must stay tappable at the largest text size")
        }
        XCTAssertTrue(composer.isHittable)
        capture("largest-text-chat")
        enterDraft("A longer question that wraps across several lines at the largest text size")
        let keyboard = app.keyboards.firstMatch
        XCTAssertLessThanOrEqual(composer.frame.maxY, keyboard.frame.minY + 2, "The chat bar stays above the keyboard")
        XCTAssertTrue(app.buttons["sendMessage"].isHittable)
        capture("largest-text-composer")
        dismissKeyboardByTappingTheConversation()
        app.buttons["openSidebar"].tap()
        XCTAssertTrue(app.buttons["sidebarNewChat"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["openSettings"].isHittable)
        capture("largest-text-sidebar")
        closeSidebarByBackdrop()
    }

    func testAccessibilityAuditOfTheMainScreens() throws {
        // Apple's own audit: every control has a usable description and text follows the user's text size.
        executionTimeAllowance = 240
        launchCleanChat()
        defer { app.terminate() }
        // Text size is audited on Lumen's own screens (chat, sidebar); Settings, Router and Models are standard
        // iOS lists whose text the system scales, and are audited for descriptions.
        func audit(_ screen: String, textSize: Bool = false) throws {
            let types: XCUIAccessibilityAuditType = textSize ? [.sufficientElementDescription, .dynamicType] : [.sufficientElementDescription]
            try app.performAccessibilityAudit(for: types) { issue in
                // System-owned chrome (keyboard, status bar) is not Lumen's to label.
                guard let element = issue.element else { return true }
                if element.elementType == .keyboard || element.elementType == .statusBar { return true }
                // iOS caps text in navigation bars at accessibility sizes, as in Apple's own apps; the model
                // title offers the Large Content Viewer instead (touch and hold).
                if issue.auditType == .dynamicType,
                   self.app.navigationBars.allElementsBoundByIndex.contains(where: { $0.frame.contains(element.frame) }) { return true }
                print("Accessibility issue on \(screen): \(issue.compactDescription) — \(element.debugDescription.prefix(200))")
                return false
            }
        }
        try audit("chat", textSize: true)
        app.buttons["openSidebar"].tap()
        XCTAssertTrue(app.buttons["sidebarNewChat"].waitForExistence(timeout: 5))
        try audit("sidebar", textSize: true)
        closeSidebarByBackdrop()
        settings()
        try audit("settings")
        app.buttons["providerSettings"].tap()
        XCTAssertTrue(app.navigationBars["Router"].waitForExistence(timeout: 5))
        try audit("router")
        app.navigationBars["Router"].buttons["BackButton"].tap()
        app.navigationBars["Settings"].buttons["Done"].tap()
        openModelPicker()
        XCTAssertTrue(app.navigationBars["Models"].waitForExistence(timeout: 5))
        try audit("models")
        app.buttons["Done"].tap()
    }

    func testProjectsSyncWithTheWeb() {
        // The web's projects appear here, a chat started in one carries its instructions to the provider, and a
        // project made on this iPhone is saved where the web keeps them (checked in the emulator afterwards).
        executionTimeAllowance = 240
        launchCleanChat()
        defer { app.terminate() }
        signInAndChooseModel()
        openSidebar()
        let project = app.buttons["project-fixture-project"]
        XCTAssertTrue(project.waitForExistence(timeout: 30), "The web project must appear in the sidebar")
        XCTAssertFalse(app.buttons["history-project-fixture-chat"].exists, "A project's chats are listed inside it")
        capture("sidebar-projects")
        project.tap()
        XCTAssertTrue(app.navigationBars["Fixture project"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["history-project-fixture-chat"].waitForExistence(timeout: 15))
        XCTAssertTrue(app.buttons["projectInstructions"].label.contains("PROJECT_FIXTURE_INSTRUCTIONS"))
        capture("project")
        app.buttons["projectNewChat"].tap()
        XCTAssertTrue(composer.waitForExistence(timeout: 5))
        enterDraft("NATIVE_PROJECT_QUESTION")
        app.buttons["sendMessage"].tap()
        XCTAssertTrue(app.staticTexts["A native streamed reply."].waitForExistence(timeout: 15))

        openSidebar()
        app.buttons["sidebarNewProject"].tap()
        let name = app.textFields["projectName"]
        XCTAssertTrue(name.waitForExistence(timeout: 5))
        name.tap()
        name.typeText("Native project")
        app.buttons["saveProject"].tap()
        XCTAssertTrue(app.navigationBars["Native project"].waitForExistence(timeout: 15), "A new project opens once saved")
        XCTAssertTrue(app.buttons["projectNewChat"].waitForExistence(timeout: 10))
        capture("project-created")
        app.navigationBars["Native project"].buttons.element(boundBy: 0).tap()
        settings()
        XCTAssertTrue(app.staticTexts["Up to date"].waitForExistence(timeout: 20))
    }

    func testAutoPicksAModelForEachMessageAndSaysWhy() {
        // Auto is the first choice in the model list; the reply says which model answered and why (and the
        // emulator check confirms it was saved in the web's per-message fields).
        executionTimeAllowance = 240
        launchCleanChat()
        defer { app.terminate() }
        signInAndChooseModel()
        openModelPicker()
        let auto = app.buttons["model-auto"]
        XCTAssertTrue(auto.waitForExistence(timeout: 5), "Auto must be offered once a provider is connected")
        auto.tap()
        XCTAssertTrue(app.navigationBars["Models"].waitForNonExistence(timeout: 5))
        XCTAssertEqual(app.buttons["chooseModel"].label, "Model: Auto")
        enterDraft("NATIVE_AUTO_QUESTION")
        app.buttons["sendMessage"].tap()
        XCTAssertTrue(app.staticTexts["A native streamed reply."].waitForExistence(timeout: 15))
        let answeredBy = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH 'Answered by '")).firstMatch
        XCTAssertTrue(answeredBy.waitForExistence(timeout: 5), "The reply must say which model answered")
        XCTAssertTrue(answeredBy.label.hasPrefix("Answered by "), answeredBy.label)
        XCTAssertTrue(answeredBy.label.contains(":"), "Auto's reason must be given: " + answeredBy.label)
        capture("auto-reply")
        settings()
        XCTAssertTrue(app.staticTexts["Up to date"].waitForExistence(timeout: 20))
    }

    func testMemoryIsUsedAndRepliesCanSaveToIt() {
        // The account's memory and About you go with each message; a reply's hidden memory line is never shown,
        // becomes a saved memory (checked in the emulator), and appears in Settings, where memories can be managed.
        executionTimeAllowance = 240
        launchCleanChat()
        defer { app.terminate() }
        signInAndChooseModel()
        enterDraft("Please REMEMBER_THIS_FIXTURE")
        app.buttons["sendMessage"].tap()
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH 'Noted for later.'")).firstMatch.waitForExistence(timeout: 15))
        XCTAssertFalse(app.staticTexts.matching(NSPredicate(format: "label CONTAINS '[['")).firstMatch.exists, "Memory lines are hidden")
        XCTAssertTrue(app.descendants(matching: .any)["memoryUpdated"].waitForExistence(timeout: 5), "The chat says Memory updated")
        capture("memory-updated")
        settings()
        app.buttons["personalizationSettings"].tap()
        XCTAssertTrue(app.navigationBars["Personalization"].waitForExistence(timeout: 5))
        // Saved memories are at the end of the page; rows below the screen exist only once scrolled to.
        let saved = app.staticTexts["Likes fixture tests"]
        for _ in 0..<5 where !saved.exists { app.swipeUp() }
        XCTAssertTrue(saved.waitForExistence(timeout: 15), "The saved memory is listed")
        XCTAssertTrue(app.staticTexts["Prefers metric units"].exists)
        capture("personalization")
        app.navigationBars["Personalization"].buttons.element(boundBy: 0).tap()
        app.navigationBars["Settings"].buttons["Done"].tap()
    }

    /// Opens a lumen:// link, accepting the system's "Open in Lumen?" prompt if the simulator shows one.
    private func openLink(_ link: String) {
        app.open(URL(string: link)!)
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        if springboard.buttons["Open"].waitForExistence(timeout: 2) { springboard.buttons["Open"].tap() }
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 10))
    }

    private func waitForComposerText(_ text: String, _ message: String) {
        let deadline = Date().addingTimeInterval(8)
        while (composer.value as? String) != text && Date() < deadline { RunLoop.current.run(until: Date().addingTimeInterval(0.2)) }
        XCTAssertEqual(composer.value as? String, text, message)
    }

    func testVoiceSiriAndLinksStartChats() {
        // Talk instead of typing (the simulator has no microphone, so the recogniser is simulated), hear a reply
        // read aloud, and start chats from a lumen:// link (fills in only) and Ask Lumen (sends; the emulator
        // check confirms what reached the provider).
        executionTimeAllowance = 300
        launchCleanChat(["--lumen-fake-voice"])
        defer { app.terminate() }
        signInAndChooseModel()
        let mic = app.buttons["dictate"]
        XCTAssertTrue(mic.waitForExistence(timeout: 5), "The message box offers voice input")
        XCTAssertEqual(mic.label, "Dictate")
        mic.tap()
        XCTAssertTrue(app.buttons["Stop dictation"].waitForExistence(timeout: 5), "Listening shows a stop control")
        waitForComposerText("Dictated fixture question", "What you say appears in the message")
        capture("dictation-listening")
        app.buttons["Stop dictation"].tap()
        XCTAssertTrue(app.buttons["Stop dictation"].waitForNonExistence(timeout: 5))
        app.buttons["sendMessage"].tap()
        XCTAssertTrue(app.staticTexts["Dictated fixture question"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["A native streamed reply."].waitForExistence(timeout: 15))
        let read = app.buttons["Read aloud"].firstMatch
        XCTAssertTrue(read.waitForExistence(timeout: 10), "Replies can be read aloud")
        read.tap()
        let stop = app.buttons["Stop reading"].firstMatch
        XCTAssertTrue(stop.waitForExistence(timeout: 5))
        capture("read-aloud")
        stop.tap()
        XCTAssertTrue(app.buttons["Read aloud"].firstMatch.waitForExistence(timeout: 5))
        // A link opens a new chat with its message filled in, and waits for you to send it.
        openLink("lumen://new?prompt=From%20a%20link")
        waitForComposerText("From a link", "A link fills in a new chat's message")
        XCTAssertFalse(app.staticTexts["Dictated fixture question"].exists, "A link starts a new chat")
        XCTAssertTrue(app.buttons["sendMessage"].isEnabled)
        capture("link-new-chat")
        // Ask Lumen (Siri and Shortcuts) starts a new chat and sends the question.
        openLink("lumen://ask?prompt=Asked%20by%20Siri&send=1")
        XCTAssertTrue(app.staticTexts["Asked by Siri"].waitForExistence(timeout: 10), "Ask Lumen sends its question")
        XCTAssertTrue(app.staticTexts["A native streamed reply."].waitForExistence(timeout: 15))
        XCTAssertFalse(app.staticTexts["From a link"].exists)
        settings()
        XCTAssertTrue(app.staticTexts["Up to date"].waitForExistence(timeout: 20))
    }

    func testAReplyKeepsGoingAfterLeavingAndNotifiesWhenDone() {
        // As in the AI apps people know: leave Lumen while it writes, the reply finishes anyway, a notification
        // says so, and tapping it opens the chat with the whole reply.
        executionTimeAllowance = 300
        launchCleanChat(["--lumen-notify-test"])
        defer { app.terminate() }
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        signInAndChooseModel()
        enterDraft("Stop by and notify me")
        app.buttons["sendMessage"].tap()
        // The first send asks permission to notify.
        let allow = springboard.buttons["Allow"]
        if allow.waitForExistence(timeout: 5) { allow.tap() }
        let partial = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Partial reply.")).firstMatch
        XCTAssertTrue(partial.waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["stopStreaming"].exists, "Still writing when we leave")
        XCUIDevice.shared.press(.home)
        let banner = springboard.descendants(matching: .any)
            .matching(NSPredicate(format: "label CONTAINS %@", "Partial reply.")).firstMatch
        XCTAssertTrue(banner.waitForExistence(timeout: 30), "A notification says the reply is ready")
        banner.tap()
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 10))
        XCTAssertTrue(app.buttons["Regenerate response"].firstMatch.waitForExistence(timeout: 10), "The reply finished while away")
        XCTAssertFalse(app.staticTexts["Stopped"].exists, "Leaving did not stop the reply")
        capture("reply-finished-in-background")
        settings()
        let toggle = app.switches["replyNotificationsToggle"]
        for _ in 0..<3 where !toggle.exists { app.swipeUp() }
        XCTAssertTrue(toggle.exists, "Notifications can be turned off in Settings")
        for _ in 0..<3 where !app.staticTexts["Up to date"].exists { app.swipeDown() }
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
        XCTAssertTrue(app.staticTexts["Groq didn't accept this API key. Check that it's complete and still active."].waitForExistence(timeout: 10))
        capture("provider-rejected-key")
        app.navigationBars["Groq"].buttons["BackButton"].tap()
        app.navigationBars["Router"].buttons["BackButton"].tap()
        app.navigationBars["Settings"].buttons["Done"].tap()
        XCTAssertEqual(composer.value as? String, "Keep my question")
        XCTAssertFalse(app.buttons["sendMessage"].isEnabled)
    }

}
