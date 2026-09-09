import Foundation

@MainActor
final class ApplicationsViewModel: ObservableObject {
    @Published private(set) var applications: [LoanApplication] = []
    @Published private(set) var state: LoadState = .idle

    private var api: MobileAPIClient
    private let limit: Int

    init(limit: Int = 25, api: MobileAPIClient = APIClient()) {
        self.limit = limit
        self.api = api
    }

    func updateAPIClient(_ api: MobileAPIClient) {
        self.api = api
    }

    func load() async {
        state = .loading
        do {
            applications = try await api.fetchApplications(limit: limit)
            state = .loaded
        } catch {
            #if DEBUG
            applications = MockData.overview.applications
            state = .loaded
            #else
            state = .failed(error.localizedDescription)
            #endif
        }
    }
}
