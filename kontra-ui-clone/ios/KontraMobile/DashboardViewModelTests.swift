import XCTest
@testable import KontraMobile

final class DashboardViewModelTests: XCTestCase {
    func testLoadsOverview() async throws {
        let overview = MobileOverview(
            summary: .init(
                totalApplications: 10,
                approvedApplications: 5,
                totalTasks: 8,
                pendingTasks: 3,
                averageCreditScore: 705,
                portfolioValue: 1_200_000,
                lastUpdated: Date()
            ),
            applications: [
                LoanApplication(
                    id: 1,
                    name: "Borrower One",
                    amount: 250_000,
                    status: "under_review",
                    decision: "review",
                    submittedAt: Date()
                )
            ],
            tasks: [
                TaskItem(
                    id: 1,
                    title: "Collect bank statements",
                    priority: "urgent",
                    status: "pending",
                    dueDate: Date(),
                    owner: "Alex"
                )
            ],
            alerts: [],
            activity: [],
            suggestion: "Review pending underwriting tasks."
        )
        let api = MockAPIClient(overview: overview)
        let viewModel = await DashboardViewModel(api: api)

        await viewModel.load()

        XCTAssertEqual(viewModel.state, .loaded)
        XCTAssertEqual(viewModel.overview?.summary.totalApplications, overview.summary.totalApplications)
    }
}

private actor MockAPIClient: MobileAPIClient {
    let overview: MobileOverview

    init(overview: MobileOverview) {
        self.overview = overview
    }

    func fetchOverview() async throws -> MobileOverview { overview }

    func fetchApplications(limit: Int) async throws -> [LoanApplication] { overview.applications }

    func fetchTasks(limit: Int) async throws -> [TaskItem] { overview.tasks }
}
