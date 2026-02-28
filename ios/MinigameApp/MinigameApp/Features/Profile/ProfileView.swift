import SwiftUI

struct ProfileView: View {
    @Environment(PlayerProfile.self) private var profile

    // MARK: - Theme

    private let accent = Color.orange

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    avatarSection
                    levelProgressSection
                    streakSection
                    gameStatsSection
                    trophySection
                }
                .padding()
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Profile")
        }
    }

    // MARK: - Avatar

    private var avatarSection: some View {
        VStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [
                                Color(red: 0.18, green: 0.16, blue: 0.14),
                                Color(red: 0.12, green: 0.10, blue: 0.09)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 80, height: 80)

                Image(systemName: "person.fill")
                    .font(.system(size: 36))
                    .foregroundStyle(.white.opacity(0.85))
            }
            .overlay(alignment: .bottomTrailing) {
                Text("Lv.\(profile.level)")
                    .font(.system(.caption2, design: .rounded))
                    .fontWeight(.bold)
                    .foregroundStyle(.black)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(accent)
                    .clipShape(Capsule())
                    .offset(x: 4, y: 4)
            }

            Text("Player")
                .font(.title3)
                .fontWeight(.semibold)

            Text("\(profile.totalXP) XP total")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
    }

    // MARK: - Level Progress

    private var levelProgressSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("Level \(profile.level)", systemImage: "arrow.up.circle.fill")
                    .font(.headline)
                    .foregroundStyle(.primary)
                Spacer()
                Text("Level \(profile.level + 1)")
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundStyle(accent)
            }

            VStack(alignment: .leading, spacing: 6) {
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 6)
                            .fill(Color(.tertiarySystemFill))
                            .frame(height: 8)

                        RoundedRectangle(cornerRadius: 6)
                            .fill(
                                LinearGradient(
                                    colors: [accent, accent.opacity(0.7)],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .frame(
                                width: max(0, geo.size.width * profile.levelProgress),
                                height: 8
                            )
                    }
                }
                .frame(height: 8)

                HStack {
                    Text("\(profile.xpInCurrentLevel) / \(profile.xpRequiredForNextLevel) XP")
                        .font(.system(.caption, design: .rounded))
                        .foregroundStyle(.secondary)
                    Spacer()
                    Text("\(Int(profile.levelProgress * 100))%")
                        .font(.system(.caption, design: .rounded))
                        .fontWeight(.medium)
                        .foregroundStyle(accent)
                }
            }
        }
        .padding()
        .background(.background)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .shadow(color: .black.opacity(0.04), radius: 4, y: 2)
    }

    // MARK: - Streak

    private var streakSection: some View {
        HStack(spacing: 0) {
            // Flame + count on the left
            VStack(spacing: 4) {
                Image(systemName: "flame.fill")
                    .font(.system(size: 36))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [accent, .red],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                Text("\(profile.streak)")
                    .font(.system(.title, design: .rounded))
                    .fontWeight(.bold)
                Text("days")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .frame(width: 80)

            // Divider
            Rectangle()
                .fill(Color(.separator))
                .frame(width: 1, height: 50)
                .padding(.horizontal, 12)

            // Message on the right
            VStack(alignment: .leading, spacing: 4) {
                Text(profile.streak > 0 ? "Streak Active" : "No Streak")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                Text(profile.streak > 0
                     ? "Keep it going! Play today to maintain your streak."
                     : "Play a game to start a new streak!")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }

            Spacer()
        }
        .padding()
        .background(
            LinearGradient(
                colors: [accent.opacity(0.08), Color(.systemBackground)],
                startPoint: .leading,
                endPoint: .trailing
            )
        )
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(accent.opacity(0.15), lineWidth: 1)
        )
    }

    // MARK: - Game Stats

    private var gameStatsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Stats")
                .font(.headline)

            HStack(spacing: 0) {
                statItem(
                    value: "\(profile.gamesPlayed)",
                    label: "Played",
                    icon: "gamecontroller.fill",
                    color: .secondary
                )

                Divider()
                    .frame(height: 40)

                statItem(
                    value: "\(profile.gamesWon)",
                    label: "Won",
                    icon: "trophy.fill",
                    color: accent
                )

                Divider()
                    .frame(height: 40)

                statItem(
                    value: profile.winRate,
                    label: "Win Rate",
                    icon: "percent",
                    color: accent
                )
            }
        }
        .padding()
        .background(.background)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .shadow(color: .black.opacity(0.04), radius: 4, y: 2)
    }

    private func statItem(value: String, label: String, icon: String, color: Color) -> some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(color)

            Text(value)
                .font(.system(.title2, design: .rounded))
                .fontWeight(.bold)

            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Trophies

    private var trophySection: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Trophies")
                    .font(.headline)
                Spacer()
                Text("0 / 12")
                    .font(.system(.subheadline, design: .rounded))
                    .foregroundStyle(.secondary)
            }

            LazyVGrid(
                columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 4),
                spacing: 12
            ) {
                ForEach(0..<12, id: \.self) { index in
                    trophyPlaceholder(index: index)
                }
            }

            // Empty state hint
            HStack(spacing: 6) {
                Image(systemName: "info.circle")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
                Text("Win games to unlock trophies")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
            .frame(maxWidth: .infinity, alignment: .center)
        }
        .padding()
        .background(.background)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .shadow(color: .black.opacity(0.04), radius: 4, y: 2)
    }

    private func trophyPlaceholder(index: Int) -> some View {
        RoundedRectangle(cornerRadius: 10)
            .fill(Color(.tertiarySystemFill))
            .aspectRatio(1, contentMode: .fit)
            .overlay {
                VStack(spacing: 4) {
                    Image(systemName: "lock.fill")
                        .font(.body)
                        .foregroundStyle(Color(.quaternaryLabel))
                    Text("???")
                        .font(.system(.caption2, design: .rounded))
                        .foregroundStyle(Color(.quaternaryLabel))
                }
            }
    }
}

#Preview {
    ProfileView()
        .environment(PlayerProfile())
}
