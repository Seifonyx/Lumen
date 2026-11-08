import SwiftUI
import UIKit

// Phase 0: real iOS 26+ SwiftUI navigation with the existing, account-connected
// Capacitor workspace retained in-process. This is NOT a second auth/data stack.
// Phase 1 can replace the Home surface with native conversation history.
private enum LumenNativeTab: Hashable {
    case home
    case workspace
}

@MainActor
private final class LumenWorkspaceOwner: ObservableObject {
    // Construct once. Never recreate the Google/Firestore WKWebView on a tab switch.
    let controller = DemoViewController()
}

struct LumenRootView: View {
    @StateObject private var workspace = LumenWorkspaceOwner()
    // Existing simulator smoke covers the canonical WebView. Native shell smoke
    // captures the real SwiftUI launch experience separately.
    @State private var selectedTab: LumenNativeTab =
        ProcessInfo.processInfo.arguments.contains("--demo-smoke") ? .workspace : .home

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack {
                LumenHomeView {
                    selectedTab = .workspace
                }
            }
            .tabItem { Label("Home", systemImage: "house") }
            .tag(LumenNativeTab.home)

            LumenWorkspaceView(controller: workspace.controller)
                .tabItem { Label("Lumen", systemImage: "bubble.left.and.bubble.right") }
                .tag(LumenNativeTab.workspace)
        }
        // iOS 26 system TabView uses native Liquid Glass, not CSS blur.
        .tint(Color.primary)
    }
}

private struct LumenWorkspaceView: UIViewControllerRepresentable {
    let controller: DemoViewController

    func makeUIViewController(context: Context) -> DemoViewController {
        controller
    }

    func updateUIViewController(_ controller: DemoViewController, context: Context) {
        // Keep the same protected controller and Google SDK callback routing.
    }
}

private struct CreaseSymbol: View {
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 19, style: .continuous)
                .fill(Color(uiColor: .label))
            GeometryReader { proxy in
                let w = proxy.size.width
                let h = proxy.size.height
                Path { path in
                    path.move(to: CGPoint(x: 0.25*w, y: 0.68*h))
                    path.addLine(to: CGPoint(x: 0.25*w, y: 0.29*h))
                    path.addLine(to: CGPoint(x: 0.49*w, y: 0.16*h))
                    path.addLine(to: CGPoint(x: 0.49*w, y: 0.55*h))
                    path.closeSubpath()
                }
                .fill(Color(uiColor: .systemBackground))
                Path { path in
                    path.move(to: CGPoint(x: 0.24*w, y: 0.75*h))
                    path.addLine(to: CGPoint(x: 0.49*w, y: 0.61*h))
                    path.addLine(to: CGPoint(x: 0.77*w, y: 0.77*h))
                    path.addLine(to: CGPoint(x: 0.53*w, y: 0.90*h))
                    path.closeSubpath()
                }
                .fill(Color(uiColor: .systemBackground).opacity(0.68))
            }
            .padding(10)
        }
        .accessibilityHidden(true)
    }
}

private struct LumenHomeView: View {
    let openWorkspace: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                HStack(alignment: .center, spacing: 16) {
                    CreaseSymbol()
                        .frame(width: 76, height: 76)
                    VStack(alignment: .leading, spacing: 5) {
                        Text("Lumen")
                            .font(.largeTitle.bold())
                        Text("A quieter place to think.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.top, 18)

                Text("Your workspace, wherever you are.")
                    .font(.title2.weight(.medium))
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 12)

                Text("Your current conversations, projects and Google sign-in remain in the Lumen workspace while native screens are introduced.")
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)

                openButton

                HStack(spacing: 11) {
                    Image(systemName: "checkmark.shield")
                        .symbolRenderingMode(.hierarchical)
                    Text("Same Lumen account and existing workspace")
                        .font(.subheadline)
                }
                .foregroundStyle(.secondary)
                .padding(.top, 4)

                Spacer(minLength: 30)
            }
            .frame(maxWidth: 540, alignment: .leading)
            .padding(.horizontal, 24)
            .padding(.bottom, 30)
            .frame(maxWidth: .infinity, alignment: .top)
        }
        .background(Color(uiColor: .systemBackground))
        .navigationTitle("Home")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                nativeToolbarButton
            }
        }
    }

    @ViewBuilder
    private var openButton: some View {
        if #available(iOS 26.0, *) {
            Button(action: openWorkspace) {
                Label("Open Lumen", systemImage: "arrow.up.right")
                    .font(.headline)
                    .frame(maxWidth: .infinity, minHeight: 42)
            }
            .buttonStyle(.glassProminent)
        } else {
            Button(action: openWorkspace) {
                Label("Open Lumen", systemImage: "arrow.up.right")
                    .font(.headline)
                    .frame(maxWidth: .infinity, minHeight: 42)
            }
            .buttonStyle(.borderedProminent)
        }
    }

    @ViewBuilder
    private var nativeToolbarButton: some View {
        if #available(iOS 26.0, *) {
            Button(action: openWorkspace) {
                Image(systemName: "arrow.up.right")
                    .accessibilityLabel("Open Lumen workspace")
            }
            .buttonStyle(.glass)
        } else {
            Button(action: openWorkspace) {
                Image(systemName: "arrow.up.right")
                    .accessibilityLabel("Open Lumen workspace")
            }
        }
    }
}
