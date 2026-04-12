/**
 * Loan Governance Router — DEV ONLY
 * Role-separated governance: lender_controller, master_servicer,
 * special_servicer, asset_manager, investor, admin
 *
 * Rule: investors vote on major economic outcomes only.
 * Servicing decisions stay exclusively in the Kontra execution layer.
 * Blockchain records ownership, votes, distributions, outcomes — not servicing.
 */
const express  = require("express");
const router   = express.Router();
const { supabase } = require("../db");
const requireOrg   = require("../middlewares/requireOrg");

router.use(requireOrg);

const VALID_ROLES = ["lender_controller","master_servicer","special_servicer","asset_manager","investor","admin"];

// ── helpers ───────────────────────────────────────────────────
function toUUID(id) {
  if (!id) return null;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id))) return String(id);
  return `00000000-0000-0000-0000-${String(id).padStart(12, "0")}`;
}

function handleDbError(res, err, fallback) {
  if (err?.code === "42P01" || err?.message?.includes("does not exist")) {
    return res.json(fallback);
  }
  console.error("[loanGovernance]", err?.message);
  return res.status(500).json({ error: "Database error", details: err?.message });
}

// ── GET /api/loan-governance/proposals ────────────────────────
router.get("/proposals", async (req, res) => {
  try {
    const orgId  = req.orgId;
    const status = req.query.status; // optional filter
    

    let query = supabase
      .from("governance_proposals")
      .select(`
        id, proposal_number, proposal_type, title, description,
        proposed_by_role, threshold_pct, quorum_pct, voting_deadline,
        status, votes_for_pct, votes_against_pct, votes_abstain_pct,
        quorum_met, blockchain_tx_hash, created_at,
        loan_id
      `)
      .eq("org_id", toUUID(orgId))
      .order("created_at", { ascending: false })
      .limit(50);

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return handleDbError(res, error, { proposals: [] });

    return res.json({ proposals: data ?? [] });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ── POST /api/loan-governance/proposals ───────────────────────
// Only master_servicer, special_servicer, asset_manager, lender_controller can propose
router.post("/proposals", async (req, res) => {
  try {
    const { proposal_type, title, description, loan_id, threshold_pct, quorum_pct, voting_deadline_days } = req.body;
    const orgId = req.orgId;
    const userId = req.user?.id;
    

    const PROPOSER_ROLES = ["lender_controller","master_servicer","special_servicer","asset_manager"];
    const { data: roleRow } = await supabase
      .from("governance_role_assignments")
      .select("role")
      .eq("org_id", toUUID(orgId))
      .eq("user_id", toUUID(userId))
      .eq("active", true)
      .in("role", PROPOSER_ROLES)
      .single();

    if (!roleRow) {
      return res.status(403).json({ error: "Only servicers and asset managers may create governance proposals. Investors cannot propose." });
    }

    const deadline = new Date(Date.now() + (voting_deadline_days ?? 14) * 86400000).toISOString();
    const propNum  = `GV-${String(Date.now()).slice(-3)}`;

    const { data, error } = await supabase
      .from("governance_proposals")
      .insert({
        org_id: toUUID(orgId),
        loan_id: loan_id ? toUUID(loan_id) : null,
        proposal_number: propNum,
        proposal_type: proposal_type ?? "other",
        title, description,
        proposed_by: toUUID(userId),
        proposed_by_role: roleRow.role,
        threshold_pct: threshold_pct ?? 66.7,
        quorum_pct: quorum_pct ?? 50,
        voting_deadline: deadline,
        status: "active",
      })
      .select()
      .single();

    if (error) return handleDbError(res, error, { error: error.message });

    // Audit log
    await supabase.from("governance_audit_log").insert({
      org_id: toUUID(orgId),
      loan_id: loan_id ? toUUID(loan_id) : null,
      actor_user_id: toUUID(userId),
      actor_role: roleRow.role,
      action_type: "proposal_created",
      decision_category: "governance",
      description: `Proposal ${propNum} created: ${title}`,
      outcome: "pending",
      proposal_id: data.id,
    });

    return res.status(201).json({ proposal: data });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ── POST /api/loan-governance/proposals/:id/vote ──────────────
// Only investors can vote; they cannot cast servicing actions
router.post("/proposals/:id/vote", async (req, res) => {
  try {
    const { id } = req.params;
    const { vote, rationale } = req.body; // vote: 'for' | 'against' | 'abstain'
    const orgId = req.orgId;
    const userId = req.user?.id;
    

    if (!["for","against","abstain"].includes(vote)) {
      return res.status(400).json({ error: "vote must be 'for', 'against', or 'abstain'" });
    }

    // Verify voter has investor role with voting power
    const { data: roleRow } = await supabase
      .from("governance_role_assignments")
      .select("role, voting_power")
      .eq("org_id", toUUID(orgId))
      .eq("user_id", toUUID(userId))
      .eq("role", "investor")
      .eq("active", true)
      .single();

    if (!roleRow) {
      return res.status(403).json({ error: "Only investors with an active role assignment may vote on governance proposals." });
    }

    // Confirm proposal is active and not expired
    const { data: proposal, error: propErr } = await supabase
      .from("governance_proposals")
      .select("id, status, voting_deadline, title, proposal_number")
      .eq("id", id)
      .eq("org_id", toUUID(orgId))
      .single();

    if (propErr || !proposal) return res.status(404).json({ error: "Proposal not found" });
    if (proposal.status !== "active") return res.status(400).json({ error: "Proposal is not active" });
    if (new Date(proposal.voting_deadline) < new Date()) return res.status(400).json({ error: "Voting deadline has passed" });

    const { data: voteData, error: voteErr } = await supabase
      .from("governance_votes")
      .upsert({
        proposal_id: id,
        voter_id: toUUID(userId),
        vote,
        voting_power: roleRow.voting_power,
        rationale: rationale ?? null,
        cast_at: new Date().toISOString(),
      }, { onConflict: "proposal_id,voter_id" })
      .select()
      .single();

    if (voteErr) return handleDbError(res, voteErr, { error: voteErr.message });

    // Recalculate aggregate vote percentages
    const { data: allVotes } = await supabase
      .from("governance_votes")
      .select("vote, voting_power")
      .eq("proposal_id", id);

    if (allVotes) {
      const totalPower = allVotes.reduce((s, v) => s + parseFloat(v.voting_power), 0);
      const forPower   = allVotes.filter((v) => v.vote === "for").reduce((s, v) => s + parseFloat(v.voting_power), 0);
      const againstPow = allVotes.filter((v) => v.vote === "against").reduce((s, v) => s + parseFloat(v.voting_power), 0);
      const abstainPow = allVotes.filter((v) => v.vote === "abstain").reduce((s, v) => s + parseFloat(v.voting_power), 0);

      const { data: updatedProposal } = await supabase
        .from("governance_proposals")
        .update({
          votes_for_pct:      totalPower > 0 ? (forPower / totalPower * 100) : 0,
          votes_against_pct:  totalPower > 0 ? (againstPow / totalPower * 100) : 0,
          votes_abstain_pct:  totalPower > 0 ? (abstainPow / totalPower * 100) : 0,
          total_voting_power_cast: totalPower,
          quorum_met: totalPower >= parseFloat(proposal.quorum_pct ?? 50),
        })
        .eq("id", id)
        .select()
        .single();

      // Audit
      await supabase.from("governance_audit_log").insert({
        org_id: toUUID(orgId),
        actor_user_id: toUUID(userId),
        actor_role: "investor",
        action_type: "vote_cast",
        decision_category: "governance",
        description: `Investor voted ${vote.toUpperCase()} on ${proposal.proposal_number}: ${proposal.title} — ${roleRow.voting_power}% voting power`,
        outcome: "recorded",
        proposal_id: id,
      });

      return res.json({ vote: voteData, proposal: updatedProposal });
    }

    return res.json({ vote: voteData });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ── GET /api/loan-governance/audit ────────────────────────────
router.get("/audit", async (req, res) => {
  try {
    const orgId    = req.orgId;
    const category = req.query.category; // 'servicing' | 'governance'
    const limit    = Math.min(parseInt(req.query.limit ?? "100"), 200);
    

    let query = supabase
      .from("governance_audit_log")
      .select("id, actor_role, action_type, decision_category, description, outcome, loan_id, blockchain_tx_hash, created_at")
      .eq("org_id", toUUID(orgId))
      .order("created_at", { ascending: false })
      .limit(limit);

    if (category) query = query.eq("decision_category", category);

    const { data, error } = await query;
    if (error) return handleDbError(res, error, { entries: [] });

    return res.json({ entries: data ?? [] });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ── POST /api/loan-governance/audit ───────────────────────────
// Internal endpoint — log a servicing or governance action
router.post("/audit", async (req, res) => {
  try {
    const { actor_role, action_type, decision_category, description, outcome, loan_id, blockchain_tx_hash, metadata } = req.body;
    const orgId  = req.orgId;
    const userId = req.user?.id;

    if (!VALID_ROLES.includes(actor_role) && actor_role !== "system") {
      return res.status(400).json({ error: `Invalid role: ${actor_role}` });
    }
    if (!["servicing","governance"].includes(decision_category)) {
      return res.status(400).json({ error: "decision_category must be 'servicing' or 'governance'" });
    }

    
    const { data, error } = await supabase
      .from("governance_audit_log")
      .insert({
        org_id: toUUID(orgId),
        loan_id: loan_id ? toUUID(loan_id) : null,
        actor_user_id: toUUID(userId),
        actor_role, action_type, decision_category, description,
        outcome: outcome ?? null,
        blockchain_tx_hash: blockchain_tx_hash ?? null,
        metadata: metadata ?? {},
      })
      .select()
      .single();

    if (error) return handleDbError(res, error, { error: error.message });
    return res.status(201).json({ entry: data });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ── GET /api/loan-governance/roles ────────────────────────────
router.get("/roles", async (req, res) => {
  try {
    const orgId = req.orgId;
    

    const { data, error } = await supabase
      .from("governance_role_assignments")
      .select(`
        id, role, voting_power, active, notes, created_at,
        user:users(id, full_name, email)
      `)
      .eq("org_id", toUUID(orgId))
      .order("role")
      .order("created_at");

    if (error) return handleDbError(res, error, { assignments: [] });

    const assignments = (data ?? []).map((row) => ({
      id: row.id,
      user_name: row.user?.full_name ?? "Unknown",
      email: row.user?.email ?? "",
      role: row.role,
      voting_power: parseFloat(row.voting_power ?? 0),
      active: row.active,
    }));

    return res.json({ assignments });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ── POST /api/loan-governance/roles ───────────────────────────
// Only lender_controller or admin can assign roles
router.post("/roles", async (req, res) => {
  try {
    const { user_id, role, voting_power, notes } = req.body;
    const orgId  = req.orgId;
    const userId = req.user?.id;

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` });
    }

    

    // Verify caller has authority
    const { data: callerRole } = await supabase
      .from("governance_role_assignments")
      .select("role")
      .eq("org_id", toUUID(orgId))
      .eq("user_id", toUUID(userId))
      .eq("active", true)
      .in("role", ["lender_controller","admin"])
      .single();

    if (!callerRole) {
      return res.status(403).json({ error: "Only lender_controller or admin may assign governance roles." });
    }

    const { data, error } = await supabase
      .from("governance_role_assignments")
      .upsert({
        org_id: toUUID(orgId),
        user_id: toUUID(user_id),
        role,
        assigned_by: toUUID(userId),
        voting_power: role === "investor" ? (parseFloat(voting_power) || 0) : 0,
        active: true,
        notes: notes ?? null,
      }, { onConflict: "org_id,user_id,role" })
      .select()
      .single();

    if (error) return handleDbError(res, error, { error: error.message });
    return res.status(201).json({ assignment: data });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ── POST /api/loan-governance/proposals/:id/execute ──────────
// Lender controller confirms execution after governance approval
// Blockchain records the approved outcome; Kontra backend executes
router.post("/proposals/:id/execute", async (req, res) => {
  try {
    const { id } = req.params;
    const { blockchain_tx_hash } = req.body;
    const orgId  = req.orgId;
    const userId = req.user?.id;
    

    const { data: callerRole } = await supabase
      .from("governance_role_assignments")
      .select("role")
      .eq("org_id", toUUID(orgId))
      .eq("user_id", toUUID(userId))
      .eq("active", true)
      .eq("role", "lender_controller")
      .single();

    if (!callerRole) {
      return res.status(403).json({ error: "Only the lender_controller may execute an approved governance proposal." });
    }

    const { data: proposal } = await supabase
      .from("governance_proposals")
      .select("id, status, votes_for_pct, threshold_pct, quorum_met, title, proposal_number")
      .eq("id", id)
      .eq("org_id", toUUID(orgId))
      .single();

    if (!proposal) return res.status(404).json({ error: "Proposal not found" });
    if (proposal.status !== "approved" && !(proposal.quorum_met && proposal.votes_for_pct >= proposal.threshold_pct)) {
      return res.status(400).json({ error: "Proposal has not reached the approval threshold. Execution blocked." });
    }

    const { data: updated } = await supabase
      .from("governance_proposals")
      .update({
        status: "executed",
        blockchain_tx_hash: blockchain_tx_hash ?? null,
        executed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    await supabase.from("governance_audit_log").insert({
      org_id: toUUID(orgId),
      actor_user_id: toUUID(userId),
      actor_role: "lender_controller",
      action_type: "proposal_executed",
      decision_category: "governance",
      description: `Governance outcome executed: ${proposal.proposal_number} — ${proposal.title}`,
      outcome: "executed",
      proposal_id: id,
      blockchain_tx_hash: blockchain_tx_hash ?? null,
    });

    return res.json({ proposal: updated });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
