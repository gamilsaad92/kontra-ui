import SwiftUI

@main
struct KontraMobileApp: App {
    @StateObject private var configuration     = AppConfiguration.shared
    @StateObject private var dashboardViewModel    = DashboardViewModel()
    @StateObject private var applicationsViewModel = ApplicationsViewModel()
    @StateObject private var tasksViewModel        = TasksViewModel()
    @StateObject private var borrowerViewModel     = BorrowerViewModel()
    @StateObject private var investorViewModel     = InvestorViewModel()

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

                BorrowerView(viewModel: borrowerViewModel)
                    .tabItem {
                        Label("Borrower", systemImage: "house.fill")
                    }

                InvestorView(viewModel: investorViewModel)
                    .tabItem {
                        Label("Investor", systemImage: "chart.pie.fill")
                    }

                SettingsView()
                    .tabItem {
                        Label("Settings", systemImage: "gear")
                    }
            }
            .tint(.kontraBrand)
            .environmentObject(configuration)
        }
    }
}
