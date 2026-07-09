import { getWorkflowPack, DEFAULT_PACK_ID } from "../../lib/workflowPacks";

// Utility exported separately so DealRoomPage can import it without triggering
// Vite React Fast Refresh incompatibility (mixing plain function + component exports).
export function getTemplate(propertyType, packId = DEFAULT_PACK_ID) {
  return getWorkflowPack(packId).getDocumentSchema(propertyType);
}
