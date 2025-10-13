import Foundation

struct MobileOverview: Codable, Sendable {
    struct Summary: Codable, Sendable {
        let totalApplications: Int
        let approvedApplications: Int
        let totalTasks: Int
        let pendingTasks: Int
        let averageCreditScore: Double
        let portfolioValue: Double
        let lastUpdated: Date
    }

    struct Activity: Codable, Identifiable, Sendable {
        enum ActivityType: String, Codable, Sendable {
            case application
            case task
            case alert
        }

        let id: String
        let type: ActivityType
        let title: String
        let detail: String
        let timestamp: Date
    }

    let summary: Summary
    let applications: [LoanApplication]
    let tasks: [TaskItem]
    let alerts: [RiskAlert]
    let activity: [Activity]
    let suggestion: String
}

struct LoanApplication: Codable, Identifiable, Sendable {
    let id: Int
    let name: String
    let amount: Double
    let status: String
    let decision: String
    let submittedAt: Date

    enum CodingKeys: String, CodingKey {
        case id, name, amount, status, decision
        case submittedAt = "submitted_at"
    }
}

struct TaskItem: Codable, Identifiable, Sendable {
    let id: Int
    let title: String
    let priority: String
    let status: String
    let dueDate: Date?
    let owner: String?

    enum CodingKeys: String, CodingKey {
        case id, title, priority, status, owner
        case dueDate = "due_date"
    }
}

struct RiskAlert: Codable, Identifiable, Sendable {
    let id: Int
    let loanID: Int?
    let severity: String
    let message: String
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case loanID = "loan_id"
        case severity, message
        case createdAt = "created_at"
    }
}
