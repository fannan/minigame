import SwiftUI

struct ContentView: View {
    @State private var selectedTab: Tab = .home

    enum Tab: Hashable {
        case home
        case play
        case profile
    }

    var body: some View {
        TabView(selection: $selectedTab) {
            HomeView()
                .tabItem {
                    Label("Home", systemImage: "house.fill")
                }
                .tag(Tab.home)

            GameContainerView()
                .tabItem {
                    Label("Play", systemImage: "gamecontroller.fill")
                }
                .tag(Tab.play)

            ProfileView()
                .tabItem {
                    Label("Profile", systemImage: "person.fill")
                }
                .tag(Tab.profile)
        }
        .tint(.orange)
    }
}

#Preview {
    ContentView()
        .environment(PlayerProfile())
}
