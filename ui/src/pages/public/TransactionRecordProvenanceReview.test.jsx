import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import TransactionRecordProvenanceReview, {
  hasTransactionRecordDocumentEvidence,
} from "./TransactionRecordProvenanceReview";

const originalFetch = global.fetch;

describe("TransactionRecordProvenanceReview", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    window.localStorage.removeItem("kontra_owner_token_room-1");
    if (originalFetch === undefined) delete global.fetch;
    else global.fetch = originalFetch;
  });

  test("does not expose the action to participants even if a browser owner hint exists", () => {
    window.localStorage.setItem("kontra_owner_token_room-1", "room-owner-session");
    render(
      <TransactionRecordProvenanceReview
        propertyId="room-1"
        fieldId="field-1"
        ownerAccess={false}
        hasDocumentEvidence
      />,
    );
    expect(screen.queryByRole("button", { name: "Flag source mismatch" })).not.toBeInTheDocument();
    window.localStorage.removeItem("kontra_owner_token_room-1");
  });

  test("shows Redwood's projected Buyer evidence action without a source-file hash", () => {
    const projectedBuyerField = {
      key: "parties.buyer",
      fieldId: "buyer-field-id",
      value: "Redwood Capital Partners LLC",
      status: "awaiting",
      sourceType: "transaction_description",
      sourceDocId: "source-document-id",
      sourceDocVersion: null,
      sourceFileHash: null,
      sourcePage: 1,
      sourceExcerpt: "Buyer entity named in the transaction description.",
    };

    expect(hasTransactionRecordDocumentEvidence(projectedBuyerField)).toBe(true);
    render(
      <TransactionRecordProvenanceReview
        propertyId="redwood-business-center-acquisition"
        fieldId={projectedBuyerField.fieldId}
        ownerAccess
        hasDocumentEvidence={hasTransactionRecordDocumentEvidence(projectedBuyerField)}
      />,
    );

    expect(screen.getByRole("button", { name: "Flag source mismatch" })).toBeInTheDocument();
  });

  test("recognizes snake_case source evidence for legacy field projections", () => {
    expect(hasTransactionRecordDocumentEvidence({
      source_doc_id: "source-document-id",
      source_doc_version: null,
      source_file_hash: null,
      source_page: null,
      source_excerpt: null,
      source_type: "transaction_description",
    })).toBe(true);
  });

  test("does not offer a source correction when no document evidence is attached", () => {
    render(
      <TransactionRecordProvenanceReview
        propertyId="room-1"
        fieldId="field-1"
        ownerAccess
        hasDocumentEvidence={false}
      />,
    );
    expect(screen.queryByRole("button", { name: "Flag source mismatch" })).not.toBeInTheDocument();
  });

  test("requires a reason and sends the room-scoped owner-session request", async () => {
    const onUpdated = jest.fn();
    const fetchMock = global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, value_preserved: true, provenance_detached: true }),
    });
    render(
      <TransactionRecordProvenanceReview
        propertyId="room-1"
        fieldId="field-1"
        ownerAccess
        hasDocumentEvidence
        onUpdated={onUpdated}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Flag source mismatch" }));
    const submit = screen.getByRole("button", { name: "Remove source link" });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Why does this source not support the value?"), {
      target: { value: "The excerpt names a different buyer." },
    });
    fireEvent.click(submit);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/public/deal-room/room-1/transaction-record/fields/field-1");
    expect(options).toMatchObject({ method: "PATCH", credentials: "include" });
    expect(JSON.parse(options.body)).toEqual({
      provenance_action: "detach",
      provenance_note: "The excerpt names a different buyer.",
    });
    await waitFor(() => expect(onUpdated).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("status")).toHaveTextContent("The value remains unconfirmed.");
  });

  test("surfaces API rejection without hiding the correction form", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: "Owner access required" }),
    });
    render(
      <TransactionRecordProvenanceReview
        propertyId="room-1"
        fieldId="field-1"
        ownerAccess
        hasDocumentEvidence
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Flag source mismatch" }));
    fireEvent.change(screen.getByLabelText("Why does this source not support the value?"), {
      target: { value: "The source is not the right document." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove source link" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Owner access required");
  });
});
