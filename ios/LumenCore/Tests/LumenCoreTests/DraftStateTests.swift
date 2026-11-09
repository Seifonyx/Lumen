import Foundation
import Testing
@testable import LumenCore

@Suite @MainActor
struct DraftStateTests {
    private func withDefaults(_ body: (UserDefaults) -> Void) {
        let name = "LumenTests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: name)!
        defer { defaults.removePersistentDomain(forName: name) }
        body(defaults)
    }

    @Test func draftSurvivesCreatingANewState() {
        withDefaults { defaults in
            let store = MemoryDraftStore()
            let state = DraftState(store: store, defaults: defaults)
            state.draft = "Keep my draft\nمرحبا 👋  "
            let reopened = DraftState(store: store, defaults: defaults)
            #expect(reopened.draft == "Keep my draft\nمرحبا 👋  ")
        }
    }

    @Test func legacyDraftSurvivesMigrationWithoutAnyEdit() {
        withDefaults { defaults in
            let store = MemoryDraftStore()
            defaults.set("Keep the Phase 0 draft", forKey: "lumen.unsent-draft")
            #expect(DraftState(store: store, defaults: defaults).draft == "Keep the Phase 0 draft")
            #expect(DraftState(store: store, defaults: defaults).draft == "Keep the Phase 0 draft")
            #expect(defaults.string(forKey: "lumen.unsent-draft") == nil)
        }
    }

    @Test func discardingDraftPersistsAndKeepsOtherPreferences() {
        withDefaults { defaults in
            let store = MemoryDraftStore()
            defaults.set("dark", forKey: "lumen.appearance")
            let state = DraftState(store: store, defaults: defaults)
            state.draft = "Unsent message"
            state.discardDraft()
            #expect(state.draft.isEmpty)
            #expect(DraftState(store: store, defaults: defaults).draft.isEmpty)
            #expect(defaults.string(forKey: "lumen.appearance") == "dark")
        }
    }

    @Test func whitespaceDoesNotRequireDiscardConfirmation() {
        withDefaults { defaults in
            let store = MemoryDraftStore()
            let state = DraftState(store: store, defaults: defaults)
            state.draft = " \n\t"
            #expect(!state.hasContent)
            state.draft = "👋"
            #expect(state.hasContent)
        }
    }
}
