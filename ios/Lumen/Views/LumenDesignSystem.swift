import SwiftUI
import UIKit

// Shared native design tokens. These resolve from the current appearance,
// including the System / Light / Dark setting inside Lumen.
enum LumenPalette {
    private static func adaptive(_ light: UIColor, _ dark: UIColor) -> Color {
        Color(uiColor: UIColor { traits in
            traits.userInterfaceStyle == .dark ? dark : light
        })
    }

    static let canvas = adaptive(
        UIColor(red: 0.972, green: 0.976, blue: 0.982, alpha: 1),
        UIColor(red: 0.043, green: 0.047, blue: 0.059, alpha: 1))
    static let surface = adaptive(
        UIColor(red: 1, green: 1, blue: 1, alpha: 1),
        UIColor(red: 0.091, green: 0.098, blue: 0.114, alpha: 1))
    static let elevated = adaptive(
        UIColor(red: 0.932, green: 0.941, blue: 0.954, alpha: 1),
        UIColor(red: 0.144, green: 0.157, blue: 0.179, alpha: 1))
    static let stroke = adaptive(
        UIColor(red: 0.865, green: 0.883, blue: 0.904, alpha: 1),
        UIColor(red: 0.208, green: 0.223, blue: 0.249, alpha: 1))
    static let accent = adaptive(
        UIColor(red: 0.228, green: 0.317, blue: 0.441, alpha: 1),
        UIColor(red: 0.792, green: 0.859, blue: 0.955, alpha: 1))
    static let accentOnFill = adaptive(
        UIColor.white,
        UIColor(red: 0.082, green: 0.102, blue: 0.133, alpha: 1))
    static let ink = adaptive(
        UIColor(red: 0.105, green: 0.125, blue: 0.164, alpha: 1),
        UIColor(red: 0.962, green: 0.974, blue: 0.991, alpha: 1))
    static let muted = adaptive(
        UIColor(red: 0.413, green: 0.459, blue: 0.514, alpha: 1),
        UIColor(red: 0.666, green: 0.705, blue: 0.761, alpha: 1))
    static let selection = adaptive(
        UIColor(red: 0.858, green: 0.896, blue: 0.942, alpha: 1),
        UIColor(red: 0.171, green: 0.218, blue: 0.280, alpha: 1))
}

enum LumenRadius {
    static let compact: CGFloat = 12
    static let card: CGFloat = 18
    static let message: CGFloat = 20
    static let composer: CGFloat = 26
}

enum LumenSpacing {
    static let screen: CGFloat = 20
    static let control: CGFloat = 12
    static let section: CGFloat = 22
}

enum LumenType {
    static let brand = Font.system(.title2, design: .rounded, weight: .semibold)
    static let section = Font.system(.subheadline, design: .rounded, weight: .semibold)
    static let row = Font.system(.body, design: .default, weight: .medium)
    static let control = Font.system(.subheadline, design: .default, weight: .semibold)
    static let detail = Font.system(.caption, design: .default)
}

struct LumenSurfaceModifier: ViewModifier {
    var radius: CGFloat = LumenRadius.card

    func body(content: Content) -> some View {
        content
            .background(LumenPalette.surface, in: RoundedRectangle(cornerRadius: radius, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .strokeBorder(LumenPalette.stroke.opacity(0.75), lineWidth: 1)
                    .allowsHitTesting(false)
            }
    }
}

extension View {
    func lumenSurface(radius: CGFloat = LumenRadius.card) -> some View {
        modifier(LumenSurfaceModifier(radius: radius))
    }
}

struct LumenPrimaryButtonStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(LumenType.control)
            .foregroundStyle(LumenPalette.accentOnFill)
            .padding(.horizontal, 16)
            .frame(minHeight: 44)
            .background(LumenPalette.accent, in: Capsule())
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(reduceMotion ? nil : .easeOut(duration: 0.16), value: configuration.isPressed)
    }
}

struct LumenRowButtonStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
            .background(
                configuration.isPressed ? LumenPalette.selection : .clear,
                in: RoundedRectangle(cornerRadius: LumenRadius.compact, style: .continuous)
            )
            .contentShape(Rectangle())
            .animation(reduceMotion ? nil : .easeOut(duration: 0.14), value: configuration.isPressed)
    }
}
