import Foundation

protocol MobileAPIClient {
    func fetchOverview() async throws -> MobileOverview
    func fetchApplications(limit: Int) async throws -> [LoanApplication]
    func fetchTasks(limit: Int) async throws -> [TaskItem]
}

enum APIError: Error, LocalizedError {
    case invalidURL
    case decoding(Error)
    case transport(Error)
    case server(statusCode: Int)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "The Kontra API URL is invalid."
        case let .decoding(error):
            return "Failed to decode the server response: \(error.localizedDescription)"
        case let .transport(error):
            return error.localizedDescription
        case let .server(statusCode):
            return "The server responded with status code \(statusCode)."
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

    func fetchOverview() async throws -> MobileOverview {
        try await send(.overview, as: MobileOverview.self)
    }

    func fetchApplications(limit: Int = 20) async throws -> [LoanApplication] {
        try await send(.applications(limit: limit), as: ApplicationResponse.self).applications
    }

    func fetchTasks(limit: Int = 25) async throws -> [TaskItem] {
        try await send(.tasks(limit: limit), as: TaskResponse.self).tasks
    }

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
            if let apiError = error as? APIError { return try handleRetry(for: apiError, endpoint: endpoint, type: type) }
            throw APIError.transport(error)
        }
    }

    private func handleRetry<Response: Decodable>(for error: APIError, endpoint: Endpoint, type: Response.Type) throws -> Response {
        switch error {
        case .server(statusCode: 401):
            throw error
        default:
            throw error
        }
    }
}

private struct ApplicationResponse: Decodable {
    let applications: [LoanApplication]
}

private struct TaskResponse: Decodable {
    let tasks: [TaskItem]
}

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
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withDashSeparatorInDate, .withColonSeparatorInTime]
        return formatter
    }()

    static let milliseconds: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withDashSeparatorInDate, .withColonSeparatorInTime, .withFractionalSeconds]
        return formatter
    }()
}
