# Lumen interaction ownership

DESIGN.md owns appearance, motion and the original phone welcome/composer. This contract records existing control ownership and the Model Picker's interaction guarantees. Extend these owners instead of creating parallel controls.

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Select/Listbox | Native HTML select; ModelPicker for rich model/layout selection | src/components/ModelPicker.tsx, src/lib/glass-select.ts, src/lib/focus-scope.ts | Browser/OS select by default; existing glass-phone enhancement delegates values to the same native select; checkbox model sets use explicit buttons | selection-policy, layout-policies, model-picker-accessibility, declared model/browser suites |
| Date | Native date/time input | src/components/TaskLibrary.tsx, src/app.css | OS keyboard/calendar and browser constraint parsing | scheduled task and accessibility suites |
| Form | Owning form plus shared field styles | src/components/ModelDeclarations.tsx, src/components/LayoutsTab.tsx, src/app.css | Custom-model validation is application-owned/noValidate, inline field-linked errors and first-invalid focus; legacy simple forms retain their existing validation | model-declarations, model-picker-accessibility, layout-builder/layout-policies |
| Scrollbar | Shared overflow containers and browser scrolling | src/app.css, src/glass.css | Picker mp-body, settings-panel, modal body and comparison grid own overflow; no document horizontal overflow | fit, layout, model-picker-accessibility, comparison-recovery |
| Toast | Store toast queue and Toasts component | src/store.ts, src/components/Toasts.tsx | Existing info/success/error, scoped Undo; important field errors stay inline | accessibility and declared-model removal/undo flows |
| CRUD | Store settings operations and existing model/layout editors | src/store.ts, src/components/ModelDeclarations.tsx, src/components/LayoutsTab.tsx | Preserve fixed choices when registry models vanish; delete declarations without deleting saved assignments; optional schema fields retain old layouts | declaration-registry, model-declarations, layout-builder, layout-policies |
| Table Selection | Existing model selection controls | src/components/CompareModelsModal.tsx, src/components/ModelPicker.tsx | Single choice has option/aria-selected; comparison toggles have aria-pressed; no data table is added | comparison-recovery and accessibility suites |

## Keyboard, refresh and validation

- Opening the model picker creates the shared focus scope. Search, arrows, Enter, Escape and Tab remain usable. Closing restores the trigger. Metadata refresh preserves the open query and focused control.
- Nested local editors own Escape before Settings. Glass select menus own their own Escape; Tab dismisses the popup and continues through the underlying form. Focus returns to the enabled trigger after React commits.
- Native selects and their glass enhancement must expose the same field name and disabled choices. Native controls remain a deliberate choice; do not replace them with an unrelated select library.
- Custom metadata is labelled Declared/unchecked. Missing capacity, prices and transport support stay unknown. Saving declarations performs no inference; automatic weekly checks skip them. Explicit Check models and user messages may call the chosen model.
- Comparison statuses/errors remain available alongside partial text. Stop keeps completed source cards. Retry affects only the failed/stopped slot; synthesis depends on completed answers and never imports a failed synthesis.
- Edits must survive registry refresh. Changing account/credentials invalidates the old editor or request. Fixed assignments are never silently rewritten because a newer model appears.

## Deliberate variants and audit scope

The premium static audit originally reported33 app-wide findings:11 unspecified native-control owners,7 legacy forms without noValidate and15 literal textareas without an inline resize-none token. The map above resolves ownership; it does not certify every inherited form or infer missing CSS from a JSX-only scan.

Composer and comparison textareas already use resize:none in app.css; instructions/message editors deliberately support vertical resizing, including LayoutsTab, and retain usable minimum heights. Preserve those established editing affordances. Other app-wide form/textarea findings are outside this Model Picker change; retain existing validation and behavior unless a concrete defect justifies changing them. Do not add inline style tokens merely to silence a static scan. Report unresolved automated findings honestly and verify rendered behavior with actual browser checks.

All model flows must fit phone and desktop viewports, keep visible keyboard focus, respect reduced motion and expose validation feedback without relying on color. Linux WebKit verifies an engine; it does not certify physical iPhone touch/compositing.
