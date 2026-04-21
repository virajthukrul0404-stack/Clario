# Clario AI System — Orchestration Config

## Agent Registry

```json
{
  "agents": [
    {
      "id": "universal_supervisor",
      "name": "Universal Supervisor",
      "type": "orchestrator",
      "tier": "system",
      "file": "agents/universal_supervisor.md",
      "always_active": true,
      "can_override": ["all"],
      "receives_all_outputs": true
    },
    {
      "id": "product_manager",
      "name": "Product Manager",
      "type": "internal",
      "tier": "strategy",
      "file": "agents/product_manager.md",
      "triggers": ["feature_request", "sprint_review", "roadmap_query"],
      "reports_to": "universal_supervisor"
    },
    {
      "id": "aria",
      "name": "Aria",
      "type": "user_facing",
      "tier": "core",
      "file": "agents/core_agents.md#aria",
      "triggers": ["learner_message", "session_booked", "session_completed", "inactivity_14d"],
      "user_role": "learner",
      "reports_to": "universal_supervisor"
    },
    {
      "id": "cleo",
      "name": "Cleo",
      "type": "user_facing",
      "tier": "core",
      "file": "agents/core_agents.md#cleo",
      "triggers": ["teacher_message", "session_upcoming", "feedback_received", "earnings_cycle"],
      "user_role": "teacher",
      "reports_to": "universal_supervisor"
    },
    {
      "id": "session_conductor",
      "name": "Session Conductor",
      "type": "background",
      "tier": "core",
      "file": "agents/core_agents.md#conductor",
      "triggers": ["session_start", "session_5min_warning", "session_end", "explicit_invoke"],
      "reports_to": "universal_supervisor"
    },
    {
      "id": "trust_layer",
      "name": "Trust Layer",
      "type": "background",
      "tier": "infrastructure",
      "file": "agents/core_agents.md#trust",
      "triggers": ["profile_submitted", "session_completed", "report_submitted", "quality_flag"],
      "reports_to": "universal_supervisor"
    },
    {
      "id": "pairing_engine",
      "name": "Pairing Engine",
      "type": "background",
      "tier": "infrastructure",
      "file": "agents/core_agents.md#pairing",
      "triggers": ["search_query", "onboarding_goal_set", "goal_changed"],
      "reports_to": "universal_supervisor"
    },
    {
      "id": "onboarding_guide",
      "name": "Onboarding Guide",
      "type": "user_facing",
      "tier": "core",
      "file": "agents/core_agents.md#onboarding",
      "triggers": ["new_user_signup"],
      "active_window": "first_session_only",
      "reports_to": "universal_supervisor"
    },
    {
      "id": "retention_agent",
      "name": "Retention Agent",
      "type": "background",
      "tier": "layer",
      "file": "agents/core_agents.md#retention",
      "triggers": ["inactivity_14d", "action_items_outstanding_7d", "match_no_book", "teacher_slot_opened"],
      "reports_to": "universal_supervisor"
    },
    {
      "id": "insight_engine",
      "name": "Insight Engine",
      "type": "background",
      "tier": "layer",
      "file": "agents/core_agents.md#insight",
      "triggers": ["session_completed", "milestone_check_weekly", "dashboard_load"],
      "reports_to": "universal_supervisor"
    }
  ]
}
```

---

## Role Registry

