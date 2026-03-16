import SwiftUI

struct TasksView: View {
    @StateObject var viewModel: TasksViewModel
    @EnvironmentObject private var configuration: AppConfiguration

    init(viewModel: @autoclosure @escaping () -> TasksViewModel) {
        _viewModel = StateObject(wrappedValue: viewModel())
    }

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.tasks.isEmpty {
                    switch viewModel.state {
                    case .loaded:
                        ContentUnavailableView(
                            "All tasks complete",
                            systemImage: "checkmark.circle",
                            description: Text("Relax for a moment—new underwriting items will land here.")
                        )
                    default:
                        LoadingStateView(state: viewModel.state) {
                            Task { await viewModel.load() }
                        }
                    }
                } else {
                    List(viewModel.tasks) { task in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text(task.title)
                                    .font(.headline)
                                Spacer()
                                Text(task.dueDate?.formatted(date: .abbreviated, time: .omitted) ?? "No due date")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            HStack(spacing: 10) {
                                Label(task.status.capitalized, systemImage: "checkmark.circle")
                                Label(task.priority.capitalized, systemImage: "flag.fill")
                                    .foregroundStyle(priorityColor(task.priority))
                                if let owner = task.owner, !owner.isEmpty {
                                    Label(owner, systemImage: "person.crop.circle")
                                }
                            }
                            .font(.caption)
                        }
                        .padding(.vertical, 6)
                    }
                    .listStyle(.insetGrouped)
                }
            }
            .navigationTitle("Tasks")
            .toolbar { reloadButton }
            .task { await viewModel.load() }
            .onReceive(configuration.$baseURL) { _ in Task { await viewModel.load() } }
        }
    }

    private func priorityColor(_ priority: String) -> Color {
        switch priority.lowercased() {
        case "urgent":
            return .red
        case "high":
            return .orange
        case "low":
            return .gray
        default:
            return .blue
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
struct TasksView_Previews: PreviewProvider {
    static var previews: some View {
        TasksView(viewModel: TasksViewModel()).environmentObject(AppConfiguration.shared)
    }
}
#endif
