import SwiftUI

@main
struct KontraMobileApp: App {
    @StateObject private var configuration = AppConfiguration.shared
    @StateObject private var dashboardViewModel = DashboardViewModel()
    @StateObject private var applicationsViewModel = ApplicationsViewModel()
    @StateObject private var tasksViewModel = TasksViewModel()

    var body: some Scene {
        WindowGroup {
            TabView {
                DashboardView(viewModel: dashboardViewModel)
                    .tabItem {
                        Label("Dashboard", systemImage: "speedometer")
                    }

                ApplicationsView(viewModel: applicationsViewModel)
                    .tabItem {
                        Label("Applications", systemImage: "doc.on.doc")
                    }

                TasksView(viewModel: tasksViewModel)
                    .tabItem {
                        Label("Tasks", systemImage: "checkmark.circle")
                    }

                SettingsView()
                    .tabItem {
                        Label("Settings", systemImage: "gear")
                    }
            }
            .environmentObject(configuration)
        }
    }
}
