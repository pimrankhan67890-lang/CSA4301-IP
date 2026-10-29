# CyberCase — Smart Digital Fraud Evidence & Response Platform

A polished full-stack Internet Programming prototype for organizing digital incident evidence into a timeline, structured findings and a neutral report. It includes an animated splash screen, animated canvas background, responsive workspace, evidence intake, Gemini-powered analysis, a local-only case vault and report export.

## Two project modules

1. **Digital Evidence Analysis & Timeline Builder** — analyzes user-provided PDFs, screenshots, messages, email text and receipts; extracts visible details; builds a draft chronological timeline; lists entities, cautions and missing information; and computes SHA-256 fingerprints for uploaded files.
2. **Intelligent Case Preparation & Reporting Assistant** — prepares a neutral case summary, suggests what should be verified, generates an evidence index/report, supports Markdown download and browser Print / Save PDF, and links to India's official cybercrime portal.

> CyberCase is an evidence-organization aid, not a forensic certification, legal-advice service, accusation engine or determination of guilt. SHA-256 helps detect whether a file copy changes; it does not prove that the original content was genuine.

## Requirements

- Node.js 20 or newer
- npm
- A Gemini API key for live AI analysis (create one at [Google AI Studio](https://aistudio.google.com/apikey))

The current configuration uses Google's `@google/genai` JavaScript SDK and the Gemini **Interactions API**, with `gemini-3.8-flash` as the default model. The API key stays on the server in `.env` and is never sent to the browser.

## Run locally (Windows or macOS/Linux)

1. Extract this folder.
2. Open a terminal in the `cybercase-ai` folder.
3. Install packages:

   ```bash
   npm install
   ```

4. Copy `.env.example` to `.env`.

   **Windows PowerShell:**

   ```powershell
   Copy-Item .env.example .env
   notepad .env
   ```

   **macOS/Linux:**

   ```bash
   cp .env.example .env
   nano .env
   ```

5. Replace `replace_with_your_gemini_api_key` with your own key. Keep `.env` private. Do not paste the key into front-end JavaScript or commit it to GitHub.
6. Start the web app:

   ```bash
   npm start
   ```

7. Open [http://localhost:3000](http://localhost:3000).

If you have not configured the key, the website still launches and includes a clearly labelled fictional sample case. Live analysis and AI-written reports require a valid key, access to the configured model, and available API quota.

## What works

- Cinematic CyberCase intro with a loading sequence and skip control
- Animated background canvas, radar artwork and subtle motion effects
- Responsive desktop/tablet/mobile layout
- Drag-and-drop or file-picker uploads: PDF, PNG, JPG/JPEG, WEBP, TXT, MD, EML and CSV
- Up to 5 files per analysis; 12 MB per file and 12 MB combined
- Browser-side SHA-256 preview and server-side file digest
- Gemini multimodal evidence analysis via the server
- Timeline, findings, entities and next-steps views
- Gemini-assisted report generation for live cases
- Local sample analysis when Gemini is not connected
- Explicit local case saving (analysis metadata only, in this browser's local storage)
- Markdown report download and Print / Save PDF
- Privacy/help dialog and official reporting link
- Rate limiting and common API/upload error handling

## Privacy and safety notes

- Files are held in memory by this app server and are not written to a local file directory.
- If Gemini is enabled, the files and incident description are sent to Google's Gemini API for analysis. Review the Google API terms and your organization/class rules before uploading any material. For presentations, use fictional/redacted evidence.
- When a user explicitly chooses “Save to local vault”, only case analysis metadata and the evidence manifest are stored in this browser's local storage; raw files are not saved. Clear the browser storage to remove local cases.
- There is no account system or multi-user access control in this student prototype. Do not expose it publicly with real case data without adding authentication, authorization, encryption-at-rest, secure deployment configuration, retention controls and formal privacy review.
- AI may misread text, dates, amounts or context. All extracted details must be verified against original evidence.
- Do not claim that the app proves evidence is authentic or that a named person committed a crime.

## API endpoints

- `GET /api/status` — shows whether Gemini is configured and which model is selected.
- `POST /api/analyze` — multipart evidence + incident context, processed by Gemini.
- `POST /api/report` — produces a report from a previous analysis.
- `POST /api/health-check` — checks that the server can call Gemini.

## Model configuration

Edit `.env` if needed:

```env
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-3.8-flash
PORT=3000
```

## Reference

- [Gemini API — Interactions overview](https://ai.google.dev/gemini-api/docs/interactions-overview)
- [Gemini API — Document processing](https://ai.google.dev/gemini-api/docs/document-processing)
- [Google AI Studio — API keys](https://aistudio.google.com/apikey)
- [National Cyber Crime Reporting Portal (India)](https://cybercrime.gov.in/)
