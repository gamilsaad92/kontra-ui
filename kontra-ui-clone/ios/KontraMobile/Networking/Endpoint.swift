import Foundation

enum Endpoint {
    case overview
    case applications(limit: Int)
    case tasks(limit: Int)

    func request(configuration: AppConfiguration) -> URLRequest {
        var url = configuration.baseURL
        url.appendPathComponent("api")
        switch self {
        case .overview:
            url.appendPathComponent("mobile/overview")
        case let .applications(limit):
            url.appendPathComponent("applications")
            var components = URLComponents(url: url, resolvingAgainstBaseURL: false)
            components?.queryItems = [URLQueryItem(name: "limit", value: String(limit))]
            url = components?.url ?? url
        case let .tasks(limit):
            url.appendPathComponent("tasks")
            var components = URLComponents(url: url, resolvingAgainstBaseURL: false)
            components?.queryItems = [URLQueryItem(name: "limit", value: String(limit))]
            url = components?.url ?? url
        }

        var request = URLRequest(url: url)
        request.timeoutInterval = 20
        request.setValue(configuration.organizationID, forHTTPHeaderField: "X-Org-Id")
        request.setValue("ios", forHTTPHeaderField: "X-Client-Platform")
        request.setValue("mobile-app", forHTTPHeaderField: "X-Client-Id")
        request.setValue("mobile-operator", forHTTPHeaderField: "X-User-Id")
        return request
    }
}
