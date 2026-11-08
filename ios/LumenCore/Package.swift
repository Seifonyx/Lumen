// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "LumenCore",
    platforms: [.iOS("26.0"), .macOS(.v14)],
    products: [.library(name: "LumenCore", targets: ["LumenCore"])],
    targets: [
        .target(name: "LumenCore"),
        .testTarget(name: "LumenCoreTests", dependencies: ["LumenCore"])
    ]
)
