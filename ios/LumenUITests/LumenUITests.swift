import XCTest

@MainActor
final class LumenUITests: XCTestCase {
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
        newChat()
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

    func testNewChatCanCancelOrDiscardAnUnsentDraft() {
        launchCleanChat()
        defer { app.terminate() }
        enterDraft("Unsent question")
        app.buttons["newChat"].tap()
        XCTAssertTrue(app.buttons["Discard draft"].waitForExistence(timeout: 3))
        capture("discard-confirmation")
        app.buttons["Cancel"].tap()
        XCTAssertEqual(composer.value as? String, "Unsent question")
        app.buttons["newChat"].tap()
        app.buttons["Discard draft"].tap()
        XCTAssertNotEqual(composer.value as? String, "Unsent question")
        app.terminate()
        app.launch()
        XCTAssertTrue(composer.waitForExistence(timeout: 10))
        XCTAssertNotEqual(composer.value as? String, "Unsent question")
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
        if !model.waitForExistence(timeout: 20) {
            capture("model-import-failure")
            XCTFail("Connected model unavailable: " + app.debugDescription)
            return
        }
        model.tap()
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
