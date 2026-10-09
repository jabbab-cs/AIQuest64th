# Tahaqqaq (تحقّق)

**Evidence-led green-loan screening and on-site verification for private institutions in Jordan.**
AI reads, rules decide, the bank approves.

Built for AI Quest 2026 (HTU, Amman). All data in this repository is synthetic.

- **Phase 1: screening.** A private institution (university, school, hospital, hotel, factory or company) submits its project files. Tahaqqaq sorts the documents, checks the numbers, and gives the bank a verdict, a report and a list of missing evidence.
- **Phase 2: verification.** Once the bank approves the scope, the installer checks delivery and switch-on on site with a phone. The bank releases the loan in two payments based on that proof and downloads a certificate.

## Run the demo (no install)

You only need [Node.js](https://nodejs.org) 18 or newer.

```bash
cd tahaqqaq-preview
node server.mjs
```

On Windows you can double-click `tahaqqaq-preview/start-preview.bat` instead.

- Laptop: open http://localhost:3000
- Installer phone: open the **Installer phone link** printed in the terminal, `https://<laptop-ip>:3443/site`. The phone must be on the same Wi-Fi or hotspot as the laptop. Accept the certificate warning once, because the camera needs https. The included certificate is a self-signed demo certificate for local use only.

The preview serves the built app and answers the API from saved synthetic data. Nothing is stored, and **Reset demo** in the bank sidebar puts everything back to the start.

## Showcase script

There are two separate cases in the bank inbox, one per phase.

### Phase 1: screening (case "Campus energy upgrade", Demo University)

1. Open **Institution portal** and press **Load demo files** (16 synthetic PDFs). Optionally choose an institution type.
2. Press **Submit application**.
3. Open **Bank workspace**, then open the new "Campus energy upgrade" case. The screening runs and ends on **Evidence requested**.
4. Show **Files** (16 documents sorted), **Overview** (verdict *Not ready for credit review yet*), **Data checks** (8 missing, 6 to confirm) and **Report** (memo and request-list PDFs).
5. Key numbers: requested JOD 553,000; candidate scope JOD 430,000 (solar 250k, LED 180k); savings JOD 373,632 a year; coverage 4.3× (3.0× at 70%).

The kept reference case with the same name (status Pending) shows the same verdict without submitting anything.

### Phase 2: verification (case "Solar and LED upgrade", Amman Private Hospital)

This case starts with every piece of evidence confirmed and the scope approved: JOD 430,000, with a loan of JOD 344,000.

1. In the bank inbox open **Solar and LED upgrade**. It opens on **Verification** with project code **TQ-4821**, a QR code, the approved scope, what was confirmed before approval, and two locked payments.
2. Optionally show the institution's view at **Verification** in the top bar, where **Send to installer** shares the code by WhatsApp or SMS.
3. On the phone, scan the QR or open the link, enter **TQ-4821** and tap **Open project**. The page opens in Arabic, and English is one tap away.
4. Delivery scans, in order (*Pallet 1 of 19 · pallets 2 to 19 already scanned*):
   1. Green: matched, SunPeak 580 W
   2. Green: matched
   3. Red: already financed (Al-Noor School, 2025)
   4. Amber: model swap, 550 W instead of 580 W
   5. Green: replacement for scan 3
   6. Green: replacement for scan 4
   7. Green: inverter serial matched. Delivery is complete.

   The laptop updates within 2 seconds of each scan.
5. On the laptop, press **Release payment 1** (JOD 206,400).
6. The phone moves on to switch-on photos, each showing "Reading…" for about 2 seconds:
   1. Amber: retake
   2. Green: inverter reads 182.4 kW and 1,286 kWh, and the serial matches
   3. Green: meter export started
7. Press **Release payment 2** (JOD 137,600). The status becomes **Paid**.
8. Press **Download certificate**. The phone now says the code has expired.
9. Press **Reset demo** to run it again.

**Demo kit:** printed barcode labels (any barcode works, because results are scripted in order), a printed inverter screen and meter, a phone, a laptop, a hotspot and a backup recording.

**Fallbacks:** if a label won't scan, long-press the progress counter on the phone to record the next scan. On iPhone, tap **Scan**, because Safari can't detect barcodes automatically.

## Prototype vs real

| In this prototype | In production |
|---|---|
| Scan and photo results are scripted (`artifacts/api-server/data/phase2/scan_script.json`) | Serials are matched against the supplier packing list and a registry of previously financed equipment; inverter and meter photos are read by OCR |
| Phase 2 state is kept in memory and reset from three JSON files | State is stored in a database with an audit trail |
| One project is in verification at a time, with a fixed code | Each approved project gets its own code |
| No sign-in | Bank, institution and installer roles with authentication |

## Full stack (Replit)

This is a pnpm monorepo:

- `artifacts/campus-finance`: React 19, Vite, Tailwind v4, shadcn/ui and wouter. Pages are in `src/pages`, the Phase 2 board is in `src/components/verification`, and the installer page is `src/pages/Site.tsx`.
- `artifacts/api-server`: Express 5, Drizzle and Postgres. Phase 2 is in `src/lib/verification.ts`, with routes under `/api/verification`, `/api/site` and `/api/applications/:id/approve-scope`.
- `lib/greenroute-research`: the screening calculations and source register.
- `lib/api-spec`: OpenAPI, with Orval codegen into `lib/api-zod` and `lib/api-client-react`.

```bash
pnpm install
# API: needs DATABASE_URL (Postgres); object storage is needed to upload real files
pnpm --filter @workspace/api-server run dev
# Web
pnpm --filter @workspace/campus-finance run dev
```

To rebuild the no-install preview after changing the frontend, build `artifacts/campus-finance` and copy its `dist/public` output into `tahaqqaq-preview/app`.

## Data and limits

- Every institution, document, amount and serial number is synthetic.
- Screening of real uploads uses an optional AI step and is switched off in the preview.
- This tool does not make lending decisions: it organises evidence for the bank's own credit review.
