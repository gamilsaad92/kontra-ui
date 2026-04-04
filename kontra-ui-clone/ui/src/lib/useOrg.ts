import { useContext } from "react";
import { OrgContext } from "./OrgProvider";
import type { OrgContextValue } from "./OrgProvider";

export function useOrg(): OrgContextValue {
  return useContext(OrgContext);
}

export type { OrgContextValue };
