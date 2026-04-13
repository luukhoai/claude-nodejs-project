# SWE Team — Multi-Agent Software Engineering Pipeline

A 5-agent pipeline: **analyzer → developer → tester → reviewer**, orchestrated by **swe-leader**.

## Quick Start

### First Time — Set Up the Team (once per machine)

**Step 1 — Create the team** (run this in Claude Code using the TeamCreate tool):

```
TeamCreate: team_name=YOUR_TEAM_NAME, description='Multi-agent SWE pipeline'
```

**Step 2 — Spawn all 5 agents** (run these as parallel Agent tool calls in the same session):

```
Agent: name=swe-leader,    team_name=YOUR_TEAM_NAME, subagent_type=general-purpose
Agent: name=swe-analyzer,  team_name=YOUR_TEAM_NAME, subagent_type=general-purpose
Agent: name=swe-developer,  team_name=YOUR_TEAM_NAME, subagent_type=general-purpose
Agent: name=swe-tester,    team_name=YOUR_TEAM_NAME, subagent_type=general-purpose
Agent: name=swe-reviewer, team_name=YOUR_TEAM_NAME, subagent_type=general-purpose
```

This brings all 5 agents online. They read their system prompts from `.claude/agents/*.md` and stay alive until you shut them down.

### Every Ticket — Submit a Request

Send a message to `swe-leader` with the feature request (via the SendMessage tool or tell your Claude Code session):

```
Message to swe-leader: add rate-limiting endpoint to the API
```

The pipeline runs autonomously from there. You'll get a final report from `swe-leader` when the reviewer approves.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                          USER                                     │
└──────────────────────────┬───────────────────────────────────────┘
                           │ request
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                      swe-leader (orchestrator)                   │
│  Creates 4-phase task chain with blockedBy dependencies          │
└──────────┬─────────────┬─────────────┬─────────────┬─────────────┘
           │             │             │             │
           ▼             ▼             ▼             ▼
    ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐
    │swe-analyzer│  │swe-develop│  │swe-tester │  │swe-reviewer│
    │  (opus)   │→ │ (sonnet)  │→ │ (sonnet)  │→ │  (opus)   │
    └───────────┘  └───────────┘  └───────────┘  └───────────┘
                           │
                      feedback loops:
                   tester→dev (fix failures)
                   reviewer→dev (fix changes)
```

## Agents

| Agent | Model | Responsibility |
|---|---|---|
| `swe-leader` | `sonnet` | Orchestrates pipeline, owns task chain, reports to user |
| `swe-analyzer` | `opus` | Explores codebase, writes analysis artifact |
| `swe-developer` | `sonnet` | Implements code from artifact or revision request |
| `swe-tester` | `sonnet` | Writes tests, runs suite, reports pass/fail |
| `swe-reviewer` | `opus` | Quality gates: correctness, security, design |

`opus` handles deep analysis and code review; `sonnet` handles implementation and testing.

## Files

| Path | Purpose |
|---|---|
| `.claude/agents/leader.md` | swe-leader system prompt |
| `.claude/agents/analyzer.md` | swe-analyzer system prompt |
| `.claude/agents/developer.md` | swe-developer system prompt |
| `.claude/agents/tester.md` | swe-tester system prompt |
| `.claude/agents/reviewer.md` | swe-reviewer system prompt |
| `.claude/teams/{YOUR_TEAM_NAME}/config.json` | Team member definitions |
| `CLAUDE.md` | Full developer guide (pipeline details, workflow, fix loops) |
| `README.md` | This file |

## Troubleshooting

| Issue | Fix |
|---|---|
| Agent waiting forever | Check the task list — it may be blocked by a dependency |
| Fix loop not exiting | swe-leader can intervene and escalate to the user |
| Agent producing bad output | Edit the agent's `.md` file and re-spawn it |
| Team not responding | Verify agents are alive by checking the task list (`TaskList` tool), then re-spawn any missing agents |
