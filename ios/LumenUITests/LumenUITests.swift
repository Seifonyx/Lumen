import XCTest

@MainActor
final class LumenUITests: XCTestCase {
    private let app = XCUIApplication()
    private var composer: XCUIElement {
        app.descendants(matching: .any).matching(identifier: "messageComposer").firstMatch
    }

    private func launchCleanChat() {
        continueAfterFailure = false
        app.launchArguments = ["-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()
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
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5),
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
            app.buttons["sidebar-projects"].tap()
            XCTAssertTrue(app.navigationBars["Projects"].waitForExistence(timeout: 3))
            capture("projects-\(theme.lowercased())")
            app.navigationBars.buttons.element(boundBy: 0).tap()
            settings()
            capture("settings-\(theme.lowercased())")
            app.buttons["Done"].tap()
        }
    }
}
