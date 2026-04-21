import SwiftUI

struct ApplicationsView: View {
    @StateObject var viewModel: ApplicationsViewModel
    @EnvironmentObject private var configuration: AppConfiguration

    init(viewModel: @autoclosure @escaping () -> ApplicationsViewModel) {
        _viewModel = StateObject(wrappedValue: viewModel())
    }

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.applications.isEmpty {
                    switch viewModel.state {
                    case .loaded:
                        ContentUnavailableView(
                            "No applications",
                            systemImage: "doc.text.magnifyingglass",
                            description: Text("New submissions will appear here automatically.")
                        )
                    default:
                        LoadingStateView(state: viewModel.state) {
                            Task { await viewModel.load() }
                        }
                    }
                } else {
                    List(viewModel.applications) { application in
                        ApplicationRow(application: application)
                    }
                    .listStyle(.insetGrouped)
                }
            }
            .navigationTitle("Applications")
            .toolbar { reloadButton }
            .task { await viewModel.load() }
            .onReceive(configuration.$baseURL) { _ in Task { await viewModel.load() } }
        }
    }

    private var reloadButton: some ToolbarContent {
        ToolbarItem(placement: .primaryAction) {
            Button(action: { Task { await viewModel.load() } }) {
                Image(systemName: "arrow.clockwise")
            }
        }
    }
}

#if DEBUG
struct ApplicationsView_Previews: PreviewProvider {
    static var previews: some View {
        ApplicationsView(viewModel: ApplicationsViewModel()).environmentObject(AppConfiguration.shared)
    }
}
#endif
