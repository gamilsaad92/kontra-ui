import Foundation

@MainActor
final class InvestorViewModel: ObservableObject {
    @Published private(set) var data: InvestorData?
    @Published private(set) var state: LoadState = .idle

    private var api: MobileAPIClient

    init(api: MobileAPIClient = APIClient()) {
        self.api = api
    }

    func load() async {
        state = .loading
        do {
            async let holdings     = api.fetchInvestorHoldings()
            async let dists        = api.fetchInvestorDistributions()
            async let performance  = api.fetchInvestorPerformance()
            async let alerts       = api.fetchInvestorAlerts()

            let (h, d, p, a) = try await (holdings, dists, performance, alerts)
            data = InvestorData(holdings: h, distributions: d, performance: p, alerts: a)
            state = .loaded
        } catch {
            #if DEBUG
            data = MockData.investorData
            state = .loaded
            #else
            state = .failed(error.localizedDescription)
            #endif
        }
    }
}
