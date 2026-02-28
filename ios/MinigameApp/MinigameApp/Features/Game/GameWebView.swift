import SwiftUI
import WebKit

struct GameWebView: UIViewRepresentable {
    let url: URL

    func makeCoordinator() -> NativeBridge {
        NativeBridge()
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()

        // Register message handlers
        let contentController = WKUserContentController()
        let messageNames: [NativeBridge.MessageName] = [
            .haptic, .playSound, .submitScore, .gameOver, .connect, .sendMove
        ]
        for name in messageNames {
            contentController.add(context.coordinator, name: name.rawValue)
        }

        configuration.userContentController = contentController
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []

        let preferences = WKWebpagePreferences()
        preferences.allowsContentJavaScript = true
        configuration.defaultWebpagePreferences = preferences

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.isInspectable = true
        webView.scrollView.isScrollEnabled = false
        webView.isOpaque = false
        webView.backgroundColor = .clear

        if url.isFileURL {
            // Allow read access to the parent "Games" directory so both
            // word-scramble/ and ../shared/bridge.js are accessible.
            let gamesDirectory = url
                .deletingLastPathComponent()   // word-scramble/
                .deletingLastPathComponent()   // Games/
            webView.loadFileURL(url, allowingReadAccessTo: gamesDirectory)
        } else {
            webView.load(URLRequest(url: url))
        }

        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        // No-op: URL changes are not supported after initial load
    }

    static func dismantleUIView(_ webView: WKWebView, coordinator: NativeBridge) {
        let contentController = webView.configuration.userContentController
        let messageNames: [NativeBridge.MessageName] = [
            .haptic, .playSound, .submitScore, .gameOver, .connect, .sendMove
        ]
        for name in messageNames {
            contentController.removeScriptMessageHandler(forName: name.rawValue)
        }
    }

}
