# Tahaqqaq (تحقّق)

**A prototype for evidence-led green-loan screening and on-site verification for private institutions in Jordan.**
The intended approach: AI reads, rules decide, the bank approves.

Built for AI Quest 2026 (HTU, Amman). The packaged demo uses synthetic cases, prepared document evidence and scripted verification results. It demonstrates the proposed workflow; it does not perform live AI extraction, validate real equipment or transfer money.

- **Screening.** An institution submits the provided demo files. The bank explores prepared evidence, calculations, findings, a report and missing-evidence requests. The demo does not read or AI-screen arbitrary new uploads.
- **Verification.** An installer opens an approved project on a phone and steps through delivery and switch-on checks. Scripted outcomes demonstrate mismatches, retakes and replacements. Working workflow rules block simulated payment releases until the checks are complete, then make a demo certificate available.

## Quick start (no package installation)

Requires [Node.js](https://nodejs.org) 18 or newer. No PostgreSQL, Docker, pnpm installation, `.env` file or AI API key is needed to run the packaged demo.

On Windows, double-click `tahaqqaq-preview/start-preview.bat`. Alternatively, run this from the repository root:

```bash
node tahaqqaq-preview/server.mjs
```

The batch file switches to its own folder, checks that Node.js is available, opens `http://localhost:3000` and runs `node server.mjs`. It does not install dependencies, build the app or start the separate development backend. Keep the terminal open while using the demo; press Ctrl+C to stop the server.

- Bank and institution views: http://localhost:3000
- Installer phone: scan the project QR or open the **Installer phone link** printed in the terminal (`https://<laptop-ip>:3443/site`). Connect the phone and computer to the same Wi-Fi or hotspot. The phone camera needs HTTPS; accept the included self-signed certificate warning for this local demo. The included certificate and key are not for production deployment.
- If the phone cannot connect, check the QR address against the computer's active network IP and check that the firewall allows the Node.js server. `localhost` on a phone points to the phone, not the computer. The `SITE_HOST` environment variable can override automatic IP selection; `PORT` and `HTTPS_PORT` override the default server ports. The batch file always opens port 3000.

The preview server serves the prebuilt website in `tahaqqaq-preview/app/` and handles its local API requests using saved synthetic data and in-memory state. Use **Load demo files** for the screening walkthrough; the seeded approved hospital case provides an on-site verification walkthrough.

Changes made during a session are temporary and disappear when the server restarts. **Reset demo** removes demo submissions and resets verification, but does not clear every application or recorded request. Restart the server for a fresh session.

## Development

This is a separate way to run and edit the application. The commands below start the React development server and the Express backend in `apps/api/`; they are not required for the batch-file demo.

The development setup uses Node.js 22+, pnpm 10 and PostgreSQL 16. One way to start a local database is Docker:

```bash
docker run -d --name tahaqqaq-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=tahaqqaq -p 5432:5432 postgres:16
```

From the repository root:

```bash
pnpm install
cp .env.example .env     # Windows Command Prompt: copy .env.example .env
pnpm db:push             # create the database tables
pnpm dev:api             # API on http://localhost:8080
pnpm dev:web             # web app on http://localhost:5173 (second terminal)
```

Set `DATABASE_URL` in `.env` to match your database. The web development server forwards `/api` requests to the backend.

| Command | What it does |
|---|---|
| `pnpm typecheck` | Type-checks the workspace packages |
| `pnpm build` | Type-checks, then builds the API and web app |
| `pnpm test` | Runs the API tests; OCR tests may download Tesseract language data |
| `pnpm --filter @tahaqqaq/api-spec codegen` | Regenerates frontend API helpers and validation schemas from `openapi.yaml` |
| `pnpm demo:build` | Rebuilds the preview's web app and bundles its verification module from source |

The batch-file demo serves a saved build. Editing `apps/web/` does not automatically change that build: run `pnpm demo:build` after source changes to refresh it. This command does not regenerate all saved demo data or report PDFs.

The separate backend already contains the following implementation code. These components are **not running in the packaged preview**:

| Component | Existing development implementation |
|---|---|
| API server | Express 5 on Node.js, with pino logging and an esbuild bundle |
| Database | PostgreSQL through Drizzle ORM |
| Upload storage | Local disk, configured through `STORAGE_DIR` |
| Document reading | `pdfjs-dist` for PDF text; `@napi-rs/canvas` and `tesseract.js` for scanned pages in Arabic and English |
| AI extraction | Anthropic SDK calls with structured JSON output, concurrency limits and retries |
| Evidence and calculations | Validation of extracted values against cited text, plus shared TypeScript screening rules |

`ANTHROPIC_API_KEY` is optional for development and is needed only when attempting AI screening of non-demo uploads through this separate backend. Adding a key does not enable AI in `tahaqqaq-preview/server.mjs`: that server explicitly disables new-upload screening. Synthetic demo cases do not call the AI.

The extraction code currently contains a hard-coded model identifier in `apps/api/src/lib/project-screening.ts`. Before testing live extraction, check and configure a model supported by the chosen account and SDK. The presence of integration code is not proof of a validated live service or production readiness. On-site verification remains scripted in the development backend too.

## Project structure

```text
apps/
  web/                 Editable React source: bank, institution and installer screens
  api/                 Separate Express backend source, including OCR and AI integration
    data/phase2/       Synthetic scope, initial verification state and scripted outcomes
packages/
  api-spec/            OpenAPI description of our API and Orval generation config
  api-client/          Generated frontend request helpers and types
  api-zod/             Generated validation schemas for the development API
  db/                  PostgreSQL schema and Drizzle database connection
  screening/           Shared TypeScript rules, calculations and source register
tahaqqaq-preview/     Packaged demo used for presentations
  start-preview.bat     Windows launcher
  server.mjs           Local HTTP/HTTPS server and demo API
  verification.mjs     Bundled verification logic, synthetic fixtures and PDF support
  app/                 Prebuilt website, including prepared demo images
  data/                Saved synthetic case data, documents and report PDFs
  cert.pem, key.pem     Local-demo HTTPS certificate and key
```

## Tech stack: prototype

This table describes the packaged demo launched by `start-preview.bat` or `node tahaqqaq-preview/server.mjs`.

| Layer | What the demo actually uses |
|---|---|
| Web app | React 19, authored in TypeScript and built with Vite 7; the browser receives the prebuilt JavaScript and CSS |
| Interface | Tailwind CSS 4, Radix UI components, lucide-react icons and wouter navigation |
| Data requests | TanStack Query 5 and browser `fetch` communicate with the local preview API |
| Local server | Node.js built-in HTTP/HTTPS modules; the preview does not start Express |
| Data and state | Saved synthetic JSON plus temporary JavaScript objects and maps; no database connection |
| API tooling | OpenAPI 3.1 describes our API; Orval generates request helpers and schemas during development. OpenAPI is not OpenAI or an AI model, and code generation does not run at demo startup |
| Screening | Prepared evidence and results, plus TypeScript calculations using synthetic inputs; no live OCR or AI extraction |
| Uploads | The preview accepts upload requests but discards the file contents. It can keep submitted application metadata in memory; provided demo documents are served from disk |
| Installer page | Same React app at `/site`, with an Arabic-first interface, browser camera access, barcode detection where supported, manual demo controls, audio and vibration feedback where supported |
| QR codes | `qrcode` creates links to the local installer page; the phone connects to the same running preview server |
| Verification | A predefined sequence supplies scan/photo results. The scanned value does not determine the outcome; progress and payment gates run against those scripted results |
| Photos | The camera preview is live, but the capture flow displays a prepared demo image when available. Photos are not sent for OCR, vision analysis or OpenCV processing |
| Payments | Buttons update temporary workflow state; there is no bank or payment-provider integration |
| PDFs | Screening reports are saved PDFs; the verification certificate is generated using bundled `pdf-lib` code and marked as a synthetic demo |

## Tech stack: production (proposed)

The following describes future development, not deployed capabilities. Candidate technologies are starting points for evaluation, not confirmed provider or model selections. The existing development backend provides some foundations, but deployment requires further implementation, testing and bank review.

The intended approach is for AI to extract evidence, written rules to check it, and authorized bank staff to approve decisions and payment releases.

| Need | Proposed implementation | Difference from the packaged demo |
|---|---|---|
| Hosting | Bank-approved infrastructure with a domain and managed HTTPS certificates | Replaces the laptop server and included local certificate |
| Application | Develop and validate the existing React/TypeScript frontend and Node.js/Express backend | The preview currently runs its own small demo server |
| Database | PostgreSQL with access controls, migrations, backups and an audit history | Development database code exists; preview state is temporary |
| Evidence storage | Access-controlled object storage with encryption, retention policies and integrity checks | Preview uploads are discarded; development uploads use local disk |
| Background processing | A persistent job queue for OCR and extraction, with retries and job status | Needed for reliable processing beyond a demo session |
| Document reading | Evaluate the existing PDF/Tesseract pipeline on representative Arabic and English documents; compare alternatives where needed | The preview uses prepared document evidence |
| AI extraction | Validate the existing Anthropic integration with an available model, server-side credentials such as `ANTHROPIC_API_KEY`, structured output and evidence checks | No AI calls occur in the packaged demo; live quality, cost and failure handling still need evaluation |
| Rules | Review, test and version the existing TypeScript rules with the bank | Calculations exist, but synthetic cases do not establish suitability for real lending |
| On-site scanning | Decode actual labels and compare serial numbers and models against stored approved equipment; evaluate a cross-browser scanner such as ZXing and offline support | Current verification outcomes follow a fixed script |
| Screen and meter photos | Evaluate OpenCV.js for blur/quality checks and a vision model or OCR service for reading captured values | OpenCV and live photo analysis are not implemented in the demo |
| Evidence integrity | Capture and retain actual site evidence; assess timestamps, location checks and duplicate-image detection | Prepared demo images do not establish where or when equipment was installed |
| Already-financed equipment | Integrate an authorized equipment registry or bank-maintained serial-number records | The demo's duplicate-financing outcome is scripted; no registry is queried |
| Identity and access | Authentication and server-enforced permissions for bank staff, institutions and installers | Current roles are separate screens, not authenticated identities |
| Payments | Bank-approved integration with authorization, audit records and safeguards against duplicate releases | Current releases only change demo state; no money moves |
| Notifications | Add a selected SMS or messaging service if required | No production notification service is connected |
| Certificates | Tie certificates to durable verification records and evaluate bank-approved digital signing | Current PDFs are unsigned synthetic demonstration artifacts |
| Operations | Monitoring, structured logs, secret management, recovery procedures and security testing | A local demonstration does not provide production operations |

## Limitations of the prototype

- Included cases, evidence and site images are synthetic. The preview does not establish the authenticity or accuracy of real loan documents or equipment.
- Live OCR and AI screening of new uploads are disabled in the packaged demo. No Anthropic API key or OpenCV installation is needed to present it.
- Camera access and some barcode detection are functional, but verification results are scripted and independent of the captured scene or scanned serial number.
- Uploaded file contents are not retained by the preview. Session changes live in memory; restarting clears them, while **Reset demo** performs only a partial reset.
- Verification supports one active project at a time and a fixed demo project code.
- There is no sign-in or server-enforced role authorization. A project code is not a production authentication system.
- Payment releases are simulated, and certificates are demo PDFs rather than bank-signed records.
- The prototype demonstrates a workflow, not a validated lending system. Credit scoring, repayment assessment and final lending decisions remain outside this demonstration.
