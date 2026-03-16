import Foundation

#if DEBUG
struct MockData {
    static let overview: MobileOverview = {
        let summary = MobileOverview.Summary(
            totalApplications: 128,
            approvedApplications: 54,
            totalTasks: 42,
            pendingTasks: 9,
            averageCreditScore: 712,
            portfolioValue: 42_500_000,
            lastUpdated: Date()
        )

        let applications = (1...5).map { index in
            LoanApplication(
                id: index,
                name: "Borrower \(index)",
                amount: Double.random(in: 250_000...1_000_000),
                status: index % 2 == 0 ? "approved" : "under_review",
                decision: index % 2 == 0 ? "approve" : "review",
                submittedAt: Calendar.current.date(byAdding: .day, value: -index, to: Date()) ?? Date()
            )
        }

        let tasks = (1...5).map { index in
            TaskItem(
                id: index,
                title: "Review financial package #\(index)",
                priority: index == 1 ? "urgent" : "normal",
                status: index == 3 ? "completed" : "pending",
                dueDate: Calendar.current.date(byAdding: .day, value: index, to: Date()),
                owner: index % 2 == 0 ? "Alex" : "Jordan"
            )
        }

        let alerts = (1...3).map { index in
            RiskAlert(
                id: index,
                loanID: 400 + index,
                severity: index == 1 ? "high" : "medium",
                message: "Payment delinquent for asset #\(400 + index)",
                createdAt: Calendar.current.date(byAdding: .hour, value: -index * 6, to: Date()) ?? Date()
            )
        }

        let activity = applications.enumerated().map { offset, app in
            MobileOverview.Activity(
                id: "app-\(app.id)",
                type: .application,
                title: "\(app.name) submitted",
                detail: "Status: \(app.status.capitalized)",
                timestamp: app.submittedAt.addingTimeInterval(Double(offset) * 600)
            )
        }

        return MobileOverview(
            summary: summary,
            applications: applications,
            tasks: tasks,
            alerts: alerts,
            activity: activity,
            suggestion: "Review the pending underwriting tasks for highest risk loans."
        )
    }()
}
#endif
