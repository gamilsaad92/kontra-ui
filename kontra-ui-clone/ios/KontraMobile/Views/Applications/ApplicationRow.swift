import SwiftUI

struct ApplicationRow: View {
    let application: LoanApplication

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(application.name)
                    .font(.headline)
                Spacer()
                Text(application.submittedAt.formatted(date: .abbreviated, time: .shortened))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            HStack {
                Label(application.status.replacingOccurrences(of: "_", with: " ").capitalized, systemImage: iconName)
                    .font(.subheadline)
                Spacer()
                Text(application.amount, format: .currency(code: "USD"))
                    .font(.headline)
            }
            Text("Decision: \(application.decision.capitalized)")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 8)
    }

    private var iconName: String {
        switch application.status {
        case "approved":
            return "checkmark.seal.fill"
        case "declined":
            return "xmark.seal.fill"
        default:
            return "hourglass"
        }
    }
}
