# Clario AI Agentic System
### Production-Level Prompt Architecture — Complete Documentation

---

## What This Is

This is the complete AI agentic system for **Clario** — a premium peer-to-peer live learning platform. Every file in this package is a production-ready prompt, role specification, or orchestration config that powers the intelligence layer of the product.

**No code required to use these prompts.** Drop them into any LLM orchestration framework (LangChain, Vercel AI SDK, Anthropic API directly, custom middleware) and they work immediately.

---

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                  UNIVERSAL SUPERVISOR                    │
│         Orchestrates · Gates · Monitors · Escalates      │
└──────────────────────┬──────────────────────────────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
   ┌─────▼──────┐ ┌───▼────┐ ┌──────▼──────┐
   │  PRODUCT   │ │  CORE  │ │  INTERNAL   │
   │  MANAGER   │ │ AGENTS │ │    ROLES    │
   └────────────┘ └───┬────┘ └──────┬──────┘
                      │             │
              ┌───────┼───────┐     ├── Full Stack Dev
              │       │       │     ├── UX/UI Designer
           Aria    Cleo  Conductor  ├── Code Tester
           Onboard Retain Insight   └── Security Tester
           Trust   Pairing
```

---

## File Structure

```
clario-ai-system/
│
├── README.md                          ← You are here
│
├── agents/
│   ├── core_agents.md                 ← All 8 core agents (Aria, Cleo, Conductor, Trust,
│   │                                     Pairing, Onboarding, Retention, Insight)
│   ├── universal_supervisor.md        ← Master orchestration intelligence
│   └── product_manager.md             ← Product strategy and roadmap agent
│
├── roles/
│   ├── fullstack_developer.md         ← Full stack dev role (Next.js, Node, DB, WebRTC)
│   ├── ux_ui_designer.md              ← Design system, component specs, UX review
│   ├── code_tester.md                 ← Test generation, coverage review, bug reports
│   └── security_tester.md             ← Security audits, pen tests, vulnerability classification
│
├── skills/
│   └── all_skills.md                  ← All 15 skill prompts with {{variable}} templates
│
├── config/
│   └── orchestration.md               ← Agent registry, pipeline map, quality gate rules
│
└── docs/
    └── prompt_usage_guide.md          ← How to use and integrate these prompts
```

---

## Agents (10 total)

| Agent | Role | Tier | User-Facing |
|-------|------|------|-------------|
| Universal Supervisor | Orchestrates all agents, quality gates, escalations | System | No |
| Product Manager | Feature decisions, roadmap, sprint reviews | Strategy | No |
| Aria | Learner companion, booking, progress | Core | Yes (learners) |
| Cleo | Teacher studio, admin, feedback | Core | Yes (teachers) |
| Session Conductor | Live session monitor, handoff generation | Core | Silent |
| Trust Layer | Safety, quality, report triage | Infrastructure | No |
| Pairing Engine | Teacher-learner matching | Infrastructure | No |
| Onboarding Guide | First-session activation | Core | Yes (new users) |
| Retention Agent | Re-engagement nudges | Layer | Indirect |
| Insight Engine | Progress narrative, milestones | Layer | Dashboard only |

---

## Roles (4 total)

| Role | Scope | Invoked By |
|------|-------|-----------|
| Full Stack Developer | Code generation, architecture review, performance | Engineering + Supervisor |
| UX/UI Designer | Component specs, design review, interaction guidelines | PM + Engineering + Supervisor |
| Code Tester | Test generation, coverage review, bug reports | Engineering + Supervisor |
| Security Tester | Security audits, pen tests, vulnerability classification | Supervisor + Trust Layer |

---

## Skills (15 total)

| Skill | Trigger | Output |
|-------|---------|--------|
| Intent Parser | Every user message | Structured intent JSON |
| Session Prep Brief | 24h before session | Learner prep text |
| Post-Session Synthesis | Session end | Summary + action items |
| Bio Generator | Teacher profile setup | Profile bio text |
| Feedback Distiller | After 3+ sessions | Insight digest JSON |
| Resource Curator | Post-session | 2 resource suggestions |
| Goal Refiner | Goal input | Structured goal object |
| Schedule Optimizer | Booking request | Ranked time slots |
| Match Explainer | Search results | Per-teacher explanation |
| Cancellation Handler | Cancellation event | Messages + action JSON |
| Search Intelligence | Discovery search | Structured query object |
| Profile Coach | Profile edit mode | Improvement suggestions |
| Session Classifier | Booking intent | Session config JSON |
| Notification Composer | Any notify event | Channel-ready notification |
| Quality Reviewer | Post-session cycle | Quality score + flags |

---

## Quick Start

### Using a single agent prompt
```javascript
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Load Aria's system prompt
const ariaPrompt = readFileSync('./agents/core_agents.md', 'utf8');
// Extract Aria section (or store each agent as individual file)

const response = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  system: ariaSystemPrompt,
  messages: [
    { role: 'user', content: userMessage }
  ]
});
```

### Using a skill (template injection)
```javascript
function injectTemplate(template, variables) {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const keys = key.trim().split('.');
    let value = variables;
    for (const k of keys) {
      value = value?.[k];
    }
    return value ?? match;
  });
}

const skillTemplate = readFileSync('./skills/session_prep.txt', 'utf8');
const prompt = injectTemplate(skillTemplate, {
  session: { teacherName: 'Maya', topic: 'Pricing Strategy', ... },
  learner: { goal: 'Understand SaaS pricing models', ... }
});
```

### Recommended model
All prompts are designed for **claude-sonnet-4-6** (`claude-sonnet-4-6`).
For background/batch tasks (Insight Engine, Feedback Distiller): claude-haiku-4-5 is sufficient.
For Universal Supervisor and Security Tester: use claude-opus-4-6 for highest reasoning quality.

---

## Design Principles Behind Every Prompt

1. **Agents serve outcomes, not features.** Every agent has a single clear purpose.
2. **Tone is a feature.** Every prompt specifies tone boundaries explicitly — including what never to say.
3. **Structure enables reliability.** JSON output formats are specified precisely so downstream systems can parse without fragility.
4. **Context is always explicit.** Every prompt lists exactly what context it expects — no ambiguity.
5. **Quality gates are built in.** The Universal Supervisor checks every user-facing output before it ships.
6. **The session room is protected.** No agent is allowed to interrupt or add noise to a live session without explicit invocation.

---

## Clario Product Vision (North Star for all AI decisions)

> *Clario is where curious people and knowledgeable people find each other — and actually connect.*

Every AI output should be able to justify itself against this vision. If a response adds noise, manufactures urgency, or makes the platform feel like a marketplace — it's wrong, regardless of technical correctness.

---

## Contact / Ownership

This system was designed for **Clario** — a premium peer-to-peer live learning platform. All prompts are proprietary to the Clario product team.
