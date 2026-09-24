import { resolveDocumentChecklistView } from "./documentChecklistAccess";

const historicalEvidence = Array.from({ length: 8 }, (_, index) => ({
  id: `evidence-${index + 1}`,
  section: `evidence_${index + 1}`,
  required: true,
  assignedTo: ["buyer"],
}));

describe("document checklist access", () => {
  test("authenticated owner sees every custom-pack evidence requirement despite the UI role key mismatch", () => {
    const view = resolveDocumentChecklistView({
      items: historicalEvidence,
      role: "deal_coordinator",
      access: { mode: "owner" },
    });

    expect(view.isCoordinator).toBe(true);
    expect(view.template).toHaveLength(8);
    expect(view.template.every(item => item.required)).toBe(true);
  });

  test("participants remain limited to documents assigned to their verified role", () => {
    const items = [
      { id: "buyer-1", assignedTo: ["buyer"] },
      { id: "buyer-2", assignedTo: [" Buyer "] },
      { id: "seller-1", assignedTo: ["seller"] },
    ];
    const view = resolveDocumentChecklistView({
      items,
      role: "buyer",
      access: {
        mode: "participant",
        permissions: {
          viewAllDocuments: false,
          manageStages: false,
          manageParticipants: false,
          manageSettings: false,
        },
      },
    });

    expect(view.isCoordinator).toBe(false);
    expect(view.template.map(item => item.id)).toEqual(["buyer-1", "buyer-2"]);
  });

  test("a participant role label marked canManage in the pack does not grant coordinator access", () => {
    const view = resolveDocumentChecklistView({
      items: historicalEvidence,
      role: "deal_room_owner",
      access: {
        mode: "participant",
        permissions: {
          manageStages: false,
          manageParticipants: false,
          manageSettings: false,
        },
      },
      demoRoleCanManage: true,
    });

    expect(view.isCoordinator).toBe(false);
    expect(view.template).toEqual([]);
  });

  test("an explicit server-granted coordinator permission allows full checklist access", () => {
    const view = resolveDocumentChecklistView({
      items: historicalEvidence,
      role: "deal_coordinator",
      access: {
        mode: "participant",
        permissions: { manageSettings: true },
      },
    });

    expect(view.isCoordinator).toBe(true);
    expect(view.template).toHaveLength(8);
  });
});