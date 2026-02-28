import Foundation

struct GameManifest: Codable, Identifiable, Sendable {
    let id: String
    let title: String
    let description: String
    let date: Date
    let minPlayers: Int
    let maxPlayers: Int
    let duration: TimeInterval
    let xpReward: Int
    let bundleURL: URL
    let sha256: String

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case description
        case date
        case minPlayers = "min_players"
        case maxPlayers = "max_players"
        case duration
        case xpReward = "xp_reward"
        case bundleURL = "bundle_url"
        case sha256
    }
}

// MARK: - Schedule Response

struct ScheduleResponse: Codable, Sendable {
    let games: [GameManifest]
}

// MARK: - Leaderboard

struct LeaderboardEntry: Codable, Identifiable, Sendable {
    let id: String
    let playerName: String
    let score: Int
    let rank: Int

    enum CodingKeys: String, CodingKey {
        case id
        case playerName = "player_name"
        case score
        case rank
    }
}

struct LeaderboardResponse: Codable, Sendable {
    let entries: [LeaderboardEntry]
}
