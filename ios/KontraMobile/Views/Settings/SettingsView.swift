import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var configuration: AppConfiguration
    @State private var baseURLString: String = ""
    @State private var organizationID: String = ""
    @State private var showConfirmation = false

    var body: some View {
        NavigationStack {
            Form {
                Section("API") {
                    TextField("Base URL", text: $baseURLString)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .disableAutocorrection(true)
                    Button("Apply") {
                        applyBaseURL()
                    }
                    .disabled(URL(string: baseURLString) == nil)
                }

                Section("Organization") {
                    TextField("Organization ID", text: $organizationID)
                        .textInputAutocapitalization(.never)
                        .disableAutocorrection(true)
                    Button("Save") {
                        configuration.update(organizationID: organizationID)
                        showConfirmation = true
                    }
                    .disabled(organizationID.isEmpty)
                }

                Section("Support") {
                    Link(destination: URL(string: "https://kontra.example.com/docs")!) {
                        Label("Documentation", systemImage: "book.fill")
                    }
                    Link(destination: URL(string: "mailto:support@kontra.example.com")!) {
                        Label("Contact support", systemImage: "envelope.fill")
                    }
                }
            }
            .navigationTitle("Settings")
            .onAppear {
                baseURLString = configuration.baseURL.absoluteString
                organizationID = configuration.organizationID
            }
            .alert("Updated", isPresented: $showConfirmation, actions: {}) {
                Text("Your preferences have been saved.")
            }
        }
    }

    private func applyBaseURL() {
        guard let url = URL(string: baseURLString) else { return }
        configuration.update(baseURL: url)
        showConfirmation = true
    }
}

#if DEBUG
struct SettingsView_Previews: PreviewProvider {
    static var previews: some View {
        SettingsView().environmentObject(AppConfiguration.shared)
    }
}
#endif
