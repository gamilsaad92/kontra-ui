import SwiftUI

struct DashboardView: View {
    @StateObject var viewModel: DashboardViewModel
    @EnvironmentObject private var configuration: AppConfiguration

    private let gridColumns = [
        GridItem(.flexible(minimum: 120), spacing: 16),
        GridItem(.flexible(minimum: 120), spacing: 16)
    ]

    init(viewModel: @autoclosure @escaping () -> DashboardViewModel) {
        _viewModel = StateObject(wrappedValue: viewModel())
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                header
                metrics
                suggestionCard
                activityFeed
                alerts
            }
            .padding()
        }
        .background(Color(.systemGroupedBackground))
        .onAppear { Task { await viewModel.load() } }
        .onReceive(configuration.$baseURL) { _ in Task { await viewModel.load() } }
        .refreshable { await viewModel.load() }
    }

    @ViewBuilder
    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Portfolio Snapshot")
                .font(.largeTitle.weight(.bold))
            Text("Key underwriting and servicing metrics refreshed continuously")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }

    @ViewBuilder
    private var metrics: some View {
        if let summary = viewModel.overview?.summary {
            LazyVGrid(columns: gridColumns, spacing: 16) {
                MetricCard(
                    title: "Applications",
                    value: summary.totalApplications.formatted(),
                    subtitle: "Approved: \(summary.approvedApplications)",
                    systemImage: "doc.richtext"
                )
                MetricCard(
                    title: "Pending Tasks",
                    value: summary.pendingTasks.formatted(),
                    subtitle: "Total: \(summary.totalTasks) • Avg credit score: \(Int(summary.averageCreditScore))",
                    systemImage: "checklist.checked",
                    color: .indigo
                )
                MetricCard(
                    title: "Portfolio",
                    value: summary.portfolioValue.formatted(.currency(code: "USD")),
                    subtitle: "Updated \(summary.lastUpdated.formatted(date: .abbreviated, time: .shortened))",
                    systemImage: "chart.line.uptrend.xyaxis",
                    color: .green
                )
            }
        } else {
            LoadingStateView(state: viewModel.state) {
                Task { await viewModel.load() }
            }
        }
    }

    @ViewBuilder
    private var suggestionCard: some View {
        if let suggestion = viewModel.overview?.suggestion {
            VStack(alignment: .leading, spacing: 12) {
                Label("Next best action", systemImage: "lightbulb.fill")
                    .font(.headline)
                Text(suggestion)
                    .font(.body)
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.thickMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
    }

    @ViewBuilder
    private var activityFeed: some View {
        if let activities = viewModel.overview?.activity, !activities.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                Text("Recent activity")
                    .font(.title2.bold())
                ForEach(activities) { item in
                    HStack(alignment: .top, spacing: 12) {
                        Circle()
                            .fill(color(for: item.type).opacity(0.2))
                            .frame(width: 36, height: 36)
                            .overlay(
                                Image(systemName: icon(for: item.type))
                                    .font(.footnote.weight(.semibold))
                                    .foregroundStyle(color(for: item.type))
                            )
                        VStack(alignment: .leading, spacing: 4) {
                            Text(item.title)
                                .font(.headline)
                            Text(item.detail)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                            Text(item.timestamp.formatted(date: .abbreviated, time: .shortened))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                    }
                    .padding(12)
                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
            }
        }
    }

    @ViewBuilder
    private var alerts: some View {
        if let alerts = viewModel.overview?.alerts, !alerts.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                Text("Risk alerts")
                    .font(.title2.bold())
                ForEach(alerts) { alert in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Label("Loan #\(alert.loanID ?? 0)", systemImage: "exclamationmark.octagon.fill")
                                .font(.headline)
                                .foregroundStyle(color(forSeverity: alert.severity))
                            Spacer()
                            Text(alert.createdAt.formatted(date: .numeric, time: .shortened))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Text(alert.message)
                            .font(.subheadline)
                        Text(alert.severity.capitalized)
                            .font(.caption.weight(.semibold))
                            .padding(.vertical, 4)
                            .padding(.horizontal, 8)
                            .background(color(forSeverity: alert.severity).opacity(0.15))
                            .clipShape(Capsule())
                    }
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
            }
        }
    }

    private func color(for type: MobileOverview.Activity.ActivityType) -> Color {
        switch type {
        case .application:
            return .blue
        case .task:
            return .purple
        case .alert:
            return .red
        }
    }

    private func icon(for type: MobileOverview.Activity.ActivityType) -> String {
        switch type {
        case .application:
            return "doc.text.fill"
        case .task:
            return "checkmark.circle.fill"
        case .alert:
            return "bell.badge.fill"
        }
    }

    private func color(forSeverity severity: String) -> Color {
        switch severity.lowercased() {
        case "critical":
            return .red
        case "high":
            return .orange
        case "medium":
            return .yellow
        default:
            return .gray
        }
    }
}

#if DEBUG
struct DashboardView_Previews: PreviewProvider {
    static var previews: some View {
        DashboardView(viewModel: DashboardViewModel()).environmentObject(AppConfiguration.shared)
    }
}
#endif
