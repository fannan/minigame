import Foundation
import CryptoKit

actor GameBundleManager {

    // MARK: - Properties

    private let cacheDirectory: URL
    private let session: URLSession

    // MARK: - Init

    init(session: URLSession = .shared) {
        let documentsURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        self.cacheDirectory = documentsURL.appendingPathComponent("GameBundles", isDirectory: true)
        self.session = session
    }

    // MARK: - Public API

    /// Returns a local file URL for the game bundle, downloading and verifying if needed.
    func localBundleURL(for manifest: GameManifest) async throws -> URL {
        let bundleDir = cacheDirectory.appendingPathComponent(manifest.id, isDirectory: true)
        let indexFile = bundleDir.appendingPathComponent("index.html")

        // Return cached bundle if it already exists and is verified
        if FileManager.default.fileExists(atPath: indexFile.path) {
            return indexFile
        }

        // Download, verify, and cache
        return try await downloadAndCache(manifest: manifest)
    }

    /// Check if a bundle is already cached locally.
    func isCached(gameID: String) -> Bool {
        let bundleDir = cacheDirectory.appendingPathComponent(gameID, isDirectory: true)
        let indexFile = bundleDir.appendingPathComponent("index.html")
        return FileManager.default.fileExists(atPath: indexFile.path)
    }

    /// Remove a cached bundle.
    func removeBundle(gameID: String) throws {
        let bundleDir = cacheDirectory.appendingPathComponent(gameID, isDirectory: true)
        if FileManager.default.fileExists(atPath: bundleDir.path) {
            try FileManager.default.removeItem(at: bundleDir)
        }
    }

    /// Remove all cached bundles.
    func clearCache() throws {
        if FileManager.default.fileExists(atPath: cacheDirectory.path) {
            try FileManager.default.removeItem(at: cacheDirectory)
        }
    }

    // MARK: - Private

    private func downloadAndCache(manifest: GameManifest) async throws -> URL {
        // Ensure cache directory exists
        try FileManager.default.createDirectory(
            at: cacheDirectory,
            withIntermediateDirectories: true
        )

        // Download bundle data
        let (tempFileURL, response) = try await session.download(from: manifest.bundleURL)

        guard let httpResponse = response as? HTTPURLResponse,
              (200..<300).contains(httpResponse.statusCode) else {
            throw BundleError.downloadFailed
        }

        // Read downloaded data and verify SHA-256
        let data = try Data(contentsOf: tempFileURL)
        let hash = SHA256.hash(data: data)
        let hashString = hash.compactMap { String(format: "%02x", $0) }.joined()

        guard hashString == manifest.sha256 else {
            // Clean up temp file
            try? FileManager.default.removeItem(at: tempFileURL)
            throw BundleError.hashMismatch(expected: manifest.sha256, actual: hashString)
        }

        // Prepare destination
        let bundleDir = cacheDirectory.appendingPathComponent(manifest.id, isDirectory: true)
        if FileManager.default.fileExists(atPath: bundleDir.path) {
            try FileManager.default.removeItem(at: bundleDir)
        }
        try FileManager.default.createDirectory(at: bundleDir, withIntermediateDirectories: true)

        // Unzip or copy depending on content type
        let contentType = httpResponse.value(forHTTPHeaderField: "Content-Type") ?? ""
        if contentType.contains("zip") || manifest.bundleURL.pathExtension == "zip" {
            try unzip(data: data, to: bundleDir)
        } else {
            // Single HTML file
            let indexFile = bundleDir.appendingPathComponent("index.html")
            try data.write(to: indexFile, options: .atomic)
        }

        // Clean up temp file
        try? FileManager.default.removeItem(at: tempFileURL)

        let indexFile = bundleDir.appendingPathComponent("index.html")
        guard FileManager.default.fileExists(atPath: indexFile.path) else {
            throw BundleError.missingIndex
        }

        return indexFile
    }

    /// Minimal ZIP extraction using Process is not available on iOS.
    /// In production, use a library like ZIPFoundation. This is a placeholder.
    private func unzip(data: Data, to directory: URL) throws {
        // Placeholder: write the raw data as index.html for now.
        // Replace with proper ZIP extraction (e.g., ZIPFoundation) when adding the dependency.
        let indexFile = directory.appendingPathComponent("index.html")
        try data.write(to: indexFile, options: .atomic)
    }
}

// MARK: - Bundle Errors

enum BundleError: LocalizedError, Sendable {
    case downloadFailed
    case hashMismatch(expected: String, actual: String)
    case missingIndex
    case extractionFailed

    var errorDescription: String? {
        switch self {
        case .downloadFailed:
            return "Failed to download the game bundle."
        case .hashMismatch(let expected, let actual):
            return "Bundle integrity check failed. Expected \(expected), got \(actual)."
        case .missingIndex:
            return "The game bundle does not contain an index.html file."
        case .extractionFailed:
            return "Failed to extract the game bundle."
        }
    }
}
