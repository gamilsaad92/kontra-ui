import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import TransactionRecordProvenanceReview from "./TransactionRecordProvenanceReview";

const originalFetch = global.fetch;

describe("TransactionRecordProvenanceReview", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    if (originalFetch === undefined) delete global.fetch;
    else global.fetch = originalFetch;
  });

  test("does not expose the source correction action to non-owners", () => {
    render(
      <TransactionRecordProvenanceReview
        propertyId="room-1"
        fieldId="field-1"
        ownerAccess={false}
        hasDocumentEvidence
      />,
    );
    expect(screen.queryByRole("button", { name: "Flag source mismatch" })).not.toBeInTheDocument();
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
