# Browser wallet integration status

The browser wallet integration has been removed because no current Kontra workflow uses it.

Removed:

- The app-wide Web3 provider and RainbowKit connection UI wrapper.
- The unused Chainlink oracle panel, which was not mounted by an app route.
- The UI's direct RainbowKit, wagmi, and viem dependencies and their wallet-only dependency graph.
- The frontend read of `VITE_WALLETCONNECT_PROJECT_ID`. If configured in a hosting environment, that value is no longer consumed by the UI; it was not changed here.

Preserved:

- Deal-room creation and management, document uploads, approvals, verification, and tokenization-readiness records and reports.
- The existing blockchain API service and routes. Removing the browser wallet stack does not remove or change these API-backed features.
- Production and staging API routing.

If a future workflow needs wallet connection or transaction signing, add it behind a route-specific integration and review its dependency graph before enabling it.
