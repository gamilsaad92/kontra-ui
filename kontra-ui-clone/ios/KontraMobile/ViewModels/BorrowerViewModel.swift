import Foundation

@MainActor
final class BorrowerViewModel: ObservableObject {
    @Published private(set) var data: BorrowerData?
    @Published private(set) var state: LoadState = .idle

    private var api: MobileAPIClient

    init(api: MobileAPIClient = APIClient()) {
        self.api = api
    }

    func load() async {
        state = .loading
        do {
            async let loan    = api.fetchBorrowerLoan()
            async let pays    = api.fetchBorrowerPayments()
            async let docs    = api.fetchBorrowerDocuments()
            async let draws   = api.fetchBorrowerDraws()
            async let notices = api.fetchBorrowerNotices()

            let (l, p, d, dr, n) = try await (loan, pays, docs, draws, notices)
            data = BorrowerData(loan: l, payments: p, documents: d, draws: dr, notices: n)
            state = .loaded
        } catch {
            #if DEBUG
            data = MockData.borrowerData
            state = .loaded
            #else
            state = .failed(error.localizedDescription)
            #endif
        }
    }
}
