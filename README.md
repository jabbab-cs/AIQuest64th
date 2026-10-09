# Tahaqqaq (تحقّق)

**Evidence-led green-loan screening and on-site verification for private institutions in Jordan.**
AI reads, rules decide, the bank approves.

Built for AI Quest 2026 (HTU, Amman). This is a prototype, and all data in it is synthetic.

- **Screening.** A private institution (university, school, hospital, hotel, factory or company) submits its project files. Tahaqqaq sorts the documents, checks the numbers against the sources and the bank's rules, and gives the bank a verdict, a report and a list of missing evidence.
- **Verification.** Once the bank approves the scope, the installer checks delivery and switch-on on site with a phone. Each scan or photo is checked against the approved scope, open issues block payment, and the bank releases the loan in two payments and issues a certificate.

## Quick start (no install)

Requires [Node.js](https://nodejs.org) 18 or newer.

```bash
node tahaqqaq-preview/server.mjs
```

On Windows you can double-click `tahaqqaq-preview/start-preview.bat` instead.

- Bank and institution views: http://localhost:3000
- Installer phone: the **Installer phone link** printed in the terminal (`https://<laptop-ip>:3443/site`), on the same Wi-Fi or hotspot. The camera needs https, so accept the self-signed certificate warning once. The certificate is for local use only.

The demo serves a prebuilt copy of the web app and answers the API from saved synthetic data. Nothing is stored, and **Reset demo** in the bank sidebar restores the starting state.

## Development

Requires Node.js 22+, pnpm 10 and PostgreSQL 16. For Postgres, Docker is the quickest route:

```bash
docker run -d --name tahaqqaq-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=tahaqqaq -p 5432:5432 postgres:16
```

```bash
pnpm install
cp .env.example .env     # Windows: copy .env.example .env
pnpm db:push             # create the tables
pnpm dev:api             # API on http://localhost:8080
pnpm dev:web             # web app on http://localhost:5173 (second terminal)
```

| Command | What it does |
|---|---|
| `pnpm typecheck` | Type-checks every package |
| `pnpm build` | Type-checks, then builds the API and the web app |
| `pnpm test` | Runs the API tests (the OCR test downloads Tesseract language data on first run) |
| `pnpm --filter @tahaqqaq/api-spec codegen` | Regenerates the API client and schemas from `openapi.yaml` |
| `pnpm demo:build` | Rebuilds the no-install demo in `tahaqqaq-preview/` from the current code |

`ANTHROPIC_API_KEY` in `.env` is optional. It is only needed to screen new, real uploads. The two demo cases never call the AI.

## Project structure

```
apps/
  web/            React web app: bank workspace, institution portal, installer page (/site)
  api/            Express API: applications, screening pipeline, verification, PDFs
packages/
  api-spec/       OpenAPI contract (openapi.yaml) and Orval config
  api-client/     Generated React Query hooks used by the web app
  api-zod/        Generated Zod schemas used by the API to validate responses
  db/             Drizzle schema and database client (PostgreSQL)
  screening/      Screening rules, calculations and source register (pure TypeScript)
tahaqqaq-preview/ Zero-dependency demo server, prebuilt app and synthetic data
```

## Tech stack: prototype

| Layer | Technology |
|---|---|
| Web app | React 19, Vite 7, Tailwind CSS 4, Radix UI primitives (shadcn/ui pattern), wouter, TanStack Query 5, lucide-react, `qrcode` |
| Installer page | Same app at `/site`: browser camera (`getUserMedia`), the built-in `BarcodeDetector` where available (Android Chrome) with a Scan button elsewhere, Web Audio and vibration feedback, Arabic first (IBM Plex Sans Arabic) |
| API | Node.js 22, Express 5, pino, bundled with esbuild |
| API contract | OpenAPI 3, with Orval generating the React Query client and Zod schemas |
| Database | PostgreSQL 16 with Drizzle ORM |
| File storage | Local disk (`STORAGE_DIR`), PDF uploads up to 15 MB |
| Document reading | `pdfjs-dist` for text layers; scanned pages rendered with `@napi-rs/canvas` and read by `tesseract.js` (Arabic and English) |
| AI extraction | Claude through `@anthropic-ai/sdk`, with JSON-schema structured output, `p-limit` and `p-retry` |
| Rules | Plain TypeScript in `packages/screening` |
| Verification | In-memory state seeded from `apps/api/data/phase2/*.json`; scan and photo results are scripted; certificates made with `pdf-lib` |

## Tech stack: production (recommended)

The principle stays the same: the AI only extracts and flags, written rules decide pass or fail, and money moves only on a bank officer's approval.

| Need | Choice | Why |
|---|---|---|
| Hosting | The bank's own data centre, or a cloud region the bank is permitted to use, assessed against the Central Bank of Jordan's cloud computing instructions and the Personal Data Protection Law (No. 24 of 2023) | Loan files contain personal and financial data; where they are stored is a regulatory decision |
| Application | Keep this TypeScript monorepo: React web app, Node.js API, OpenAPI contract | The code is already split by responsibility, so moving to production doesn't need a rewrite |
| Database | Managed PostgreSQL, with row-level security per bank and an append-only audit log of every upload, extraction, rule result, scan, photo and payment release | One reliable relational store; the audit log backs the certificate |
| Evidence storage | S3-compatible object storage with object lock (write once), encryption at rest and a retention policy | Uploaded files and site photos can't be altered afterwards |
| Background jobs | A job queue (BullMQ on Redis, or the cloud provider's queue) | OCR and AI runs take time and must not block requests |
| Document OCR | Text layer first; for scans, a managed document AI service with Arabic support (Azure AI Document Intelligence or Google Document AI), or PaddleOCR/Tesseract where data must stay on premises. The final choice comes from testing on real Jordanian bills and quotes | Jordanian documents mix Arabic and English, tables and stamps |
| AI extraction | Claude via the Anthropic API, or via Amazon Bedrock, Google Vertex AI or Microsoft Foundry to match the bank's cloud. Claude Haiku 5.5 to classify documents, Claude Sonnet 5.5 to extract fields as structured JSON, and Claude Opus 5.5 for difficult documents and the screening memo. Prompt caching for the fixed rule text | Every extracted value carries its page reference and is checked by the rules engine before it reaches a reviewer |
| Rules engine | The existing TypeScript rules, versioned, each linked to its source (taxonomy, bank policy, tariff) | Deterministic and auditable; a rule change goes through code review |
| On-site scanning | Installer web app (PWA) with offline queueing; ZXing (`zxing-wasm`) for barcodes on both Android and iPhone | No app-store install for installers, and it works with weak signal on rooftops and in plant rooms |
| Screen and meter photos | A sharpness check on the phone (OpenCV.js) that asks for an immediate retake, then Claude vision reading the values into fields, compared by the rules with the approved scope | A bad photo is caught while the installer is still at the screen |
| Photo integrity | In-app capture only, GPS and time checked against the site, perceptual hashing to catch reused photos, and device attestation (Play Integrity, App Attest) | Prevents old or off-site photos being submitted |
| Already-financed equipment | Serial numbers checked against a registry of financed equipment, ideally shared across banks through the Central Bank or the credit bureau (CRIF Jordan); until then, the bank's own registry plus supplier packing lists | Double financing is the main risk at delivery |
| Identity and access | Bank staff through the bank's single sign-on (OpenID Connect); institutions through an identity provider such as Keycloak with two-factor sign-in; installers with a per-project code plus an SMS one-time code | Each role sees only what it needs; installers never see amounts |
| Notifications | SMS through a local provider and the WhatsApp Business Platform for sending project codes | Matches how installers and facility managers communicate |
| Certificates | PDF digitally signed with the bank's certificate (PAdES), with a QR code that opens the verification record | Anyone holding the certificate can check it is genuine |
| Operations | OpenTelemetry tracing and the existing structured logs, with alerts on failed jobs and unusual release patterns | |

## Limitations of the prototype

- Verification results are scripted, and the site photos are synthetic images.
- Verification state is kept in memory, one project at a time, with a fixed project code.
- There is no sign-in; roles are separate pages.
- The tool does not make lending decisions. Credit scoring and repayment capacity stay with the bank's own process.
