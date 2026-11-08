import SwiftUI
import LumenCore

struct ChatView: View {
    @Bindable var composer: DraftState
    @Bindable var engine: ChatEngine
    var focused: FocusState<Bool>.Binding
    var chooseModel: () -> Void

    @AppStorage("lumen.api-key") private var apiKey = ""

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                if engine.currentConversation.messages.isEmpty {
                    VStack(spacing: 18) {
                        Image("LumenMark")
                            .resizable()
                            .scaledToFit()
                            .frame(width: 44, height: 62)
                            .accessibilityHidden(true)
                        Text("Start a conversation")
                            .font(.title2.weight(.semibold))
                            .multilineTextAlignment(.center)
                        Text(engine.selectedModel != nil ? "Ready with \(engine.selectedModel!.name)" : "Choose a connected model to begin.")
                            .font(.body)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(32)
                    .frame(maxWidth: .infinity)
                    .containerRelativeFrame(.vertical)
                } else {
                    LazyVStack(alignment: .leading, spacing: 14) {
                        ForEach(engine.currentConversation.messages) { message in
                            MessageRow(message: message)
                                .id(message.id)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .background(Color(uiColor: .systemBackground))
            .onChange(of: engine.currentConversation.messages.count) { _, _ in
                if let last = engine.currentConversation.messages.last {
                    withAnimation(.easeOut(duration: 0.2)) {
                        proxy.scrollTo(last.id, anchor: .bottom)
                    }
                }
            }
        }
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
                        Label(engine.selectedModel?.name ?? "Choose model", systemImage: "cpu")
                            .font(.subheadline.weight(.medium))
                            .padding(.vertical, 5)
                    }
                    .accessibilityIdentifier("chooseModel")

                    Spacer(minLength: 12)

                    if engine.isStreaming {
                        Button("Stop", systemImage: "stop.circle.fill") {
                            engine.stopStreaming()
                        }
                        .font(.system(size: 34))
                        .foregroundStyle(.red)
                        .labelStyle(.iconOnly)
                        .accessibilityIdentifier("stopStreaming")
                    } else {
                        Button("Send", systemImage: "arrow.up.circle.fill") {
                            let text = composer.draft
                            composer.discardDraft()
                            Task {
                                await engine.send(prompt: text, apiKey: apiKey)
                            }
                        }
                        .font(.system(size: 34))
                        .labelStyle(.iconOnly)
                        .disabled(!composer.hasContent || engine.selectedModel == nil)
                        .accessibilityHint(engine.selectedModel == nil ? "Choose a connected model before sending." : "Send message")
                        .accessibilityIdentifier("sendMessage")
                    }
                }
            }
            .padding(16)
            .glassEffect(.regular, in: .rect(cornerRadius: 26))
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
        }
    }
}

private struct MessageRow: View {
    let message: ChatMessage

    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            if message.role == .user {
                Spacer(minLength: 48)
                Text(message.content)
                    .font(.body)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(Color.accentColor, in: .rect(cornerRadius: 20))
            } else {
                VStack(alignment: .leading, spacing: 6) {
                    if message.content.isEmpty && message.status == .streaming {
                        ProgressView()
                            .padding(8)
                    } else {
                        Text(message.content)
                            .font(.body)
                            .foregroundStyle(.primary)
                            .textSelection(.enabled)

                        if case .error(let err) = message.status {
                            Text(err)
                                .font(.caption)
                                .foregroundStyle(.red)
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(Color(uiColor: .secondarySystemBackground), in: .rect(cornerRadius: 20))
                Spacer(minLength: 48)
            }
        }
    }
}
