import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import TeamPage from "./TeamPage";

const mockApiFetch = jest.fn();

jest.mock("../../lib/apiClient", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

function response(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  };
}

const owner = {
  id: "membership-owner",
  user_id: "owner-uuid",
  app_role: "owner",
  status: "active",
  created_at: "2026-11-01T00:00:00.000Z",
  profiles: { id: "owner-uuid", email: "owner@example.test", full_name: "Room Owner", avatar_url: null },
};

const member = {
  id: "membership-member",
  user_id: "member-uuid",
  app_role: "member",
  status: "active",
  created_at: "2026-11-02T00:00:00.000Z",
  profiles: { id: "member-uuid", email: "member@example.test", full_name: "Room Member", avatar_url: null },
};

beforeEach(() => {
  mockApiFetch.mockReset();
});

test("owner UI offers only assignable roles and uses server-provided permissions", async () => {
  mockApiFetch.mockResolvedValue(response({
    members: [owner, member],
    permissions: { canAssignRoles: true, canInviteAdmin: true, canRevokeMembers: true },
  }));
  render(<TeamPage />);

  await screen.findByText("member@example.test");
  expect(screen.getAllByRole("combobox")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: /Invite Member/ }));

  const modalTitle = screen.getByText("Invite Team Member");
  const modal = modalTitle.parentElement as HTMLElement;
  const roleSelect = within(modal).getByRole("combobox");
  expect(Array.from((roleSelect as HTMLSelectElement).options).map((option) => option.value))
    .toEqual(["admin", "member"]);
  expect(Array.from((roleSelect as HTMLSelectElement).options).some((option) => option.value === "owner"))
    .toBe(false);
});

test("admin UI cannot assign roles or invite admins but can revoke members", async () => {
  mockApiFetch.mockResolvedValue(response({
    members: [owner, member],
    permissions: { canAssignRoles: false, canInviteAdmin: false, canRevokeMembers: true },
  }));
  render(<TeamPage />);

  await screen.findByText("member@example.test");
  expect(screen.queryByRole("combobox")).toBeNull();
  expect(screen.getByRole("button", { name: "Revoke" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Invite Member/ }));

  const modalTitle = screen.getByText("Invite Team Member");
  const modal = modalTitle.parentElement as HTMLElement;
  const roleSelect = within(modal).getByRole("combobox");
  expect(Array.from((roleSelect as HTMLSelectElement).options).map((option) => option.value))
    .toEqual(["member"]);
});
