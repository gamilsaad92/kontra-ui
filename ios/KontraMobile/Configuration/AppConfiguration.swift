import Foundation
import Combine

@MainActor
final class AppConfiguration: ObservableObject {
    static let shared = AppConfiguration()

    @Published private(set) var baseURL: URL
    @Published private(set) var organizationID: String

    private let baseURLKey = "KontraMobile.baseURL"
    private let organizationKey = "KontraMobile.organizationID"

    private init() {
        let defaults = UserDefaults.standard
        if let stored = defaults.string(forKey: baseURLKey), let url = URL(string: stored) {
            baseURL = url
        } else if let plistValue = Bundle.main.object(forInfoDictionaryKey: "APIBaseURL") as? String, let url = URL(string: plistValue) {
            baseURL = url
        } else {
            baseURL = URL(string: "http://localhost:5050")!
        }

        if let storedOrg = defaults.string(forKey: organizationKey) {
            organizationID = storedOrg
        } else if let plistOrg = Bundle.main.object(forInfoDictionaryKey: "DefaultOrganizationID") as? String {
            organizationID = plistOrg
        } else {
            organizationID = "demo-org"
        }
    }

    func update(baseURL: URL) {
        self.baseURL = baseURL
        UserDefaults.standard.set(baseURL.absoluteString, forKey: baseURLKey)
    }

    func update(organizationID: String) {
        self.organizationID = organizationID
        UserDefaults.standard.set(organizationID, forKey: organizationKey)
    }
}
