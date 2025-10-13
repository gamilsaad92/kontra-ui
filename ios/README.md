# Kontra Mobile (iOS)

This directory contains the SwiftUI implementation of the Kontra operator app for iPhone and iPad. The mobile client focuses on the workflows that operators use most on the go—loan intake, underwriting tasks, delinquency alerts, and guided next steps powered by the existing Kontra API.

## Key capabilities

- **Dashboard overview** – consolidated summary of loan pipeline metrics, pending tasks, credit trends, and recent alerts pulled from the API.
- **Loan applications** – browse, filter, and inspect the most recent applications with decisioning context.
- **Task management** – update underwriting tasks, mark items complete, and see ownership at a glance.
- **Personalized guidance** – the same event stream used by the web app surfaces "next best action" guidance on mobile.
- **Offline-friendly data layer** – deterministic decoding, local caching hooks, and graceful fallbacks when network calls fail.

## Requirements

- Xcode 15 or later
- iOS 16 deployment target
- Swift 5.9 toolchain
- [XcodeGen](https://github.com/yonaskolb/XcodeGen) (for generating the `.xcodeproj`)

## Project structure

```
ios/
  project.yml            # XcodeGen definition for the KontraMobile workspace
  KontraMobile/
    App/                 # SwiftUI entry point and dependency graph
    Configuration/       # Runtime configuration helpers (API base URL, feature flags)
    Models/              # Codable structs shared across features
    Networking/          # API client, endpoints, and mock data providers
    ViewModels/          # ObservableObjects that orchestrate each screen
    Views/               # SwiftUI feature modules
    Resources/           # Info.plist and asset placeholders
  KontraMobileTests/     # Unit tests for view models and formatting helpers
```

## File-to-feature mapping

| Area | Primary files | Purpose |
| --- | --- | --- |
| App entry point | `KontraMobile/App/KontraMobileApp.swift` | Configures the tab shell and injects view models into root views. |
| Runtime configuration | `KontraMobile/Configuration/AppConfiguration.swift`<br>`KontraMobile/Resources/Config.plist` | Loads the API base URL and environment toggles used throughout the app. |
| Dashboard overview | `KontraMobile/Views/Dashboard/DashboardView.swift`<br>`KontraMobile/ViewModels/DashboardViewModel.swift`<br>`KontraMobile/Views/Dashboard/MetricCard.swift`<br>`KontraMobile/Models/MobileOverview.swift` | Presents top-level KPIs, trends, and alerts returned by `/api/mobile/overview`. |
| Applications list | `KontraMobile/Views/Applications/ApplicationsView.swift`<br>`KontraMobile/Views/Applications/ApplicationRow.swift`<br>`KontraMobile/ViewModels/ApplicationsViewModel.swift` | Lists and filters recent loan applications and exposes navigation targets for detail views. |
| Tasks | `KontraMobile/Views/Tasks/TasksView.swift`<br>`KontraMobile/ViewModels/TasksViewModel.swift` | Surfaces underwriting tasks, assignment, and completion affordances. |
| Settings & environment overrides | `KontraMobile/Views/Settings/SettingsView.swift` | Allows toggling the active API host and other runtime switches. |
| Shared UI components | `KontraMobile/Views/Components/LoadingStateView.swift` | Reusable loading and empty states shared across tabs. |
| Networking layer | `KontraMobile/Networking/APIClient.swift`<br>`KontraMobile/Networking/Endpoint.swift`<br>`KontraMobile/Networking/MockData.swift` | Wraps `URLSession`, describes API routes, and provides deterministic sample data for previews/tests. |
| Load-state helpers | `KontraMobile/ViewModels/LoadState.swift` | Models loading/error/ready states that view models publish to the UI. |
| Tests | `KontraMobileTests/DashboardViewModelTests.swift` | Validates decoding and presentation logic for dashboard metrics. |

## Linking files in Xcode

1. From the repository root, regenerate the project so Xcode reflects any new on-disk files:

   ```bash
   cd ios
   xcodegen generate
   ```

   XcodeGen reads `ios/project.yml` and mirrors the folder structure under `KontraMobile/` and `KontraMobileTests/` into build targets.

2. Open the generated workspace (`KontraMobile.xcodeproj`). Every folder listed in the table above appears as a group in the **Project Navigator**, automatically linking the Swift sources, resources, and tests into their respective targets.

3. When you add additional Swift files or asset catalogs:

   - Create the file inside the appropriate folder on disk (for example, add a new dashboard component under `KontraMobile/Views/Dashboard/`).
   - Re-run `xcodegen generate` so the `.xcodeproj` picks up the new file.
   - In Xcode, the file will now be part of the relevant target; no manual target membership toggles are required because XcodeGen handles it.

4. To reference shared utilities across features, import the module at the top of your Swift file (e.g., `import KontraMobile`) and initialize the corresponding view model or helper. The generated scheme already links the app and its test target with the shared sources.

5. If you introduce a brand-new module folder (such as `KontraMobile/Views/Alerts/`), update `ios/project.yml` to include it under the appropriate `sources` entry, run XcodeGen again, and the new module appears in Xcode ready for use.

6. For configuration files like `Config.plist`, ensure they reside in `KontraMobile/Resources/`. XcodeGen marks everything in that directory as a bundled resource so the app can load it at runtime via `Bundle.main`.

## Getting started

1. Install dependencies and generate the Xcode project:

   ```bash
   cd ios
   xcodegen generate
   open KontraMobile.xcodeproj
   ```

2. Configure the API base URL so the mobile client can talk to your backend:

   - Copy `KontraMobile/Resources/Config.example.plist` to `KontraMobile/Resources/Config.plist`.
   - Update the `APIBaseURL` value to the environment where the Kontra API is running.

   The value defaults to `http://localhost:5050` for simulator testing.

3. Build & run:

   - Select the **KontraMobile** scheme.
   - Choose an iPhone simulator (or a connected device with the appropriate provisioning profile).
   - Press **⌘R** to launch.

## Environment switching at runtime

The **Settings** tab inside the app lets operators switch between staging and production API hosts without a rebuild. The new value is persisted to `UserDefaults`, and every `APIClient` instance reacts to the change automatically.

## Tests

`KontraMobileTests` currently validates:

- Successful decoding of the `/api/mobile/overview` payload.
- Dashboard metric formatting.
- The optimistic UI path when network calls fail.

Run tests from Xcode (**⌘U**) or via the command line:

```bash
xcodebuild test -scheme KontraMobile -destination 'platform=iOS Simulator,name=iPhone 15'
```

## Extending the mobile client

- The modular folder layout mirrors the web app feature boundaries, making it straightforward to share product requirements between teams.
- Add new feature modules under `Views/` and `ViewModels/`, then register them in `KontraMobileApp.swift`.
- Shared validation logic or formatting lives under `Shared/` (create the folder as new utilities are needed).

## Backend support

The mobile app relies on a new `/api/mobile/overview` endpoint that bundles together the metrics needed for the dashboard. Additional endpoints from the existing API (e.g., `/api/applications`, `/api/tasks`) are consumed directly by the app's view models.
