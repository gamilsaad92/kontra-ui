import SwiftUI

struct InvestorView: View {
    @StateObject var viewModel: InvestorViewModel
    @State private var selectedSection = 0

    private let sections = ["Portfolio", "Distributions", "Performance", "Alerts"]

    init(viewModel: @autoclosure @escaping () -> InvestorViewModel) {
        _viewModel = StateObject(wrappedValue: viewModel())
    }

    var body: some View {
        NavigationStack {
            Group {
                if let data = viewModel.data {
                    content(data: data)
                } else {
                    LoadingStateView(state: viewModel.state) {
                        Task { await viewModel.load() }
                    }
                    .padding()
                }
            }
            .navigationTitle("Investor Portal")
            .navigationBarTitleDisplayMode(.large)
        }
        .onAppear { Task { await viewModel.load() } }
        .refreshable { await viewModel.load() }
    }

    @ViewBuilder
    private func content(data: InvestorData) -> some View {
        ScrollView {
            VStack(spacing: 0) {
                portfolioSummaryHeader(data: data)

                Picker("Section", selection: $selectedSection) {
                    ForEach(Array(sections.enumerated()), id: \.offset) { index, title in
                        Text(title).tag(index)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)
                .padding(.vertical, 12)

                Group {
                    switch selectedSection {
                    case 0: portfolioSection(holdings: data.holdings)
                    case 1: distributionsSection(distributions: data.distributions)
                    case 2: performanceSection(performance: data.performance)
                    case 3: alertsSection(alerts: data.alerts)
                    default: EmptyView()
                    }
                }
                .padding(.horizontal)
                .padding(.bottom, 32)
            }
        }
        .background(Color(.systemGroupedBackground))
    }

    // ── Summary Header ────────────────────────────────────────────────────
    @ViewBuilder
    private func portfolioSummaryHeader(data: InvestorData) -> some View {
        let totalInvested = data.holdings.reduce(0) { $0 + $1.my_share_usd }
        let totalTokens   = data.holdings.reduce(0) { $0 + $1.token_balance }
        let paidDists     = data.distributions.filter { $0.status == "paid" }
        let totalReceived = paidDists.reduce(0) { $0 + $1.net_amount }
        let highAlerts    = data.alerts.filter { $0.severity == "high" }.count

        VStack(spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Your Investment Summary")
                        .font(.headline)
                    Text("\(data.holdings.count) active positions")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if highAlerts > 0 {
                    Label("\(highAlerts) high-risk", systemImage: "exclamationmark.triangle.fill")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.kontraBrand)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(Color.kontraBrand.opacity(0.1))
                        .clipShape(Capsule())
                }
            }

            HStack(spacing: 0) {
                summaryKPI(label: "Capital Deployed", value: formatCurrency(totalInvested), color: .primary)
                Divider().frame(height: 40)
                summaryKPI(label: "Total Received", value: formatCurrency(totalReceived), color: .green)
                Divider().frame(height: 40)
                summaryKPI(label: "Token Holdings", value: "\(Int(totalTokens).formatted())", color: .purple)
            }
            .padding(.vertical, 8)
            .background(Color(.tertiarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
        }
        .padding()
        .background(Color(.secondarySystemGroupedBackground))
    }

    @ViewBuilder
    private func summaryKPI(label: String, value: String, color: Color) -> some View {
        VStack(spacing: 3) {
            Text(value)
                .font(.callout.weight(.bold))
                .foregroundStyle(color)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }

    // ── Portfolio ─────────────────────────────────────────────────────────
    @ViewBuilder
    private func portfolioSection(holdings: [InvestorHolding]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Loan Participations")
            ForEach(holdings) { h in
                holdingCard(h)
            }
        }
    }

    @ViewBuilder
    private func holdingCard(_ h: InvestorHolding) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(h.loan_ref)
                        .font(.caption.weight(.black))
                        .foregroundStyle(.purple)
                    Text(h.property_name)
                        .font(.subheadline.weight(.bold))
                    if let location = h.location {
                        Text(location)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()
                holdingStatusBadge(h.status)
            }

            Divider()

            HStack(spacing: 0) {
                miniStat(label: "My Share", value: formatCurrency(h.my_share_usd))
                Divider().frame(height: 30)
                miniStat(label: "UPB", value: formatCurrency(h.upb))
                Divider().frame(height: 30)
                miniStat(label: "Yield", value: "\(h.yield_pct)%", accent: .green)
                Divider().frame(height: 30)
                miniStat(label: "Tokens", value: "\(Int(h.token_balance))", accent: .purple)
            }
        }
        .padding(14)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))
    }

    @ViewBuilder
    private func holdingStatusBadge(_ status: String) -> some View {
        let isGood = status == "Current"
        Text(status)
            .font(.caption.weight(.bold))
            .foregroundStyle(isGood ? .green : .kontraBrand)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background((isGood ? Color.green : Color.kontraBrand).opacity(0.12))
            .clipShape(Capsule())
    }

    @ViewBuilder
    private func miniStat(label: String, value: String, accent: Color? = nil) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.caption.weight(.bold))
                .foregroundStyle(accent ?? .primary)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }

    // ── Distributions ─────────────────────────────────────────────────────
    @ViewBuilder
    private func distributionsSection(distributions: [InvestorDistribution]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            let paid      = distributions.filter { $0.status == "paid" }
            let scheduled = distributions.filter { $0.status == "scheduled" }
            let totalNet  = paid.reduce(0) { $0 + $1.net_amount }
            let nextNet   = scheduled.reduce(0) { $0 + $1.net_amount }

            HStack(spacing: 12) {
                distributionKPI(label: "Total Received (YTD)", value: formatCurrency(totalNet), color: .green)
                distributionKPI(label: "Next Scheduled", value: formatCurrency(nextNet), color: .purple)
            }

            if !scheduled.isEmpty {
                sectionHeader("Upcoming")
                ForEach(scheduled) { d in distributionRow(d, upcoming: true) }
            }

            sectionHeader("History")
            if paid.isEmpty {
                emptyState("No distribution history")
            } else {
                ForEach(paid) { d in distributionRow(d, upcoming: false) }
            }
        }
    }

    @ViewBuilder
    private func distributionKPI(label: String, value: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption.weight(.bold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
            Text(value)
                .font(.title3.weight(.black))
                .foregroundStyle(color)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(color.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
    }

    @ViewBuilder
    private func distributionRow(_ d: InvestorDistribution, upcoming: Bool) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 3) {
                Text("\(d.period ?? "—") — \(d.loan_ref ?? "ALL")")
                    .font(.subheadline.weight(.semibold))
                Text("\(d.type) · \(formatDateString(d.paid_at))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 3) {
                Text(formatCurrency(d.net_amount))
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(upcoming ? .purple : .green)
                Text("net of fees")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(14)
        .background(
            upcoming
                ? Color.purple.opacity(0.06)
                : Color(.secondarySystemGroupedBackground),
            in: RoundedRectangle(cornerRadius: 12)
        )
    }

    // ── Performance ───────────────────────────────────────────────────────
    @ViewBuilder
    private func performanceSection(performance: [InvestorPerformance]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Loan Performance Metrics")
            if performance.isEmpty {
                emptyState("No performance data available")
            } else {
                ForEach(performance) { p in performanceRow(p) }
            }
        }
    }

    @ViewBuilder
    private func performanceRow(_ p: InvestorPerformance) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(p.loan_ref)
                        .font(.caption.weight(.black))
                        .foregroundStyle(.purple)
                    Text(p.property ?? "—")
                        .font(.subheadline.weight(.semibold))
                }
                Spacer()
                riskBadge(p.risk_label)
            }

            HStack(spacing: 0) {
                miniStat(label: "DSCR",        value: String(format: "%.2fx", p.dscr), accent: p.dscr >= 1.25 ? .green : .kontraBrand)
                Divider().frame(height: 30)
                miniStat(label: "LTV",         value: String(format: "%.1f%%", p.ltv), accent: p.ltv <= 75 ? .green : .kontraBrand)
                Divider().frame(height: 30)
                miniStat(label: "Delinquency", value: "\(p.delinquency_days)d", accent: p.delinquency_days == 0 ? .green : .kontraBrand)
                Divider().frame(height: 30)
                miniStat(label: "Status",      value: p.payment_status)
            }
        }
        .padding(14)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))
    }

    @ViewBuilder
    private func riskBadge(_ label: String) -> some View {
        let color: Color = label == "Low" ? .green : label == "High" ? .kontraBrand : .orange
        Text(label + " Risk")
            .font(.caption.weight(.bold))
            .foregroundStyle(color)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(color.opacity(0.12))
            .clipShape(Capsule())
    }

    // ── Alerts ────────────────────────────────────────────────────────────
    @ViewBuilder
    private func alertsSection(alerts: [InvestorAlert]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Risk Alerts")
            if alerts.isEmpty {
                emptyState("No active risk alerts")
            } else {
                ForEach(alerts) { alert in alertRow(alert) }
            }
        }
    }

    @ViewBuilder
    private func alertRow(_ a: InvestorAlert) -> some View {
        let color = severityColor(a.severity)
        HStack(alignment: .top, spacing: 12) {
            Circle()
                .fill(color.opacity(0.15))
                .frame(width: 36, height: 36)
                .overlay(
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(color)
                )
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    if let ref = a.loan_ref {
                        Text(ref)
                            .font(.caption.weight(.black))
                            .foregroundStyle(.purple)
                    }
                    Text(a.severity.capitalized)
                        .font(.caption.weight(.bold))
                        .foregroundStyle(color)
                        .padding(.horizontal, 8).padding(.vertical, 2)
                        .background(color.opacity(0.12))
                        .clipShape(Capsule())
                }
                Text(a.message)
                    .font(.subheadline)
                if let ts = a.created_at {
                    Text(formatDateString(ts))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(color.opacity(0.05), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(color.opacity(0.25), lineWidth: 1))
    }

    // ── Helpers ───────────────────────────────────────────────────────────
    @ViewBuilder private func sectionHeader(_ text: String) -> some View {
        Text(text).font(.title3.weight(.bold)).padding(.top, 4)
    }

    @ViewBuilder private func emptyState(_ text: String) -> some View {
        Text(text)
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 32)
    }

    private func severityColor(_ s: String) -> Color {
        switch s.lowercased() {
        case "high":   return .kontraBrand
        case "medium": return .orange
        default:       return .gray
        }
    }

    private func formatCurrency(_ value: Double) -> String {
        value.formatted(.currency(code: "USD").precision(.fractionLength(0...0)))
    }

    private func formatDateString(_ s: String?) -> String {
        guard let s, !s.isEmpty else { return "—" }
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM-dd"
        if let d = fmt.date(from: String(s.prefix(10))) {
            let out = DateFormatter()
            out.dateStyle = .medium
            return out.string(from: d)
        }
        return s
    }
}

#if DEBUG
struct InvestorView_Previews: PreviewProvider {
    static var previews: some View {
        InvestorView(viewModel: InvestorViewModel()).environmentObject(AppConfiguration.shared)
    }
}
#endif
