import Foundation

actor APIClient {

    // MARK: - Properties

    let baseURL: URL

    private let session: URLSession
    private let decoder: JSONDecoder

    // MARK: - Init

    init(baseURL: URL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        self.decoder = decoder
    }

    // MARK: - Generic Request

    func request<T: Decodable & Sendable>(
        path: String,
        method: HTTPMethod = .get,
        body: (any Encodable & Sendable)? = nil,
        queryItems: [URLQueryItem]? = nil
    ) async throws -> T {
        var components = URLComponents(url: baseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false)
        components?.queryItems = queryItems

        guard let url = components?.url else {
            throw APIError.invalidURL
        }

        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = method.rawValue
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let body {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            urlRequest.httpBody = try encoder.encode(body)
        }

        let (data, response) = try await session.data(for: urlRequest)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard (200..<300).contains(httpResponse.statusCode) else {
            throw APIError.httpError(statusCode: httpResponse.statusCode, data: data)
        }

        return try decoder.decode(T.self, from: data)
    }

    // MARK: - Convenience Methods

    func fetchSchedule() async throws -> ScheduleResponse {
        try await request(path: "/api/schedule")
    }

    func submitScore(gameID: String, score: Int) async throws -> ScoreSubmissionResponse {
        let body = ScoreSubmissionRequest(gameID: gameID, score: score)
        return try await request(path: "/api/scores", method: .post, body: body)
    }

    func fetchLeaderboard(gameID: String) async throws -> LeaderboardResponse {
        try await request(
            path: "/api/leaderboard",
            queryItems: [URLQueryItem(name: "game_id", value: gameID)]
        )
    }
}

// MARK: - HTTP Method

enum HTTPMethod: String, Sendable {
    case get = "GET"
    case post = "POST"
    case put = "PUT"
    case delete = "DELETE"
}

// MARK: - API Error

enum APIError: LocalizedError, Sendable {
    case invalidURL
    case invalidResponse
    case httpError(statusCode: Int, data: Data)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "The request URL is invalid."
        case .invalidResponse:
            return "The server returned an invalid response."
        case .httpError(let statusCode, _):
            return "HTTP error \(statusCode)."
        }
    }
}

// MARK: - Request / Response Types

struct ScoreSubmissionRequest: Encodable, Sendable {
    let gameID: String
    let score: Int

    enum CodingKeys: String, CodingKey {
        case gameID = "game_id"
        case score
    }
}

struct ScoreSubmissionResponse: Decodable, Sendable {
    let accepted: Bool
    let rank: Int?
    let xpAwarded: Int

    enum CodingKeys: String, CodingKey {
        case accepted
        case rank
        case xpAwarded = "xp_awarded"
    }
}
