# SWE Team — Multi-Agent Software Engineering Pipeline

A 5-agent pipeline: **analyzer → developer → tester → reviewer**, orchestrated by **swe-leader**.

## Quick Start

### First Time — Set Up the Team (once per machine)

```bash
claude "/TeamCreate team_name=swe-team description='Multi-agent SWE pipeline'; then spawn swe-leader, swe-analyzer, swe-developer, swe-tester, swe-reviewer using Agent with team_name=swe-team and subagent_type=general-purpose"
```

This creates the team and brings all 5 agents online. They read their system prompts from `.claude/agents/*.md` and stay alive until you shut them down.

### Every Ticket — Submit a Request

```bash
claude "/msg swe-leader add rate-limiting endpoint to the API"
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
| `.claude/teams/swe-team/config.json` | Team member definitions |
| `CLAUDE.md` | Full developer guide (pipeline details, workflow, fix loops) |
| `README.md` | This file |

## Troubleshooting

| Issue | Fix |
|---|---|
| Agent waiting forever | Check the task list — it may be blocked by a dependency |
| Fix loop not exiting | swe-leader can intervene and escalate to the user |
| Agent producing bad output | Edit the agent's `.md` file and re-spawn it |
| Team not responding | Verify the team is active with `TeamList` or check the task list |
