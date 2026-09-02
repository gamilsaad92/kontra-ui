import { useCallback, useReducer } from "react";

const initialState = {
  status: "idle",
  description: "",
  role: "Servicing",
  outlook: "",
  includeSummary: true,
  proposal: null,
  approval: false,
  hooks: {},
  error: "",
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "REQUEST_START":
      return { ...state, status: "loading", error: "" };
    case "REQUEST_SUCCESS":
      return {
        ...state,
        status: "proposal_ready",
        proposal: action.proposal,
        approval: false,
        hooks: action.hooks,
        error: "",
      };
    case "REQUEST_ERROR":
      return { ...state, status: "error", error: action.error };
    case "SET_APPROVAL":
      return { ...state, approval: action.value };
    case "TOGGLE_HOOK":
      return { ...state, hooks: { ...state.hooks, [action.key]: action.value } };
    case "MARK_APPLIED":
      return { ...state, status: "applied" };
    case "CLEAR_APPLIED":
      return { ...state, status: "proposal_ready" };
    default:
      return state;
  }
}

export function useAiReportAgent(apiBase) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const setField = useCallback((field, value) => {
    dispatch({ type: "SET_FIELD", field, value });
  }, []);

  const requestProposal = useCallback(async () => {
    dispatch({ type: "REQUEST_START" });
    try {
      const res = await fetch(`${apiBase}/api/reports/ai/propose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: state.description,
          role: state.role,
          outlook_days: state.outlook ? Number(state.outlook) : null,
          include_executive_summary: state.includeSummary,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        dispatch({ type: "REQUEST_ERROR", error: data.message || "Failed to generate AI proposal" });
        return;
      }
      const hookDefaults = (data.automationHooks || []).reduce((acc, hook) => {
        acc[hook.action_type] = false;
        return acc;
      }, {});
      dispatch({ type: "REQUEST_SUCCESS", proposal: data, hooks: hookDefaults });
    } catch (err) {
      dispatch({ type: "REQUEST_ERROR", error: "Failed to generate AI proposal" });
    }
  }, [apiBase, state.description, state.includeSummary, state.outlook, state.role]);

  const toggleHook = useCallback((key, value) => {
    dispatch({ type: "TOGGLE_HOOK", key, value });
  }, []);

  const setApproval = useCallback((value) => {
    dispatch({ type: "SET_APPROVAL", value });
  }, []);

  const markApplied = useCallback(() => {
    dispatch({ type: "MARK_APPLIED" });
  }, []);

  const clearApplied = useCallback(() => {
    dispatch({ type: "CLEAR_APPLIED" });
  }, []);

  return {
    state,
    setField,
    requestProposal,
    toggleHook,
    setApproval,
    markApplied,
    clearApplied,
  };
}
