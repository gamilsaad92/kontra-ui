import SwiftUI

struct BorrowerView: View {
    @StateObject var viewModel: BorrowerViewModel
    @State private var selectedSection = 0

    private let sections = ["My Loan", "Payments", "Documents", "Draws", "Notices"]

    init(viewModel: @autoclosure @escaping () -> BorrowerViewModel) {
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
            .navigationTitle("Borrower Portal")
            .navigationBarTitleDisplayMode(.large)
        }
        .onAppear { Task { await viewModel.load() } }
        .refreshable { await viewModel.load() }
    }

    @ViewBuilder
    private func content(data: BorrowerData) -> some View {
        ScrollView {
            VStack(spacing: 0) {
                if let loan = data.loan {
                    loanHeader(loan)
                }

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
                    case 0: loanDetailSection(data: data)
                    case 1: paymentsSection(payments: data.payments)
                    case 2: documentsSection(documents: data.documents)
                    case 3: drawsSection(draws: data.draws)
                    case 4: noticesSection(notices: data.notices)
                    default: EmptyView()
                    }
                }
                .padding(.horizontal)
                .padding(.bottom, 32)
            }
        }
        .background(Color(.systemGroupedBackground))
    }

    // ── Loan Header ───────────────────────────────────────────────────────
    @ViewBuilder
    private func loanHeader(_ loan: BorrowerLoan) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(loan.loan_ref)
                        .font(.caption.weight(.black))
                        .foregroundStyle(.kontraBrand)
                    Text(loan.property_name)
                        .font(.title3.weight(.bold))
                    if let address = loan.property_address {
                        Text(address)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()
                loanStatusBadge(loan.status ?? "Unknown")
            }

            Divider()

            HStack(spacing: 16) {
                statChip(
                    label: "Balance",
                    value: formatCurrency(loan.current_balance ?? 0)
                )
                statChip(
                    label: "Rate",
                    value: loan.interest_rate ?? "—"
                )
                if let nextAmt = loan.next_payment_amount {
                    statChip(
                        label: "Next Payment",
                        value: formatCurrency(nextAmt),
                        accent: true
                    )
                }
            }
        }
        .padding()
        .background(Color(.secondarySystemGroupedBackground))
    }

    @ViewBuilder
    private func loanStatusBadge(_ status: String) -> some View {
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
    private func statChip(label: String, value: String, accent: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.caption2.weight(.bold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
            Text(value)
                .font(.callout.weight(.bold))
                .foregroundStyle(accent ? .kontraBrand : .primary)
        }
    }

    // ── Loan Detail ───────────────────────────────────────────────────────
    @ViewBuilder
    private func loanDetailSection(data: BorrowerData) -> some View {
        if let loan = data.loan {
            VStack(alignment: .leading, spacing: 16) {
                sectionHeader("Loan Details")

                infoGrid([
                    ("Payment Type", loan.payment_type ?? "—"),
                    ("Maturity",     formatDateString(loan.maturity_date)),
                    ("Servicer",     loan.servicer_name ?? "—"),
                    ("Contact",      loan.servicer_contact ?? "—"),
                ])

                let pending = data.documents.filter { $0.status == "pending" }.count
                if pending > 0 {
                    alertBanner("\(pending) document\(pending == 1 ? "" : "s") require your attention.")
                }
            }
        }
    }

    // ── Payments ──────────────────────────────────────────────────────────
    @ViewBuilder
    private func paymentsSection(payments: [BorrowerPayment]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Payment History")
            if payments.isEmpty {
                emptyState("No payment records found")
            } else {
                ForEach(payments) { payment in
                    paymentRow(payment)
                }
            }
        }
    }

    @ViewBuilder
    private func paymentRow(_ p: BorrowerPayment) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 3) {
                Text(formatDateString(p.date))
                    .font(.subheadline.weight(.semibold))
                Text("Interest: \(formatCurrency(p.interest))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 3) {
                Text(formatCurrency(p.amount))
                    .font(.subheadline.weight(.bold))
                paidBadge(p.status)
            }
        }
        .padding(14)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
    }

    // ── Documents ─────────────────────────────────────────────────────────
    @ViewBuilder
    private func documentsSection(documents: [BorrowerDocument]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            let approved = documents.filter { $0.status == "approved" }.count
            HStack {
                sectionHeader("Required Documents")
                Spacer()
                Text("\(approved)/\(documents.count) complete")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if documents.isEmpty {
                emptyState("No documents on file")
            } else {
                ForEach(documents) { doc in
                    documentRow(doc)
                }
            }
        }
    }

    @ViewBuilder
    private func documentRow(_ doc: BorrowerDocument) -> some View {
        HStack(spacing: 12) {
            Circle()
                .fill(docStatusColor(doc.status).opacity(0.15))
                .frame(width: 36, height: 36)
                .overlay(
                    Image(systemName: docStatusIcon(doc.status))
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(docStatusColor(doc.status))
                )
            VStack(alignment: .leading, spacing: 3) {
                Text(doc.name)
                    .font(.subheadline.weight(.semibold))
                HStack(spacing: 6) {
                    if let due = doc.due {
                        Text("Due: \(formatDateString(due))")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    if let notes = doc.notes, !notes.isEmpty {
                        Text("· \(notes)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            Spacer()
            docStatusBadge(doc.status)
        }
        .padding(14)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
    }

    // ── Draws ─────────────────────────────────────────────────────────────
    @ViewBuilder
    private func drawsSection(draws: [BorrowerDraw]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Draw Requests")
            if draws.isEmpty {
                emptyState("No draw requests on file")
            } else {
                ForEach(draws) { draw in
                    drawRow(draw)
                }
            }
        }
    }

    @ViewBuilder
    private func drawRow(_ d: BorrowerDraw) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(d.number)
                    .font(.headline)
                Spacer()
                Text(formatCurrency(d.amount))
                    .font(.headline.weight(.bold))
            }
            Text(d.purpose)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            HStack(spacing: 12) {
                drawStatusBadge(d.status)
                if d.inspector_approved {
                    Label("Inspector approved", systemImage: "checkmark.seal.fill")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.green)
                } else {
                    Label("Inspection pending", systemImage: "clock.fill")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.orange)
                }
            }
            if let submitted = d.submitted_at {
                Text("Submitted \(formatDateString(submitted))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
    }

    // ── Notices ───────────────────────────────────────────────────────────
    @ViewBuilder
    private func noticesSection(notices: [BorrowerNotice]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Notices from Servicer")
            if notices.isEmpty {
                emptyState("No notices")
            } else {
                ForEach(notices) { notice in
                    noticeRow(notice)
                }
            }
        }
    }

    @ViewBuilder
    private func noticeRow(_ n: BorrowerNotice) -> some View {
        let isAction = n.type == "action_required"
        HStack(alignment: .top, spacing: 12) {
            Circle()
                .fill(isAction ? Color.kontraBrand.opacity(0.15) : Color(.systemGray5))
                .frame(width: 36, height: 36)
                .overlay(
                    Image(systemName: isAction ? "exclamationmark.triangle.fill" : "bell.fill")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(isAction ? .kontraBrand : .secondary)
                )
            VStack(alignment: .leading, spacing: 4) {
                if isAction {
                    Text("Action Required")
                        .font(.caption.weight(.black))
                        .foregroundStyle(.kontraBrand)
                        .textCase(.uppercase)
                }
                Text(n.subject)
                    .font(.subheadline.weight(.semibold))
                Text(n.body)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                if let from = n.from {
                    Text("From: \(from)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            isAction
                ? Color.kontraBrand.opacity(0.06)
                : Color(.secondarySystemGroupedBackground),
            in: RoundedRectangle(cornerRadius: 12)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(isAction ? Color.kontraBrand.opacity(0.3) : Color.clear, lineWidth: 1)
        )
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

    @ViewBuilder private func alertBanner(_ text: String) -> some View {
        Label(text, systemImage: "exclamationmark.circle.fill")
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(.kontraBrand)
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.kontraBrand.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
    }

    private func infoGrid(_ items: [(String, String)]) -> some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            ForEach(items, id: \.0) { label, value in
                VStack(alignment: .leading, spacing: 3) {
                    Text(label)
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.secondary)
                        .textCase(.uppercase)
                    Text(value)
                        .font(.subheadline.weight(.semibold))
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 10))
            }
        }
    }

    @ViewBuilder private func paidBadge(_ status: String) -> some View {
        Text(status.capitalized)
            .font(.caption.weight(.bold))
            .foregroundStyle(status == "paid" ? .green : .orange)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background((status == "paid" ? Color.green : Color.orange).opacity(0.12))
            .clipShape(Capsule())
    }

    @ViewBuilder private func docStatusBadge(_ status: String) -> some View {
        let color = docStatusColor(status)
        Text(docStatusLabel(status))
            .font(.caption.weight(.bold))
            .foregroundStyle(color)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(color.opacity(0.12))
            .clipShape(Capsule())
    }

    @ViewBuilder private func drawStatusBadge(_ status: String) -> some View {
        let (label, color) = drawStatusInfo(status)
        Text(label)
            .font(.caption.weight(.bold))
            .foregroundStyle(color)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(color.opacity(0.12))
            .clipShape(Capsule())
    }

    private func docStatusColor(_ status: String) -> Color {
        switch status {
        case "approved":  return .green
        case "submitted": return .blue
        default:          return .orange
        }
    }

    private func docStatusIcon(_ status: String) -> String {
        switch status {
        case "approved":  return "checkmark.circle.fill"
        case "submitted": return "clock.fill"
        default:          return "exclamationmark.circle.fill"
        }
    }

    private func docStatusLabel(_ status: String) -> String {
        switch status {
        case "approved":  return "Approved"
        case "submitted": return "Submitted"
        default:          return "Required"
        }
    }

    private func drawStatusInfo(_ status: String) -> (String, Color) {
        switch status {
        case "funded":             return ("Funded", .green)
        case "pending_inspection": return ("Awaiting Inspection", .orange)
        case "under_review":       return ("Under Review", .blue)
        case "denied":             return ("Denied", .kontraBrand)
        default:                   return ("Pending", .gray)
        }
    }

    private func formatCurrency(_ value: Double) -> String {
        value.formatted(.currency(code: "USD").precision(.fractionLength(0...2)))
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
struct BorrowerView_Previews: PreviewProvider {
    static var previews: some View {
        BorrowerView(viewModel: BorrowerViewModel()).environmentObject(AppConfiguration.shared)
    }
}
#endif