```json
{
  "roles": [
    {
      "id": "fullstack_developer",
      "name": "Full Stack Developer",
      "type": "internal_role",
      "file": "roles/fullstack_developer.md",
      "invoked_by": ["engineering_team", "universal_supervisor"],
      "triggers": ["code_review_request", "architecture_review", "feature_build", "performance_issue"]
    },
    {
      "id": "ux_ui_designer",
      "name": "UX/UI Designer",
      "type": "internal_role",
      "file": "roles/ux_ui_designer.md",
      "invoked_by": ["product_manager", "engineering_team", "universal_supervisor"],
      "triggers": ["design_review", "component_spec", "new_feature_design", "ux_audit"]
    },
    {
      "id": "code_tester",
      "name": "Code Tester",
      "type": "internal_role",
      "file": "roles/code_tester.md",
      "invoked_by": ["fullstack_developer", "universal_supervisor"],
      "triggers": ["pre_deploy", "test_coverage_review", "bug_report", "regression_check"]
    },
    {
      "id": "security_tester",
      "name": "Security Tester",
      "type": "internal_role",
      "file": "roles/security_tester.md",
      "invoked_by": ["universal_supervisor", "trust_layer"],
      "triggers": ["pre_deploy", "security_flag", "new_auth_feature", "payment_feature", "penetration_test"]
    }
  ]
}
```

---

## Event-to-Agent Pipeline Map

```
USER EVENT                    →  SKILL FIRED              →  AGENT INVOKED
─────────────────────────────────────────────────────────────────────────────
New user signup               →  goal_refiner             →  onboarding_guide
                              →  pairing_engine           →  aria (post-onboard)

Learner sends message         →  intent_parser            →  aria
                              →  [route by intent]

Learner searches              →  search_intelligence      →  pairing_engine
                              →  match_explainer          →  [results display]

Session booked                →  session_classifier       →  universal_supervisor
                              →  schedule_optimizer       →  aria (learner confirm)
                                                          →  cleo (teacher brief)

24h before session            →  session_prep             →  aria → learner
                                                          →  cleo → teacher

Session starts                →                           →  session_conductor (silent)

Session active (/conductor)   →                           →  session_conductor (on-demand)

5 min warning                 →                           →  session_conductor (auto)

Session ends                  →  post_session_synthesis   →  aria → learner
                              →  quality_reviewer         →  cleo → teacher
                              →  resource_curator         →  insight_engine
                                                          →  trust_layer

Feedback submitted            →  feedback_distiller       →  cleo (teacher digest)
                                                          →  trust_layer

14 days no booking            →                           →  retention_agent
                                                          →  aria (nudge)

Teacher submits profile       →  bio_generator            →  trust_layer (review)
                              →  profile_coach            →  cleo (coaching)

Any notification event        →  notification_composer    →  [channel dispatch]

Report submitted              →                           →  trust_layer
                                                          →  universal_supervisor (if high/critical)

Pre-deploy                    →                           →  code_tester
                                                          →  security_tester
                              →                           →  universal_supervisor (gate)

Feature request               →                           →  product_manager
                              →                           →  universal_supervisor (approve/defer)
```

---

## Quality Gate Rules (Universal Supervisor)

```json
{
  "quality_gate": {
    "always_gate": ["aria", "cleo", "retention_agent", "onboarding_guide"],
    "sample_gate": {
      "agents": ["session_conductor", "insight_engine"],
      "sample_rate": 0.1
    },
    "skip_gate": ["trust_layer", "pairing_engine"],
    "block_conditions": [
      "output contains urgency language (hurry, limited time, last chance)",
      "output contains hollow affirmations (Great!, Amazing!, Absolutely!)",
      "output length > 500 words for conversational context",
      "output references another user's private data",
      "output contains broken {{variable}} template (unfilled)"
    ]
  }
}
```

---

## Environment Variables Required

```env
# Anthropic
ANTHROPIC_API_KEY=

# Database
DATABASE_URL=
REDIS_URL=

# Auth
NEXTAUTH_SECRET=
NEXTAUTH_URL=

# Payments
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# Storage
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=
AWS_REGION=

# WebRTC
TURN_SERVER_URL=
TURN_SERVER_USERNAME=
TURN_SERVER_CREDENTIAL=

# Monitoring
SENTRY_DSN=
POSTHOG_API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Internal
INTERNAL_API_SECRET=
SUPERVISOR_WEBHOOK_URL=
```
