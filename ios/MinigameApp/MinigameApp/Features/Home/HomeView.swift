import SwiftUI

struct HomeView: View {
    @Environment(PlayerProfile.self) private var profile
    @State private var isPlayingGame = false

    // MARK: - Theme

    private let accent = Color.orange
    private let cardGradient = LinearGradient(
        colors: [
            Color(red: 0.14, green: 0.13, blue: 0.12),
            Color(red: 0.09, green: 0.08, blue: 0.07)
        ],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    greetingSection
                    todaysGameCard
                    quickStatsRow
                }
                .padding()
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Minigame")
            .fullScreenCover(isPresented: $isPlayingGame) {
                if let url = Bundle.main.url(
                    forResource: "index",
                    withExtension: "html",
                    subdirectory: "Games/word-scramble"
                ) {
                    GameContainerView(initialGameURL: url)
                } else {
                    Text("Game not found")
                }
            }
        }
    }

    // MARK: - Greeting

    private var greetingSection: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(greetingText)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Text("Ready to play?")
                    .font(.title2)
                    .fontWeight(.bold)
            }
            Spacer()
            streakBadge
        }
    }

    private var streakBadge: some View {
        HStack(spacing: 4) {
            Image(systemName: "flame.fill")
                .font(.body)
                .foregroundStyle(accent)
            Text("\(profile.streak)")
                .font(.system(.body, design: .rounded))
                .fontWeight(.bold)
                .foregroundStyle(accent)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(accent.opacity(0.12))
        .clipShape(Capsule())
    }

    private var greetingText: String {
        let hour = Calendar.current.component(.hour, from: .now)
        switch hour {
        case 0..<12: return "Good morning"
        case 12..<17: return "Good afternoon"
        default: return "Good evening"
        }
    }

    // MARK: - Today's Game Card

    private var todaysGameCard: some View {
        VStack(alignment: .leading, spacing: 20) {
            // Header
            HStack {
                Text("TODAY'S GAME")
                    .font(.caption)
                    .fontWeight(.bold)
                    .tracking(1.2)
                    .foregroundStyle(.white.opacity(0.5))
                Spacer()
                Image(systemName: "calendar")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.4))
            }

            // Title and description
            VStack(alignment: .leading, spacing: 8) {
                Text("Word Scramble")
                    .font(.system(.title, design: .rounded))
                    .fontWeight(.bold)
                    .foregroundStyle(.white)

                Text("Unscramble letters to form words before time runs out.")
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.65))
                    .lineLimit(2)
            }

            // Meta tags
            HStack(spacing: 14) {
                Label("2-4 players", systemImage: "person.2.fill")
                Label("3 min", systemImage: "clock.fill")
                Label("+50 XP", systemImage: "star.fill")
                    .foregroundStyle(accent)
            }
            .font(.caption)
            .foregroundStyle(.white.opacity(0.55))

            // Play button
            Button {
                isPlayingGame = true
            } label: {
                HStack {
                    Image(systemName: "play.fill")
                        .font(.subheadline)
                    Text("Play Now")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                }
                .foregroundStyle(.black)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(accent)
                .clipShape(RoundedRectangle(cornerRadius: 14))
            }
        }
        .padding(20)
        .background(cardGradient)
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .shadow(color: .black.opacity(0.2), radius: 16, y: 8)
    }

    // MARK: - Quick Stats

    private var quickStatsRow: some View {
        HStack(spacing: 12) {
            StatCard(
                title: "Level",
                value: "\(profile.level)",
                icon: "arrow.up.circle.fill",
                color: accent
            )
            StatCard(
                title: "Played",
                value: "\(profile.gamesPlayed)",
                icon: "gamecontroller.fill",
                color: .secondary
            )
            StatCard(
                title: "Won",
                value: "\(profile.gamesWon)",
                icon: "trophy.fill",
                color: accent
            )
        }
    }
}

// MARK: - Stat Card

private struct StatCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundStyle(color)

            Text(value)
                .font(.system(.title3, design: .rounded))
                .fontWeight(.bold)

            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 16)
        .background(.background)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .shadow(color: .black.opacity(0.04), radius: 4, y: 2)
    }
}

#Preview {
    HomeView()
        .environment(PlayerProfile())
}
