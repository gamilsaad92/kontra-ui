import SwiftUI

struct LoadingStateView: View {
    let state: LoadState
    let retryAction: (() -> Void)?

    init(state: LoadState, retryAction: (() -> Void)? = nil) {
        self.state = state
        self.retryAction = retryAction
    }

    var body: some View {
        switch state {
        case .idle, .loaded:
            EmptyView()
        case .loading:
            ProgressView().progressViewStyle(.circular)
                .padding(.vertical, 16)
        case let .failed(message):
            VStack(spacing: 12) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 32))
                    .foregroundStyle(.orange)
                Text(message)
                    .font(.callout)
                    .multilineTextAlignment(.center)
                if let retryAction {
                    Button("Retry", action: retryAction)
                        .buttonStyle(.borderedProminent)
                }
            }
            .padding(.vertical, 16)
        }
    }
}
