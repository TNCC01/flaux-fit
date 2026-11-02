// swift-tools-version: 5.9
// FIT's Apple Health plugin, for Swift Package Manager. The Capacitor CLI
// names a plugin's package after its npm name ("fit-health" -> "FitHealth")
// when it writes ios/App/CapApp-SPM/Package.swift, so the package and the
// library here carry that name. Laid out like Ionic's own plugins
// (@capacitor/haptics and the rest).
import PackageDescription

let package = Package(
    name: "FitHealth",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "FitHealth",
            targets: ["FitHealthPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")
    ],
    targets: [
        .target(
            name: "FitHealthPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/FitHealthPlugin",
            linkerSettings: [.linkedFramework("HealthKit")])
    ]
)
