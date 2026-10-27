# PramaanAI

AICTE Approval Process Handbook (APH) workflow, scrutiny and compliance portal.

## Filing brief engine

Every filing evaluates the declared capacity and statutory dates against APH-101…107,
persists the rule matrix, and composes a scrutiny brief from that matrix.

The brief runs without any external service. To route composition through an
OpenAI-compatible model, add these to `.env` and restart:

```bash
AI_API_KEY=...            # or OPENAI_API_KEY
AI_BASE_URL=https://api.openai.com/v1   # optional
AI_MODEL=gpt-4o-mini      # optional
```

Model output is accepted only when every finding cites a flagged rule and every
flagged rule is covered; otherwise the deterministic grounded composer writes the
brief. The case workspace shows which engine produced the brief.
