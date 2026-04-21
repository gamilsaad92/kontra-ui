import Foundation

enum Endpoint {
    case overview
    case applications(limit: Int)
    case tasks(limit: Int)
    // Borrower portal
    case borrowerLoan
    case borrowerPayments
    case borrowerDocuments
    case borrowerDraws
    case borrowerNotices
    // Investor portal
    case investorHoldings
    case investorDistributions
    case investorPerformance
    case investorAlerts

    func request(configuration: AppConfiguration) -> URLRequest {
        var url = configuration.baseURL
        url.appendPathComponent("api")
        switch self {
        case .overview:
            url.appendPathComponent("mobile/overview")
        case let .applications(limit):
            url.appendPathComponent("applications")
            url = appendQuery(url, items: [("limit", String(limit))])
        case let .tasks(limit):
            url.appendPathComponent("tasks")
            url = appendQuery(url, items: [("limit", String(limit))])

        case .borrowerLoan:        url.appendPathComponent("borrower/loan")
        case .borrowerPayments:    url.appendPathComponent("borrower/payments")
        case .borrowerDocuments:   url.appendPathComponent("borrower/documents")
        case .borrowerDraws:       url.appendPathComponent("borrower/draws")
        case .borrowerNotices:     url.appendPathComponent("borrower/notices")

        case .investorHoldings:    url.appendPathComponent("investors/holdings")
        case .investorDistributions: url.appendPathComponent("investors/distributions")
        case .investorPerformance: url.appendPathComponent("investors/performance")
        case .investorAlerts:      url.appendPathComponent("investors/alerts")
        }

        var request = URLRequest(url: url)
        request.timeoutInterval = 20
        request.setValue(configuration.organizationID, forHTTPHeaderField: "X-Org-Id")
        request.setValue("ios",           forHTTPHeaderField: "X-Client-Platform")
        request.setValue("mobile-app",    forHTTPHeaderField: "X-Client-Id")
        request.setValue("mobile-operator", forHTTPHeaderField: "X-User-Id")
        return request
    }

    private func appendQuery(_ url: URL, items: [(String, String)]) -> URL {
        var components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        components?.queryItems = items.map { URLQueryItem(name: $0.0, value: $0.1) }
        return components?.url ?? url
    }
}
