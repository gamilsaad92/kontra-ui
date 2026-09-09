# Kontra's North Star: Everything Is a Task

This document defines the operating model behind Kontra's deal rooms. It exists so that
every future feature — AI reminders, compliance checks, servicing workflows,
tokenization steps — plugs into one model instead of becoming its own parallel
subsystem. If a new feature can't be expressed as "a task with an owner, evidence,
and a lifecycle," that's a signal to rethink the feature, not to bolt on a new table.

## The core idea

Before this model, a deal room was a collection of loosely related things: a
checklist, notifications, an activity timeline, one-off emails. Each lived in its
own table with its own logic.

Now, every unit of work in a deal room — a missing document, an expiring policy, a
pending invite, a reminder to send — is the same kind of row:

```
Task
 ├─ Owner        (a human role, or "ai")
 ├─ Evidence     (why this task exists, in plain language)
 ├─ Draft Action (what AI would do, if approved — optional)
 ├─ Status       (where it is in its lifecycle)
 └─ Source       (what created it, for traceability)
```

Checklists, AI flags, reminders, and notifications aren't separate systems anymore.
They are different *task types* built on the same primitive.

## What creates tasks

Tasks are created two ways:

1. **Event-driven (live today).** Something happens — a party submits documents, an
   AI document review completes — and the system evaluates the deal room against a
   small set of rules: a required role hasn't submitted anything, a submission has
   sat in "invited" status without action, or an AI document summary surfaces
   expiration or missing-attachment language. If a rule fires and no open task
   already covers it, a new task is created.

2. **Human-driven (implicit today, explicit later).** A person completes a step
   that itself was represented as a task (e.g. uploading a document against a
   checklist item). Today this is handled by existing checklist/submission code
   paths; the intent is for these to become first-class task completions too,
   not a parallel system that happens to look similar.

**Not yet built:** time-driven task creation — a task that ages and escalates on
its own schedule (e.g. "still missing after 3 days → follow-up task on Wednesday →
escalation on Friday") independent of any new event. See "What's next" below.

## Who can own a task

Ownership is one of two kinds, always explicit, never implied:

- **A human role** — the specific role defined for the deal room's Workflow Pack
  (owner, lender, inspector, insurer, attorney, etc. for CRE; buyer, seller, CPA,
  counsel, etc. for Business Acquisition). Ownership by role, not by person, is
  deliberate: roles are stable across a deal even as the specific person invited
  into that role can change.
- **AI** — the system itself. An AI-owned task means AI noticed something and is
  either surfacing it for awareness or has prepared an action for a human to
  approve.

There is no "unowned" task. If nothing has claimed a task, it doesn't exist as a
task yet — it's just data.

## Evidence, not confidence

AI-owned tasks never carry a confidence score. A number like "94%" asks the user to
trust a black box; nobody does, and it doesn't tell them what to actually check.

Instead, every AI task carries evidence as plain-language facts pulled directly
from the deal room's own data:

- *"No party_submissions record found for role 'insurer'."*
- *"party_submissions.status = 'invited' for role 'attorney' — invited, not yet
  submitted."*
- *"AI analysis of 'Insurance Certificate.pdf': policy expires July 28, renewal
  document not found."*

The rule going forward: if a piece of reasoning can't be phrased as a concrete,
checkable fact, it doesn't belong on a task. This also keeps AI tasks auditable —
anyone can verify the evidence against the underlying record.

## How approval works (the one auditable path)

AI may **create** a task and **draft** an action (currently: a reminder email). AI
may **never execute** that action on its own. There is exactly one code path where
a draft action is executed, and it only runs in direct response to a human clicking
Approve:

```
AI creates task + drafts action  →  Human reviews evidence  →  Human clicks Approve
                                                                        │
                                                                        ▼
                                                        The one execution path runs
                                                     (sends the email, logs the event,
                                                        marks the task completed)
```

This is Observe Mode, and it is a hard product constraint, not a temporary
limitation: **AI prepares, a human approves.** Any future task type that wants to
take an action (advance a stage, notify a party, generate a document) must route
through this same single approval path — never a new one-off "AI does X"
function. A second execution path is itself a bug to catch in review, not a
feature to ship.

Dismissing a task is the human override in the other direction: a human can decide
a task doesn't need action at all, no execution required.

## Task lifecycle (today vs. where it's going)

**Today**, a task's status is one of: `pending`, `in_progress`, `escalated`,
`completed`, `dismissed`. `completed` and `dismissed` are terminal; the others are
all "open" for the purposes of counting what needs attention.

**Where it's going** — a fuller lifecycle so a task's state always answers "what is
this actually waiting on right now":

```
Open → AI Reviewing → Waiting on Human → Waiting on External Party
     → Blocked → Escalated → Resolved → Closed
```

The distinction that matters most: "waiting on human" (the deal room's own
participant needs to act) is a different state from "waiting on external party"
(someone outside the deal room, e.g. a third-party servicer) — they need different
nudges and different SLAs.

## What's next (in order of leverage, not urgency)

These are deliberately *not* built yet. Each should be evaluated against this
document before implementation — if it doesn't fit the task/owner/evidence/
approval shape above, the plan is wrong, not the model.

1. **Time-driven tasks.** Tasks that re-evaluate themselves on a schedule, not
   only in response to an event — enabling "still missing after 3 days →
   follow-up → escalate" without a human or a new upload triggering it.
2. **Task dependencies / critical path.** Some tasks can't start, or complete,
   until another does (inspection before environmental review before loan
   committee before funding). Once dependencies are explicit, AI can reason about
   what's actually blocking the deal, not just what's outstanding.
3. **Priority.** Not primarily for humans — for AI, so that when multiple tasks
   are open, the system (and any daily summary) can reason about what matters
   most, not just what's newest.
4. **The morning summary.** Once time-driven evaluation, dependencies, and
   priority exist, the deal room's "Deal Health" score becomes a narrative:
   *"143 tasks exist. AI completed 51 overnight. Attorney approved 8. Only 2
   need you today. Estimated closing: Friday."* This is a reporting layer on top
   of the model above — it should require no new task primitives to build.

## The test for every future feature

Before adding a new capability to Kontra, ask:

- What task(s) does this create?
- Who owns each one — a role, or AI?
- What evidence would justify AI creating it?
- Does it need a draft action? If so, does it route through the single approval
  path, or does it try to add a second one?
- What lifecycle state does it start and end in?

If those five questions don't have clean answers, the feature isn't ready to
build inside this architecture yet — it needs more thought, not more code.
