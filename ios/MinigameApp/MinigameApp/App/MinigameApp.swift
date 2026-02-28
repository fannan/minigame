import SwiftUI

@main
struct MinigameApp: App {
    @State private var playerProfile = PlayerProfile()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(playerProfile)
        }
    }
}
