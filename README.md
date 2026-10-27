# PramaanAI

PramaanAI is an AICTE Approval Process Handbook (APH) workflow and compliance
portal prototype. It brings institutional applications, APH scrutiny, statutory
evidence, inspections, deficiencies, service-level tracking, and audit history
into one role-oriented workspace.

The application includes seeded demonstration data and switchable user
personas. It is intended for demonstration and development, not as an official
AICTE service or a substitute for the current APH, legal advice, or an officer's
review.

## What it does

- **Role-oriented command centre** for institution administrators, regional
  officers, Expert Visit Committee (EVC) members, compliance heads, and bureau
  officers.
- **Application lifecycle management** for new-institute applications,
  Extension of Approval (EOA), and intake expansion.
- **APH rule scrutiny** that evaluates submitted institutional capacity and
  statutory documents against APH rules APH-101 through APH-107. Rule results
  are persisted with the application and used to prepare deficiency notices.
- **Filing declarations and scrutiny briefs** that record declared intake,
  faculty, built-up area, land, and statutory expiry dates. Briefs are composed
  deterministically from the evaluated rule matrix, with optional
  OpenAI-compatible model composition.
- **Evidence intake** for PDF documents, including text extraction,
  classification and field detection, SHA-256 integrity references, and
  version comparison.
- **Deficiency and escalation workflows** for notices, compliance deadlines,
  resubmissions, escalations, and decision tracking.
- **EVC inspection workflow** with committee conflict checks, geofence
  verification, site-report status, and recommendations.
- **Compliance and statutory-clock monitoring** with document expiry status,
  SLA indicators, and portfolio-level operational views.
- **Hash-linked audit ledger** for recording and checking workflow events.
- **Operational views** including the national wall, case journey, scrutiny
  simulator, search, and telemetry.

## Technology

- Next.js 15 with the App Router and React 19
- TypeScript
- Tailwind CSS
- Prisma ORM with SQLite
- `unpdf` for PDF text extraction
- Optional Gemini and OpenAI-compatible model APIs

## Requirements

- Node.js 18.18 or later (Node.js 20 LTS recommended)
- npm

## Run locally

1. Clone the repository and enter its directory.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the project root and configure the local SQLite
   database:

   ```dotenv
   DATABASE_URL="file:./dev.db"
   ```

   Prisma resolves this SQLite URL relative to `prisma/schema.prisma`, so the
   database will be created at `prisma/dev.db`.

4. Create the database, load the sample records, and seed sample evidence:

   ```bash
   npm run db:setup
   ```

5. Start the development server:

   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000).

The seeded experience includes sample institutions, applications, users, and
evidence. The interface provides a role switcher for exploring the different
workspaces; there is no production login flow in this prototype.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Prisma database connection. For local development, use `file:./dev.db`. |
| `AI_API_KEY` | No | API key for the optional OpenAI-compatible filing-brief model. `OPENAI_API_KEY` can be used instead. |
| `AI_BASE_URL` | No | OpenAI-compatible API base URL. Defaults to `https://api.openai.com/v1`. |
| `AI_MODEL` | No | Model name for filing-brief composition. Defaults to `gpt-4o-mini`. |
| `GEMINI_API_KEY` | No | Google Gemini API key for Gemini-powered document and scrutiny features. |

Keep credentials in your local `.env` file or deployment secret manager. Do
not commit API keys or other secrets. Without an OpenAI-compatible key, filing
briefs use the built-in deterministic, rule-grounded composer. AI-generated
content should be checked against the source documents and applicable
requirements.

## Available commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js development server. |
| `npm run build` | Create a production build. |
| `npm run start` | Start the production server after building. |
| `npm run db:push` | Synchronize the Prisma schema with the configured database. |
| `npm run db:seed` | Load the Prisma demonstration seed data. |
| `npm run db:evidence` | Seed sample evidence documents. |
| `npm run db:setup` | Push the schema, seed sample records, and seed evidence. |

## Main pages

| Path | Purpose |
| --- | --- |
| `/` | Role-oriented command centre and operational overview. |
| `/applications` | Application portfolio. |
| `/applications/new` | Start a new application. |
| `/applications/[id]` | Application and case workspace. |
| `/applications/[id]/notice` | Deficiency notice view for a case. |
| `/scrutiny` | Scrutiny workspace. |
| `/evc` | Expert Visit Committee inspection workspace. |
| `/compliance` | Institutional document compliance view. |
| `/escalations` | Escalated case tracking. |
| `/audit` | Audit ledger and integrity view. |
| `/journey` | Case journey view. |
| `/wall` | National operational wall. |
| `/simulator` | Workflow and scrutiny simulator. |

## API routes

- `POST /api/ai/copilot` — AI scrutiny copilot endpoint.
- `GET /api/search` — application search (accepts a `q` query parameter).
- `GET /api/notice/[ticketId]` — deficiency notice response.
- `GET /api/telemetry` — role-scoped application telemetry.

## Project layout

```text
app/          Next.js routes, pages, API handlers, and server actions
components/   Shared UI and workflow components
lib/          APH rules, evidence processing, AI integrations, audit, and data logic
prisma/       Prisma schema and demonstration seed data
scripts/      Evidence seeding and supporting development scripts
storage/      Local evidence-file storage created or populated at runtime
```

## Data and deployment notes

- The default development database is SQLite. The repository's local database
  file is ignored by Git; initialize your own database with `npm run db:setup`.
- Uploaded evidence is stored on the local filesystem under
  `storage/evidence`. A deployment must provide persistent storage and suitable
  backup, access-control, and retention policies for both the database and
  uploaded files.
- The role switcher and seeded personas are for exploring the prototype. Add
  real authentication, authorization, tenant isolation, and deployment
  hardening before using the application with real institutional or personal
  data.
- Sample database and evidence contents are demonstration data. Do not treat
  them as official records or upload sensitive documents to an unreviewed
  deployment.
