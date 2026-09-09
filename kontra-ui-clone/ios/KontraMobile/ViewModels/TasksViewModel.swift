import Foundation

@MainActor
final class TasksViewModel: ObservableObject {
    @Published private(set) var tasks: [TaskItem] = []
    @Published private(set) var state: LoadState = .idle

    private var api: MobileAPIClient
    private let limit: Int

    init(limit: Int = 50, api: MobileAPIClient = APIClient()) {
        self.limit = limit
        self.api = api
    }

    func updateAPIClient(_ api: MobileAPIClient) {
        self.api = api
    }

    func load() async {
        state = .loading
        do {
            tasks = try await api.fetchTasks(limit: limit)
            state = .loaded
        } catch {
            #if DEBUG
            tasks = MockData.overview.tasks
            state = .loaded
            #else
            state = .failed(error.localizedDescription)
            #endif
        }
    }
}
