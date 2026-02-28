import Foundation
import SwiftUI

@Observable
final class PlayerProfile {

    // MARK: - Stored Properties

    var totalXP: Int {
        didSet { save() }
    }

    var streak: Int {
        didSet { save() }
    }

    var gamesPlayed: Int {
        didSet { save() }
    }

    var gamesWon: Int {
        didSet { save() }
    }

    // MARK: - Computed Properties

    var level: Int {
        Int(floor(sqrt(Double(totalXP) / 100.0))) + 1
    }

    /// XP threshold for the start of the current level.
    var xpForCurrentLevel: Int {
        let l = level - 1
        return l * l * 100
    }

    /// XP threshold for the next level.
    var xpForNextLevel: Int {
        level * level * 100
    }

    /// How much XP has been earned within the current level.
    var xpInCurrentLevel: Int {
        totalXP - xpForCurrentLevel
    }

    /// Total XP required to go from the current level to the next.
    var xpRequiredForNextLevel: Int {
        xpForNextLevel - xpForCurrentLevel
    }

    /// Progress from 0.0 to 1.0 within the current level.
    var levelProgress: Double {
        guard xpRequiredForNextLevel > 0 else { return 0 }
        return Double(xpInCurrentLevel) / Double(xpRequiredForNextLevel)
    }

    /// Win rate as a formatted percentage string.
    var winRate: String {
        guard gamesPlayed > 0 else { return "0%" }
        let rate = Double(gamesWon) / Double(gamesPlayed) * 100
        return "\(Int(rate))%"
    }

    // MARK: - Persistence Keys

    private enum Keys {
        static let totalXP = "player_totalXP"
        static let streak = "player_streak"
        static let gamesPlayed = "player_gamesPlayed"
        static let gamesWon = "player_gamesWon"
    }

    // MARK: - Init

    init() {
        let defaults = UserDefaults.standard
        self.totalXP = defaults.integer(forKey: Keys.totalXP)
        self.streak = defaults.integer(forKey: Keys.streak)
        self.gamesPlayed = defaults.integer(forKey: Keys.gamesPlayed)
        self.gamesWon = defaults.integer(forKey: Keys.gamesWon)
    }

    // MARK: - Methods

    func addXP(_ amount: Int) {
        totalXP += amount
    }

    func recordGame(won: Bool) {
        gamesPlayed += 1
        if won {
            gamesWon += 1
        }
    }

    func incrementStreak() {
        streak += 1
    }

    func resetStreak() {
        streak = 0
    }

    // MARK: - Persistence

    private func save() {
        let defaults = UserDefaults.standard
        defaults.set(totalXP, forKey: Keys.totalXP)
        defaults.set(streak, forKey: Keys.streak)
        defaults.set(gamesPlayed, forKey: Keys.gamesPlayed)
        defaults.set(gamesWon, forKey: Keys.gamesWon)
    }
}
