import Foundation

public enum HistoryPaging {
    public static let pageSize = 60
    public static func pageIDs(orderedIDs: [String], loadedIDs: [String], older: Bool, limit: Int = pageSize) throws -> [String] {
        guard limit > 0, Set(orderedIDs).count == orderedIDs.count,
              orderedIDs.allSatisfy({ !$0.isEmpty && !$0.contains("/") && $0.utf8.count <= 1500 }) else { throw WebSyncError.invalid }
        let loaded = Set(loadedIDs)
        let end = older ? orderedIDs.firstIndex(where: loaded.contains) ?? orderedIDs.count : orderedIDs.count
        return Array(orderedIDs[max(0, end - limit)..<end])
    }
}

/// Pending work is already durable in ChatSnapshot; only its bounded delay is transient.
public struct SyncRetryQueue: Sendable {
    private var failures: [String: (attempt: Int, next: Date)] = [:]
    public init() {}
    public mutating func failed(chatID: String, at now: Date = Date()) {
        let attempt = min((failures[chatID]?.attempt ?? 0) + 1, 5)
        failures[chatID] = (attempt, now.addingTimeInterval(min(30, pow(2, Double(attempt)))))
    }
    public mutating func succeeded(chatID: String) { failures[chatID] = nil }
    public mutating func reset() { failures = [:] }
    public func blockedIDs(at now: Date = Date()) -> Set<String> { Set(failures.filter { $0.value.next > now }.keys) }
    public func nextDelay(at now: Date = Date()) -> TimeInterval? { failures.values.map { max(0.2, $0.next.timeIntervalSince(now)) }.min() }
}
