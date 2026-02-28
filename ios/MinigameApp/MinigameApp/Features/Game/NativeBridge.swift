import UIKit
import WebKit
import Combine

final class NativeBridge: NSObject, WKScriptMessageHandler {

    // MARK: - Message Names

    enum MessageName: String, CaseIterable {
        case haptic
        case playSound
        case submitScore
        case gameOver
        case connect
        case sendMove
    }

    // MARK: - Haptic Style

    private enum HapticStyle: String {
        case light, medium, heavy, success, error
    }

    // MARK: - WKScriptMessageHandler

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard let messageName = MessageName(rawValue: message.name) else { return }
        let body = message.body as? [String: Any] ?? [:]

        switch messageName {
        case .haptic:
            handleHaptic(body: body)
        case .playSound:
            handlePlaySound(body: body)
        case .submitScore:
            handleSubmitScore(body: body)
        case .gameOver:
            handleGameOver(body: body)
        case .connect:
            handleConnect(body: body)
        case .sendMove:
            handleSendMove(body: body)
        }
    }

    // MARK: - Haptic Feedback

    private func handleHaptic(body: [String: Any]) {
        let styleString = body["style"] as? String ?? "medium"
        let style = HapticStyle(rawValue: styleString) ?? .medium

        switch style {
        case .light:
            let generator = UIImpactFeedbackGenerator(style: .light)
            generator.impactOccurred()
        case .medium:
            let generator = UIImpactFeedbackGenerator(style: .medium)
            generator.impactOccurred()
        case .heavy:
            let generator = UIImpactFeedbackGenerator(style: .heavy)
            generator.impactOccurred()
        case .success:
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.success)
        case .error:
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.error)
        }
    }

    // MARK: - Sound

    private func handlePlaySound(body: [String: Any]) {
        guard let name = body["name"] as? String else { return }
        // Placeholder: integrate with AVAudioPlayer or AudioServicesPlaySystemSound
        print("[NativeBridge] playSound: \(name)")
    }

    // MARK: - Score Submission

    private func handleSubmitScore(body: [String: Any]) {
        guard let score = body["score"] as? Int else { return }
        NotificationCenter.default.post(
            name: .scoreSubmitted,
            object: nil,
            userInfo: ["score": score]
        )
    }

    // MARK: - Game Over

    private func handleGameOver(body: [String: Any]) {
        let score = body["score"] as? Int ?? 0
        let wordsSolved = body["wordsSolved"] as? Int ?? 0
        let bestStreak = body["bestStreak"] as? Int ?? 0
        let duration = body["duration"] as? Double ?? 60

        let result = GameResult(score: score, wordsSolved: wordsSolved, bestStreak: bestStreak, duration: duration)
        NotificationCenter.default.post(
            name: .gameDidEnd,
            object: nil,
            userInfo: ["result": result]
        )
    }

    // MARK: - Multiplayer

    private func handleConnect(body: [String: Any]) {
        // Placeholder: establish WebSocket or peer connection
        print("[NativeBridge] connect: \(body)")
    }

    private func handleSendMove(body: [String: Any]) {
        // Placeholder: forward move to multiplayer transport
        print("[NativeBridge] sendMove: \(body)")
    }
}
