import { render, screen } from "@testing-library/react";
import DocumentsTabPanel from "./DocumentsTabPanel";
import { getWorkflowPack } from "../../lib/workflowPacks";

jest.mock("../../lib/workflowPacks", () => ({
  DEFAULT_PACK_ID: "cre_acquisition",
  getWorkflowPack: jest.fn(),
}));

jest.mock("../../lib/inviteUtils", () => ({
  getRoomAuthHeaders: jest.fn(() => ({ "x-owner-write-token": "test-owner-token" })),
}));

jest.mock("../../lib/apiBase", () => ({ API_BASE: "/api" }));
jest.mock("./VerificationPanel", () => ({
  __esModule: true,
  default: () => null,
}));

const ownerEvidence = Array.from({ length: 8 }, (_, index) => ({
  id: `historical-evidence-${index + 1}`,
  section: `historical_evidence_${index + 1}`,
  label: `Historical evidence ${index + 1}`,
  required: true,
  assignedTo: ["buyer"],
}));

let checklistItems;

function createPack() {
  const roles = [
    { key: "deal_room_owner", label: "Workspace owner", canManage: true, invitable: true },
    { key: "buyer", label: "Buyer", canManage: false, invitable: true },
    { key: "seller", label: "Seller", canManage: false, invitable: true },
  ];
  return {
    roles,
    checklistTitle: "Historical Evidence",
    aiUploadEndpoints: {},
    factColors: { neutral: { bg: "#fff", text: "#111", border: "#ddd" } },
    getRole: key => roles.find(role => role.key === key) || null,
    getDocumentSchema: () => checklistItems,
    getInlineFacts: () => [],
    getCompletenessIssues: () => [],
  };
}

const response = body => ({
  ok: true,
  json: async () => body,
});

function renderDocumentsTab({ role, access }) {
  return render(
    <DocumentsTabPanel
      propertyId="summit-ridge-test"
      propertyType=""
      role={role}
      access={access}
      isDemo={false}
      packId="ws_summit_ridge_test"
      packReady
    />,
  );
}

beforeEach(() => {
  checklistItems = ownerEvidence;
  getWorkflowPack.mockImplementation(createPack);
  global.fetch = jest.fn(async url => {
    if (String(url).includes("/analyses")) return response({ analyses: [] });
    if (String(url).includes("/checklist")) return response({ items: checklistItems });
    return response({});
  });
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("Documents tab access", () => {
  test("owner sees upload controls for all eight buyer-assigned historical evidence requirements", async () => {
    const { container } = renderDocumentsTab({
      role: "deal_coordinator",
      access: { mode: "owner" },
    });

    expect(await screen.findAllByRole("button", { name: "↑ Upload" })).toHaveLength(8);
    expect(container.querySelectorAll("[data-document-section]")).toHaveLength(8);
  });

  test("participant sees only their assigned document rows", async () => {
    checklistItems = [
      { id: "buyer-evidence", section: "buyer_evidence", label: "Buyer evidence", required: true, assignedTo: ["buyer"] },
      { id: "seller-evidence", section: "seller_evidence", label: "Seller evidence", required: true, assignedTo: ["seller"] },
    ];
    const { container } = renderDocumentsTab({
      role: "buyer",
      access: {
        mode: "participant",
        role: "buyer",
        permissions: { viewAllDocuments: false, manageStages: false, manageParticipants: false, manageSettings: false },
      },
    });

    expect(await screen.findByText("Buyer evidence")).toBeInTheDocument();
    expect(screen.queryByText("Seller evidence")).not.toBeInTheDocument();
    expect(container.querySelectorAll("[data-document-section]")).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "↑ Upload" })).toHaveLength(1);
  });
});