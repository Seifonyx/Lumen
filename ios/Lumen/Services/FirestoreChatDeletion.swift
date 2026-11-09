import Foundation
import FirebaseFirestore
import LumenCore

@MainActor final class FirestoreChatDeletion: ChatDeletionBackend {
    private let db: Firestore
    private let userID: String
    init(db: Firestore, userID: String) { self.db = db; self.userID = userID }
    private func chat(_ id: String) -> DocumentReference { db.collection("modelRouter").document(userID).collection("chats").document(id) }
    func markDeleted(chatID: String) async throws {
        let now = Date().timeIntervalSince1970 * 1000
        // Keep only the coordination tombstone, as the web deletion path does.
        try await chat(chatID).setData(["deleted": true, "updatedAt": now, "rev": now, "srv": FieldValue.serverTimestamp()])
    }
    func deleteMessageBatch(chatID: String) async throws -> Bool {
        let snapshot = try await chat(chatID).collection("messages").limit(to: 50).getDocuments(source: .server)
        return try await remove(snapshot.documents)
    }
    func deleteOriginalBatch(chatID: String) async throws -> Bool {
        let snapshot = try await db.collection("modelRouter").document(userID).collection("files")
            .whereField("chatId", isEqualTo: chatID).limit(to: 50).getDocuments(source: .server)
        return try await remove(snapshot.documents)
    }
    private func remove(_ documents: [QueryDocumentSnapshot]) async throws -> Bool {
        guard !documents.isEmpty else { return false }
        let batch = db.batch()
        for document in documents { batch.deleteDocument(document.reference) }
        try await batch.commit()
        return true
    }
}
