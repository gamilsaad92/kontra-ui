# Kontra Mobile (iOS)

Native SwiftUI iPhone and iPad app for the Kontra platform. Three completely separate role-based experiences — Lender/Servicer dashboard, Borrower portal, and Investor portal — all running on the same Kontra API backend.

## Design theme

Brand color: **Burgundy `#800020`** — applied as the global `.tint` on the `TabView` so every tab bar icon, navigation link, and control automatically uses the brand color.

## Role-based portals

| Tab | Portal | Who uses it |
|---|---|---|
| Dashboard | Lender / Servicer | Underwriters, asset managers, servicer ops |
| Applications | Lender | Review and decision loan applications |
| Tasks | Lender | Underwriting task queue |
| Borrower | Borrower | Loan status, payments, documents, draw requests, notices |
| Investor | Investor | Portfolio holdings, distributions, performance, risk alerts |
| Settings | All | API host switching, environment config |

## Key capabilities

- **Dashboard overview** — consolidated KPIs, pending tasks, credit trends, and risk alerts from `/api/mobile/overview`
- **Borrower portal** — loan details, payment history, document center (upload required docs), draw request tracking, and servicer notices from `/api/borrower/*`
- **Investor portal** — portfolio holdings, distribution history, per-loan performance metrics (DSCR, LTV, delinquency), and risk alerts from `/api/investors/*`
- **Graceful fallback** — every screen falls back to deterministic mock data in DEBUG builds when the network is unavailable
- **Pull-to-refresh** — all screens support `refreshable` for on-demand data refresh
- **API host switching** — the Settings tab lets any user switch between dev, staging, and production endpoints at runtime

## Requirements

- Xcode 15 or later
- iOS 16 deployment target
- Swift 5.9 toolchain
- [XcodeGen](https://github.com/yonaskolb/XcodeGen) (for generating the `.xcodeproj`)

## Project structure

```
ios/
  project.yml              # XcodeGen definition
  KontraMobile/
    App/                   # SwiftUI entry point and tab registration
    Configuration/         # AppConfiguration, KontraTheme (brand colors)
    Models/                # Codable structs (MobileOverview, BorrowerModels, InvestorModels)
    Networking/            # APIClient protocol, Endpoint enum, MockData
    ViewModels/            # ObservableObjects: Dashboard, Applications, Tasks, Borrower, Investor
    Views/
      Dashboard/           # DashboardView + MetricCard
      Applications/        # ApplicationsView + ApplicationRow
      Tasks/               # TasksView
      Borrower/            # BorrowerView (My Loan, Payments, Documents, Draws, Notices)
      Investor/            # InvestorView (Portfolio, Distributions, Performance, Alerts)
      Settings/            # SettingsView
      Components/          # Shared LoadingStateView
    Resources/             # Info.plist, Config.plist
  KontraMobileTests/       # Unit tests for view models
```

## File-to-feature mapping

| Area | Primary files | Purpose |
|---|---|---|
| App entry | `App/KontraMobileApp.swift` | Tab shell, ViewModel injection, brand tint |
| Brand theme | `Configuration/KontraTheme.swift` | `Color.kontraBrand` = `#800020` and variants |
| Configuration | `Configuration/AppConfiguration.swift` | API base URL, organization ID, runtime switching |
| Dashboard | `Views/Dashboard/DashboardView.swift` + `ViewModels/DashboardViewModel.swift` | Lender/servicer KPIs from `/api/mobile/overview` |
| Applications | `Views/Applications/` + `ViewModels/ApplicationsViewModel.swift` | Loan application list and detail |
| Tasks | `Views/Tasks/TasksView.swift` + `ViewModels/TasksViewModel.swift` | Underwriting task queue |
| Borrower portal | `Views/Borrower/BorrowerView.swift` + `ViewModels/BorrowerViewModel.swift` + `Models/BorrowerModels.swift` | Full borrower experience — loan, payments, docs, draws, notices |
| Investor portal | `Views/Investor/InvestorView.swift` + `ViewModels/InvestorViewModel.swift` + `Models/InvestorModels.swift` | Holdings, distributions, performance, risk alerts |
| Networking | `Networking/APIClient.swift` + `Networking/Endpoint.swift` | Protocol + URLSession wrapper for all 13 endpoints |
| Mock data | `Networking/MockData.swift` | Deterministic sample data for previews and DEBUG fallback |
| Load state | `ViewModels/LoadState.swift` | `.idle / .loading / .loaded / .failed` enum |
| Tests | `KontraMobileTests/` | View model decoding and formatting unit tests |

## API endpoints consumed

| Endpoint | Used by |
|---|---|
| `GET /api/mobile/overview` | Dashboard |
| `GET /api/applications?limit=N` | Applications |
| `GET /api/tasks?limit=N` | Tasks |
| `GET /api/borrower/loan` | Borrower — My Loan |
| `GET /api/borrower/payments` | Borrower — Payments |
| `GET /api/borrower/documents` | Borrower — Document Center |
| `GET /api/borrower/draws` | Borrower — Draw Requests |
| `GET /api/borrower/notices` | Borrower — Notices |
| `GET /api/investors/holdings` | Investor — Portfolio |
| `GET /api/investors/distributions` | Investor — Distributions |
| `GET /api/investors/performance` | Investor — Loan Performance |
| `GET /api/investors/alerts` | Investor — Risk Alerts |

## Getting started

1. Install dependencies and generate the Xcode project:

   ```bash
   cd ios
   xcodegen generate
   open KontraMobile.xcodeproj
   ```

2. Configure the API base URL:

   - Copy `KontraMobile/Resources/Config.example.plist` to `KontraMobile/Resources/Config.plist`
   - Set `APIBaseURL` to your Kontra API endpoint (e.g. `https://kontra-api.onrender.com`)

3. Build & run:

   - Select the **KontraMobile** scheme
   - Choose an iPhone 15 simulator or a connected device
   - Press **⌘R**

## Environment switching at runtime

The **Settings** tab lets any user switch between staging and production API hosts without a rebuild. The value is persisted to `UserDefaults`.

## Tests

Run from Xcode (**⌘U**) or the command line:

```bash
xcodebuild test -scheme KontraMobile -destination 'platform=iOS Simulator,name=iPhone 15'
```

## Extending the app

- Add new feature modules under `Views/` and `ViewModels/`, then register them as tabs in `KontraMobileApp.swift`
- New API endpoints go in `Networking/Endpoint.swift` (add a case) and `Networking/APIClient.swift` (add a protocol method + implementation)
- Add the corresponding mock response in `Networking/MockData.swift` for offline previews
- Re-run `xcodegen generate` after adding new files so Xcode picks them up
