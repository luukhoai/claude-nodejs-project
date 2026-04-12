# CLAUDE.md — SWE Team Developer Guide

## Overview

The **SWE Team** is a reusable multi-agent software engineering pipeline modeled on real-world DevOps workflows. It consists of 4 specialized agents plus an orchestrator (swe-leader) that work together to take a feature request from concept to shippable code.

## Agents

| Agent | Role | System Prompt |
|---|---|---|
| `swe-analyzer` | Understands requirements, explores codebase | `.claude/agents/analyzer.md` |
| `swe-developer` | Implements code from analysis | `.claude/agents/developer.md` |
| `swe-tester` | Writes and runs tests | `.claude/agents/tester.md` |
| `swe-reviewer` | Reviews quality, security, design | `.claude/agents/reviewer.md` |
| `swe-leader` | Orchestrates the pipeline | `.claude/agents/leader.md` |

## Workflow

```
User Request
    │
    ▼
swe-leader creates 4-phase task chain (analyze → implement → test → review)
    │
    ▼
swe-analyzer explores codebase → writes analysis artifact → messages swe-developer
    │
    ▼
swe-developer implements → produces implementation summary → messages swe-tester
    │
    ▼
swe-tester writes tests + runs suite
    ├─ FAIL → message swe-developer (fix loop)
    └─ PASS → message swe-reviewer
    │
    ▼
swe-reviewer quality gates
    ├─ CHANGES → message swe-developer (fix loop) → re-test → re-review
    └─ APPROVED → message swe-leader
    │
    ▼
swe-leader reports to user
```

## Artifacts

All pipeline artifacts are stored as a single markdown file per ticket in the project root:

```
artifacts/
├── ticket-123.md    # All stages for ticket #123
└── ticket-456.md    # All stages for ticket #456
```

Each artifact file contains sections for every pipeline stage:

```markdown
# Ticket #{N}: {title}

## Issue
<!-- swe-leader: GitHub issue content -->

---

## Analysis     (swe-analyzer, YYYY-MM-DD)
<!-- swe-analyzer fills this section -->

---

## Implementation  (swe-developer, YYYY-MM-DD)
<!-- swe-developer fills this section -->

---

## Tests       (swe-tester, YYYY-MM-DD)
<!-- swe-tester fills this section -->

---

## Review      (swe-reviewer, YYYY-MM-DD)
<!-- swe-reviewer fills this section -->

---
<!-- fix-loop iterations append a new divider + sections below -->
```

Fix-loop iterations append a new `---` divider and fresh timestamped sections below it, preserving full history within the same file.

## Running the Team

### First Time — Set Up (once per machine)

```bash
claude "/TeamCreate team_name=swe-team description='Multi-agent SWE pipeline'; then spawn swe-leader, swe-analyzer, swe-developer, swe-tester, swe-reviewer using Agent with team_name=swe-team and subagent_type=general-purpose"
```

Agents read their system prompts from `.claude/agents/*.md` and stay alive until shut down.

### Every Ticket — Submit a Request

```bash
claude "/msg swe-leader add a rate-limiting endpoint to the API"
```

`swe-leader` creates the 4-phase task chain and the pipeline runs autonomously. You receive a final report on approval.

## Agents Configuration

Each agent reads its full system prompt from its `.md` file in `.claude/agents/`. The team config at `.claude/teams/swe-team/config.json` lists all 5 members. The DRY pattern keeps agent definitions in one place (the `.md` files) and the team config just references them by name.

## Fix Loops

- **Test failure**: swe-tester → swe-developer → swe-tester (re-run)
- **Review changes**: swe-reviewer → swe-developer → swe-tester → swe-reviewer (re-review)

Both loops continue until the relevant gate passes. swe-leader is notified only on final approval.
**Note**: swe-leader marks swe-tester's task complete after the initial run. Fix-loop re-runs happen at the agent-communication level without task list changes — no new task IDs are created.

## Adding a New Agent

1. Create `.claude/agents/new-agent.md` with name, color, tools, and role description.
2. Add the agent as a member in `.claude/teams/swe-team/config.json`.
3. Spawn the agent with `Agent(team_name="swe-team", name="new-agent", ...)`.

## Troubleshooting

| Problem | Solution |
|---|---|
| Agent not responding | Check task list — it may be blocked waiting for a dependency |
| Infinite fix loop | swe-leader can intervene and escalate to user |
| Agent task stuck | swe-leader can reassign or cancel the task |