# Safety Policy

Duoland is an SEL and mental-health-education platform. It teaches structured
skills and help-seeking behavior. It does not provide diagnosis, therapy,
medical advice, crisis intervention, or child risk scoring.

## Child-Facing Rules

1. Do not show unreviewed LLM output to children.
2. Do not ask for free-text child disclosures unless a future reviewed policy
   explicitly enables a constrained mode.
3. Do not ask for real names, addresses, phone numbers, school names, family
   income, or sensitive family details.
4. Do not label a child as anxious, depressed, abnormal, risky, unsafe, or
   disordered.
5. Do not tell children to hide serious problems from trusted adults.
6. Do not make a child responsible for solving abuse, violence, bullying, or
   other adult-level safety issues.

## Content Rules

1. Feedback should acknowledge emotions before guiding behavior.
2. Help-seeking guidance should point to trusted adults and existing school or
   guardian safety processes.
3. Sensitive scenarios require teacher risk notes and extra review.
4. Guardian and teacher guidance must match the child-facing activity intent.
5. Activities should collect structured choices and learning signals, not
   psychological profiles.

## Runtime Rules

1. Public routes only load publishable content.
2. Preview routes are for development and review. They are not proof of safety.
3. Renderers must not infer mental health status from interaction events.
4. Persistence should store progress and structured activity state, not private
   child narratives.

## Future Required Checks

These checks are not all implemented yet, but the architecture must allow them:

- Block child-facing direct LLM output.
- Block free-text child input by default.
- Require safety reviewer approval for sensitive content.
- Require review coverage for world narrative and assets.
- Evaluate validators against gold safety cases.
