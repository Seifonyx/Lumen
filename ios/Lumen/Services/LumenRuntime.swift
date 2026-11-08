import Foundation
import Observation
import LumenCore

@MainActor @Observable final class LumenRuntime {
    let composer: DraftState
    let engine: ChatEngine
    let auth: AuthEngine
    let connections: ProviderConnections
    let sync: CloudChatSync
    private var activeAccount: String?

    init() {
        let keys = KeychainProviderKeys()
        keys.migrateLegacyKey()
        composer = DraftState()
        engine = ChatEngine()
        auth = AuthEngine(client: FirebaseSession())
        connections = ProviderConnections(keyStore: keys)
        sync = CloudChatSync(engine: engine)
        sync.receiveKeys = { [weak connections] uid, keys in
            Task { @MainActor [weak connections] in
                guard let connections, connections.accountID == uid else { return }
                await connections.importAccountKeys(keys)
            }
        }
    }

    func start() async {
        await auth.start()
        accountChanged()
    }

    func accountChanged() {
        let id = auth.currentUser?.id ?? "device"
        guard activeAccount != id else { return }
        activeAccount = id
        composer.switchAccount(to: id)
        connections.activateAccount(to: id)
        sync.connect(userID: auth.currentUser?.id)
        Task { await connections.refresh() }
    }
}
