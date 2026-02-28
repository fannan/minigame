import SwiftUI

struct GameContainerView: View {
    var initialGameURL: URL? = nil

    @Environment(\.dismiss) private var dismiss
    @Environment(PlayerProfile.self) private var profile

    @State private var elapsedSeconds: Int = 0
    @State private var isGameActive: Bool = false
    @State private var gameURL: URL?
    @State private var showExitConfirmation: Bool = false
    @State private var gameResult: GameResult?

    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()

                if let result = gameResult {
                    resultsView(result: result)
                        .transition(.opacity)
                } else if let url = gameURL, isGameActive {
                    GameWebView(url: url)
                        .ignoresSafeArea(edges: .bottom)
                } else {
                    waitingView
                }
            }
            .animation(.easeInOut(duration: 0.3), value: gameResult != nil)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    if isGameActive && gameResult == nil {
                        Button {
                            showExitConfirmation = true
                        } label: {
                            Image(systemName: "xmark")
                                .fontWeight(.semibold)
                                .foregroundStyle(.white)
                        }
                    }
                }
            }
            .toolbarBackground(.hidden, for: .navigationBar)
            .navigationBarTitleDisplayMode(.inline)
            .confirmationDialog(
                "Leave Game?",
                isPresented: $showExitConfirmation,
                titleVisibility: .visible
            ) {
                Button("Leave", role: .destructive) {
                    endGame()
                    if initialGameURL != nil { dismiss() }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("You will forfeit this round if you leave now.")
            }
            .onReceive(timer) { _ in
                if isGameActive && gameResult == nil {
                    elapsedSeconds += 1
                }
            }
            .onReceive(
                NotificationCenter.default.publisher(for: .gameDidEnd)
            ) { notification in
                handleGameOver(notification: notification)
            }
            .onAppear {
                if let url = initialGameURL {
                    startGame(url: url)
                }
            }
        }
    }

    // MARK: - Results View

    private func resultsView(result: GameResult) -> some View {
        VStack(spacing: 32) {
            Spacer()

            VStack(spacing: 8) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 56))
                    .foregroundStyle(.orange)

                Text("Game Over")
                    .font(.system(.title, design: .rounded))
                    .fontWeight(.bold)
                    .foregroundStyle(.white)
            }

            // Score
            VStack(spacing: 4) {
                Text("\(result.score)")
                    .font(.system(size: 64, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                Text("POINTS")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(.secondary)
                    .tracking(2)
            }

            // Stats row
            HStack(spacing: 32) {
                VStack(spacing: 4) {
                    Text("\(result.wordsSolved)")
                        .font(.system(.title2, design: .rounded))
                        .fontWeight(.bold)
                        .foregroundStyle(.white)
                    Text("words")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                VStack(spacing: 4) {
                    Text("\(result.bestStreak)")
                        .font(.system(.title2, design: .rounded))
                        .fontWeight(.bold)
                        .foregroundStyle(.white)
                    Text("best streak")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                VStack(spacing: 4) {
                    Text(String(format: "%.0f", result.duration))
                        .font(.system(.title2, design: .rounded))
                        .fontWeight(.bold)
                        .foregroundStyle(.white)
                    Text("seconds")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            // XP earned
            HStack(spacing: 6) {
                Image(systemName: "star.fill")
                    .foregroundStyle(.orange)
                Text("+50 XP")
                    .font(.system(.body, design: .rounded))
                    .fontWeight(.semibold)
                    .foregroundStyle(.orange)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 10)
            .background(.orange.opacity(0.15))
            .clipShape(Capsule())

            Spacer()

            // Action buttons
            VStack(spacing: 12) {
                Button {
                    if let url = initialGameURL ?? gameURL {
                        gameResult = nil
                        startGame(url: url)
                    }
                } label: {
                    Text("Play Again")
                        .font(.system(.body, design: .rounded))
                        .fontWeight(.semibold)
                        .foregroundStyle(.black)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(.orange)
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                }

                Button {
                    endGame()
                    if initialGameURL != nil { dismiss() }
                } label: {
                    Text("Done")
                        .font(.system(.body, design: .rounded))
                        .fontWeight(.medium)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                }
            }
            .padding(.horizontal)
            .padding(.bottom, 20)
        }
        .padding()
    }

    // MARK: - Waiting View

    private var waitingView: some View {
        VStack(spacing: 24) {
            Image(systemName: "gamecontroller.fill")
                .font(.system(size: 60))
                .foregroundStyle(.tertiary)

            VStack(spacing: 8) {
                Text("No Active Game")
                    .font(.title3)
                    .fontWeight(.semibold)

                Text("Start today's game from the Home tab.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
        }
        .padding()
    }

    // MARK: - Game Lifecycle

    private func startGame(url: URL) {
        gameURL = url
        elapsedSeconds = 0
        isGameActive = true
    }

    private func endGame() {
        isGameActive = false
        gameURL = nil
        gameResult = nil
        elapsedSeconds = 0
    }

    private func handleGameOver(notification: Notification) {
        guard let result = notification.userInfo?["result"] as? GameResult else {
            // If notification doesn't have proper result, create one from elapsed time
            gameResult = GameResult(score: 0, wordsSolved: 0, bestStreak: 0, duration: TimeInterval(elapsedSeconds))
            return
        }
        gameResult = result
    }
}

// MARK: - Game Result

struct GameResult {
    let score: Int
    let wordsSolved: Int
    let bestStreak: Int
    let duration: TimeInterval
}

// MARK: - Notification Names

extension Notification.Name {
    static let gameDidEnd = Notification.Name("gameDidEnd")
    static let scoreSubmitted = Notification.Name("scoreSubmitted")
}

#Preview {
    GameContainerView()
}
