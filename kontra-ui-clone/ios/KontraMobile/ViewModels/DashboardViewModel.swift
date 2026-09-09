import Foundation

@MainActor
final class DashboardViewModel: ObservableObject {
    @Published private(set) var overview: MobileOverview?
    @Published private(set) var state: LoadState = .idle

    private var api: MobileAPIClient

    init(api: MobileAPIClient = APIClient()) {
        self.api = api
    }

    func updateAPIClient(_ api: MobileAPIClient) {
        self.api = api
    }

    func load() async {
        state = .loading
        do {
            overview = try await api.fetchOverview()
            state = .loaded
        } catch {
            #if DEBUG
            overview = MockData.overview
            state = .loaded
            #else
            state = .failed(error.localizedDescription)
            #endif
        }
    }
}
