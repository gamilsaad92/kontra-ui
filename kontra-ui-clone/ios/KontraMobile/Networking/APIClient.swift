import Foundation

protocol MobileAPIClient {
    func fetchOverview() async throws -> MobileOverview
    func fetchApplications(limit: Int) async throws -> [LoanApplication]
    func fetchTasks(limit: Int) async throws -> [TaskItem]
    // Borrower
    func fetchBorrowerLoan() async throws -> BorrowerLoan?
    func fetchBorrowerPayments() async throws -> [BorrowerPayment]
    func fetchBorrowerDocuments() async throws -> [BorrowerDocument]
    func fetchBorrowerDraws() async throws -> [BorrowerDraw]
    func fetchBorrowerNotices() async throws -> [BorrowerNotice]
    // Investor
    func fetchInvestorHoldings() async throws -> [InvestorHolding]
    func fetchInvestorDistributions() async throws -> [InvestorDistribution]
    func fetchInvestorPerformance() async throws -> [InvestorPerformance]
    func fetchInvestorAlerts() async throws -> [InvestorAlert]
}

enum APIError: Error, LocalizedError {
    case invalidURL
    case decoding(Error)
    case transport(Error)
    case server(statusCode: Int)

    var errorDescription: String? {
        switch self {
        case .invalidURL:               return "The Kontra API URL is invalid."
        case let .decoding(error):      return "Failed to decode the server response: \(error.localizedDescription)"
        case let .transport(error):     return error.localizedDescription
        case let .server(statusCode):   return "The server responded with status code \(statusCode)."
        }
    }
}

struct APIClient: MobileAPIClient {
    private let configuration: AppConfiguration
    private let session: URLSession
    private let decoder: JSONDecoder

    init(configuration: AppConfiguration = .shared, session: URLSession = .shared) {
        self.configuration = configuration
        self.session = session
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601WithMilliseconds
        self.decoder = decoder
    }

    // ── Existing ────────────────────────────────────────────────────────────
    func fetchOverview() async throws -> MobileOverview {
        try await send(.overview, as: MobileOverview.self)
    }

    func fetchApplications(limit: Int = 20) async throws -> [LoanApplication] {
        try await send(.applications(limit: limit), as: ApplicationResponse.self).applications
    }

    func fetchTasks(limit: Int = 25) async throws -> [TaskItem] {
        try await send(.tasks(limit: limit), as: TaskResponse.self).tasks
    }

    // ── Borrower ────────────────────────────────────────────────────────────
    func fetchBorrowerLoan() async throws -> BorrowerLoan? {
        try await send(.borrowerLoan, as: BorrowerLoanResponse.self).loan
    }

    func fetchBorrowerPayments() async throws -> [BorrowerPayment] {
        try await send(.borrowerPayments, as: BorrowerPaymentsResponse.self).payments
    }

    func fetchBorrowerDocuments() async throws -> [BorrowerDocument] {
        try await send(.borrowerDocuments, as: BorrowerDocumentsResponse.self).documents
    }

    func fetchBorrowerDraws() async throws -> [BorrowerDraw] {
        try await send(.borrowerDraws, as: BorrowerDrawsResponse.self).draws
    }

    func fetchBorrowerNotices() async throws -> [BorrowerNotice] {
        try await send(.borrowerNotices, as: BorrowerNoticesResponse.self).notices
    }

    // ── Investor ────────────────────────────────────────────────────────────
    func fetchInvestorHoldings() async throws -> [InvestorHolding] {
        try await send(.investorHoldings, as: InvestorHoldingsResponse.self).holdings
    }

    func fetchInvestorDistributions() async throws -> [InvestorDistribution] {
        try await send(.investorDistributions, as: InvestorDistributionsResponse.self).distributions
    }

    func fetchInvestorPerformance() async throws -> [InvestorPerformance] {
        try await send(.investorPerformance, as: InvestorPerformanceResponse.self).performance
    }

    func fetchInvestorAlerts() async throws -> [InvestorAlert] {
        try await send(.investorAlerts, as: InvestorAlertsResponse.self).alerts
    }

    // ── Core ─────────────────────────────────────────────────────────────────
    private func send<Response: Decodable>(_ endpoint: Endpoint, as type: Response.Type) async throws -> Response {
        let request = endpoint.request(configuration: configuration)
        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse else {
                throw APIError.server(statusCode: -1)
            }
            guard 200..<300 ~= http.statusCode else {
                throw APIError.server(statusCode: http.statusCode)
            }
            do {
                return try decoder.decode(type, from: data)
            } catch {
                throw APIError.decoding(error)
            }
        } catch {
            if let apiError = error as? APIError {
                throw apiError
            }
            throw APIError.transport(error)
        }
    }
}

private struct ApplicationResponse: Decodable { let applications: [LoanApplication] }
private struct TaskResponse: Decodable { let tasks: [TaskItem] }

private extension JSONDecoder.DateDecodingStrategy {
    static var iso8601WithMilliseconds: JSONDecoder.DateDecodingStrategy {
        .custom { decoder in
            let container = try decoder.singleValueContainer()
            let value = try container.decode(String.self)
            if let date = ISO8601DateFormatter.milliseconds.date(from: value) ?? ISO8601DateFormatter.standard.date(from: value) {
                return date
            }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Invalid ISO8601 date: \(value)")
        }
    }
}

private extension ISO8601DateFormatter {
    static let standard: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withDashSeparatorInDate, .withColonSeparatorInTime]
        return f
    }()
    static let milliseconds: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withDashSeparatorInDate, .withColonSeparatorInTime, .withFractionalSeconds]
        return f
    }()
}
