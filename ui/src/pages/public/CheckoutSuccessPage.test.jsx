import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import CheckoutSuccessPage from "./CheckoutSuccessPage";

jest.mock("../../lib/apiBase", () => ({ API_BASE: "https://api.example" }));
jest.mock("react-router-dom", () => {
  const ReactRouterTestReact = require("react");
  return {
    Link: ({ to, children, ...props }) => ReactRouterTestReact.createElement(
      "a",
      { ...props, href: to },
      children,
    ),
    useSearchParams: () => [
      new URLSearchParams(globalThis.__checkoutTestSearch || ""),
    ],
  };
});
jest.mock("./PublicLayout", () => ({
  __esModule: true,
  default: ({ children }) => children,
}));

function renderSuccess(path) {
  const url = new URL(path, "http://localhost");
  globalThis.__checkoutTestSearch = url.search;
  window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  return render(<CheckoutSuccessPage />);
}

describe("CheckoutSuccessPage owner access exchange", () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    delete global.fetch;
    delete globalThis.__checkoutTestSearch;
  });

  it("exchanges a paid session for owner access before showing the room link", async () => {
    const ownerToken = "a".repeat(64);
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ propertyId: "room-123", ownerToken }),
    });

    renderSuccess("/checkout/success?plan=deal&property=room-123&session_id=cs_test_checkout123");

    expect(await screen.findByRole("link", { name: /Open My Deal Room/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(localStorage.getItem("kontra_owner_token_room-123")).toBe(ownerToken);
    });
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.example/api/checkout/owner-token",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ sessionId: "cs_test_checkout123" }),
      }),
    );
  });

  it("does not show room access when the session cannot be verified", async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: "Paid checkout could not be verified" }),
    });

    renderSuccess("/checkout/success?plan=deal&property=room-123&session_id=cs_test_invalid123");

    expect(await screen.findByRole("button", { name: /Retry room access verification/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Room access needs attention/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Payment received/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Open My Deal Room/i })).not.toBeInTheDocument();
    expect(localStorage.getItem("kontra_owner_token_room-123")).toBeNull();
  });

  it("preserves already-issued legacy success links without calling the exchange endpoint", async () => {
    const legacyToken = "b".repeat(64);
    renderSuccess(`/checkout/success?plan=deal&property=room-legacy&owner_token=${legacyToken}`);

    expect(await screen.findByRole("link", { name: /Open My Deal Room/i })).toBeInTheDocument();
    expect(localStorage.getItem("kontra_owner_token_room-legacy")).toBe(legacyToken);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
