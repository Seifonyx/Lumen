import SwiftUI
import LumenCore

struct ChatView: View {
    @Bindable var composer: DraftState
    var focused: FocusState<Bool>.Binding
    var chooseModel: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                Image("LumenMark")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 44, height: 62)
                    .accessibilityHidden(true)
                Text("Start a conversation")
                    .font(.title2.weight(.semibold))
                    .multilineTextAlignment(.center)
                Text("Choose a connected model to begin.")
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            .padding(32)
            .frame(maxWidth: .infinity)
            .containerRelativeFrame(.vertical)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(Color(uiColor: .systemBackground))
        .safeAreaInset(edge: .bottom, spacing: 0) {
            VStack(alignment: .leading, spacing: 12) {
                TextField("Message Lumen", text: $composer.draft, axis: .vertical)
                    .lineLimit(1...6)
                    .font(.body)
                    .focused(focused)
                    .accessibilityLabel("Message Lumen")
                    .accessibilityIdentifier("messageComposer")
                    .padding(.horizontal, 4)
                HStack {
                    Button(action: chooseModel) {
                        Label("Choose model", systemImage: "cpu")
                            .font(.subheadline.weight(.medium))
                            .padding(.vertical, 5)
                    }
                    .accessibilityIdentifier("chooseModel")
                    Spacer(minLength: 12)
                    Button("Send", systemImage: "arrow.up.circle.fill") {}
                        .font(.system(size: 34))
                        .labelStyle(.iconOnly)
                        .disabled(true)
                        .accessibilityHint("Choose a connected model before sending.")
                        .accessibilityIdentifier("sendMessage")
                }
            }
            .padding(16)
            .glassEffect(.regular, in: .rect(cornerRadius: 26))
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
        }
    }
}
