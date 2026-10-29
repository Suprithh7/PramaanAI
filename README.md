# PRAMAAN — AICTE approvals, start to finish

**Smart India Hackathon prototype.** PRAMAAN turns the AICTE college-approval
process from a paper chase into one transparent, auditable workflow: a college
files once, every rule is checked in seconds, documents are fingerprinted,
inspectors must be physically on campus, and every action is sealed into a
tamper-evident ledger.

No AI service, API key or third-party data service is used. Every number,
verdict and flag comes from fixed rules running on seeded data — the same input
always produces the same output, which is exactly what a regulator needs.

---

## The problem

AICTE receives thousands of approval applications every year — new institutes,
Extension of Approval, intake expansion. Each one is checked by hand against the
Approval Process Handbook (APH): faculty ratios, built-up area, land tenure, fire
safety, building plans.

Three things go wrong:

1. **Colleges wait months** and cannot see where their file is or what is
   holding it up.
2. **Officers check the same rulebook by eye** across thousands of pages, so
   mistakes and delays follow.
3. **Fake or reused documents get through** — an edited scan or a certificate
   copied from another college still looks valid on paper.

## The solution

| Claim | How PRAMAAN proves it | See it at |
| --- | --- | --- |
| Rule checks in seconds | APH-101…107 evaluated with the exact rule, declared figure and shortfall | `/scrutiny`, `/applications/[id]` |
| Colleges can pre-check before filing | Interactive simulator — move the numbers, watch rules flip red/green | `/pre-check` |
| Documents can be trusted | Every PDF is fingerprinted; text is read locally; the same file under two colleges is flagged | `/documents` |
| Inspections really happened | 750 m geofence, conflict-of-interest screening, location-stamped reports | `/inspections` |
| Deadlines escalate themselves | SLA clock, automatic escalations, penalty points | `/applications` |
| Nothing can be rewritten | Sealed ledger: each entry protects the one before it, and the database refuses edits/deletes | `/audit` |

## Five-minute demo script

Run the app, open it on a projector, and follow the cards on the dashboard.
Everything below is clickable in the prototype.

1. **A rule catches a real shortfall** — Applications → *Bengal Institute of
   Engineering & Management* (`ER/0061`) → Rule check. Five of seven APH rules
   fail with the exact declared value and the shortfall.
2. **A copied certificate is caught** — Documents → *“Same file, two colleges”*.
   The lease deed uploaded by DTI is an exact copy of the one uploaded by JITS.
3. **An off-campus inspection is refused** — Inspections → switch
   *Demo view as → Inspector* → replace the latitude with `12.9000` and submit.
   The report is rejected with the measured distance (`7,962 m`, limit `750 m`).
4. **The audit trail detects tampering** — Audit trail → *Break the record, then
   repair it* → **Alter the newest entry**. The page reloads with a red banner
   naming the exact entry that changed, even though the edit bypassed the
   application. **Repair the record** puts it back.
5. **A college fixes its numbers first** — Pre-check → move the sliders from the
   failing preset to the passing one; seven red rules turn green before filing.

### Role walkthrough

Use **Demo view as** in the top bar. Each role sees the same data through its
own lens, and the switch itself is written to the audit log.

- **College** — files applications, uploads supporting documents, answers
  deficiency notices, renews statutory documents.
- **AICTE Officer** — works the scrutiny desk, runs the APH rule check, issues
  formal deficiency notices, schedules inspections for conflict-free committees.
- **Inspector** — sees only assigned visits; must be inside the campus geofence
  to file a report.
- **Monitoring Head** — watches SLA breaches and escalations across all regions.
- **Approvals Bureau** — records the final decision and issues the approval
  order.

## What is live and working

- 6 institutions, 8 applications, 24 statutory compliance documents, 7
  uploaded PDFs, 3 inspection committees and 44 sealed ledger entries.
- Full case lifecycle: submission → scrutiny → deficiency → re-scrutiny →
  inspection → SAC/Bureau decision → printable order.
- Deficiency notices rendered as a real government-style document and
  downloadable as HTML (`/api/notice/[ticketId]`).
- Every state change appends a sealed audit entry; the database refuses
  `UPDATE` and `DELETE` on the ledger.
- The prototype reseeds deterministically, so a demo can always be reset:
  `npm run db:setup`.

## Technology

- Next.js 15 (App Router), React 19, TypeScript
- Tailwind CSS
- Prisma ORM + SQLite
- `unpdf` reads text from uploaded PDFs; file fingerprints power duplicate and
  tamper detection
- No AI service, API key or third-party data service

## Run locally

Requirements: Node.js 18.18+ (20 LTS recommended) and npm.

```bash
npm install
```

Create `.env` in the project root:

```dotenv
DATABASE_URL="file:./dev.db"
```

Build the database, seed the demo records and evidence, then start:

```bash
npm run db:setup
npm run dev
```

Open <http://localhost:3000>. There is no login — use **Demo view as** to move
between roles.

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run db:push` | Sync the Prisma schema |
| `npm run db:seed` | Load the demonstration records |
| `npm run db:evidence` | Seed the fingerprinted evidence PDFs |
| `npm run db:setup` | All three of the above, in order |

## Pages

| Path | Purpose |
| --- | --- |
| `/` | Pitch, problem statement and the five-click demo route |
| `/applications` | National application queue with deadlines and SLA state |
| `/applications/new` | Guided filing form with live rule feedback |
| `/applications/[id]` | Case workspace: rules, documents, inspection, history |
| `/applications/[id]/notice` | Printable deficiency notice |
| `/pre-check` | Pre-filing rule simulator |
| `/scrutiny` | Officer review desk |
| `/inspections` | Committee scheduling, conflict checks, geofenced reports |
| `/documents` | Document register, expiry watch and cross-college reuse |
| `/audit` | Sealed ledger, integrity check and one-click tamper demo |
| `/api/notice/[ticketId]` | Downloadable HTML deficiency notice |

## Project layout

```text
app/          Routes, server actions and API handlers
components/   UI and workflow components
lib/          APH rules, evidence, geofence, audit and data access
prisma/       Schema and deterministic demo seed
scripts/      Evidence seeding
storage/      Seeded evidence files
```

## Prototype notes

- Seeded data is fictional demonstration material, not official AICTE records.
- The role switcher is a demo affordance. A production deployment needs real
  authentication, tenant isolation and storage/retention controls.
- Re-run `npm run db:setup` to restore the exact demo state after experimenting.
