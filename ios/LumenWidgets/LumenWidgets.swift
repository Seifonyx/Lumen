import SwiftUI
import WidgetKit
import AppIntents
import LumenCore

/// Lumen on the Home Screen, the Lock Screen and in Control Center: one tap to a new chat, or to talk to it.
@main struct LumenWidgets: WidgetBundle {
    var body: some Widget {
        AskLumenWidget()
        NewChatControl()
        TalkControl()
    }
}

private struct Moment: TimelineEntry { let date = Date() }

private struct StaticProvider: TimelineProvider {
    func placeholder(in context: Context) -> Moment { Moment() }
    func getSnapshot(in context: Context, completion: @escaping (Moment) -> Void) { completion(Moment()) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<Moment>) -> Void) {
        completion(Timeline(entries: [Moment()], policy: .never))
    }
}

/// The same colours as the app (LumenPalette), for the widget's own process.
private enum WidgetPalette {
    static let accent = Color(uiColor: UIColor { $0.userInterfaceStyle == .dark
        ? UIColor(red: 0.792, green: 0.859, blue: 0.955, alpha: 1) : UIColor(red: 0.228, green: 0.317, blue: 0.441, alpha: 1) })
    static let ink = Color(uiColor: UIColor { $0.userInterfaceStyle == .dark
        ? UIColor(red: 0.962, green: 0.974, blue: 0.991, alpha: 1) : UIColor(red: 0.105, green: 0.125, blue: 0.164, alpha: 1) })
    static let field = Color(uiColor: UIColor { $0.userInterfaceStyle == .dark
        ? UIColor(red: 0.144, green: 0.157, blue: 0.179, alpha: 1) : UIColor(red: 0.932, green: 0.941, blue: 0.954, alpha: 1) })
}

struct AskLumenWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "io.github.seifonyx.lumen.ask", provider: StaticProvider()) { _ in
            AskLumenView()
        }
        .configurationDisplayName("Ask Lumen")
        .description("Start a new chat, or tap the microphone and say it.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular])
    }
}

private struct AskLumenView: View {
    @Environment(\.widgetFamily) private var family

    var body: some View {
        switch family {
        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                Image(systemName: "square.and.pencil").font(.title3.weight(.semibold))
            }
            .widgetURL(LumenLink.url(prompt: nil))
            .accessibilityLabel("New Lumen chat")
            .containerBackground(.clear, for: .widget)
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 2) {
                Label("Lumen", systemImage: "sparkle").font(.headline).widgetAccentable()
                Text("Ask anything").font(.body)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .widgetURL(LumenLink.url(prompt: nil))
            .containerBackground(.clear, for: .widget)
        case .systemMedium:
            VStack(alignment: .leading, spacing: 12) {
                Label("Lumen", systemImage: "sparkle")
                    .font(.headline).foregroundStyle(WidgetPalette.ink)
                HStack(spacing: 10) {
                    Link(destination: LumenLink.url(prompt: nil)) {
                        Text("Ask anything")
                            .font(.body).foregroundStyle(.secondary)
                            .padding(.horizontal, 16)
                            .frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
                            .background(WidgetPalette.field, in: Capsule())
                    }
                    .accessibilityLabel("New Lumen chat")
                    talkButton(size: 48)
                }
            }
            .containerBackground(.background, for: .widget)
        default:
            VStack(alignment: .leading) {
                Label("Lumen", systemImage: "sparkle")
                    .font(.headline).foregroundStyle(WidgetPalette.ink)
                Spacer(minLength: 8)
                // A small widget is one tap area (a new chat), with the microphone as its own button.
                Text("Ask anything").font(.subheadline).foregroundStyle(.secondary)
                Spacer(minLength: 8)
                HStack {
                    Spacer()
                    talkButton(size: 52)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            .widgetURL(LumenLink.url(prompt: nil))
            .containerBackground(.background, for: .widget)
        }
    }

    /// Opens Lumen listening, through the same intent as Siri's "Talk to Lumen".
    private func talkButton(size: CGFloat) -> some View {
        Button(intent: TalkToLumenIntent()) {
            Image(systemName: "mic.fill")
                .font(.title3.weight(.semibold))
                .foregroundStyle(.white)
                .frame(width: size, height: size)
                .background(WidgetPalette.accent, in: Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Talk to Lumen")
    }
}

/// Control Center, the Lock Screen's controls and the Action button.
struct NewChatControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "io.github.seifonyx.lumen.control.new") {
            ControlWidgetButton(action: NewLumenChatIntent()) {
                Label("New Lumen Chat", systemImage: "square.and.pencil")
            }
        }
        .displayName("New Lumen Chat")
        .description("Opens a new chat in Lumen.")
    }
}

struct TalkControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "io.github.seifonyx.lumen.control.talk") {
            ControlWidgetButton(action: TalkToLumenIntent()) {
                Label("Talk to Lumen", systemImage: "mic")
            }
        }
        .displayName("Talk to Lumen")
        .description("Opens Lumen listening, so you can say your message.")
    }
}
