# Validation

## Automated checks

The current implementation passed:

- TypeScript validation.
- The production Worker build.
- 23 isolated AI adapter checks.
- 22 isolated PayPal client checks.
- 16 isolated image/file checks.
- 25 local account regression checks, including cleanup of disposable records.

The focused test suites use mocked provider responses. A separate live multi-account workflow previously passed 59 checks with real AI calls and simulated payment transitions.

## Connected workflows

### Accounts and collaboration

Browser and API checks exercised independent client and vendor accounts, actual vendor profiles and invitations, vendor acceptance, task access, logout, and saved shared state. Checks rejected forged identity headers, inappropriate participant actions, unrelated-account access, cross-origin writes, invalid transitions, changed confirmed scope, and reuse of revoked sessions.

### PayPal test integration

PayPal Sandbox OAuth, order creation, browser buyer approval, authorization, work review, client acceptance, and capture completed successfully. A separate authorized task was cancelled through the client interface. Both participants saw the cancelled/voided state, and PayPal independently reported `VOIDED` with no capture.

Capture testing exposed a minimal response that omitted amount details. The client now requests a complete representation and retrieves capture details before validating a minimal response. Reconciliation used the existing idempotency key and recorded the completed payment without creating another capture.

These checks exercised the test environment. They do not establish live-money readiness, escrow, individual vendor payouts, refunds, or background webhook reconciliation.

### Images and visual AI

Nineteen live checks covered multipart submission permissions, file/count/size validation, image-only submissions, visual review, image-aware mediation, revised-image review, private byte retrieval, anonymous/unrelated-account rejection, cross-task image-reference rejection, and saved version history.

In a controlled example, the agreement required a square PNG with a pink background, three yellow circles, and readable BLOOM text. Gemini identified two circles in the first image. Groq answered the client’s follow-up using that image and pointed to the relevant requirement. The corrected image passed all three criteria through Gemini.

Browser checks also exercised the actual file chooser, local image preview, submit button, and another saved version. The gallery and version selector displayed the corresponding files. Earlier-version views clarified that the checklist applied to the latest submission, and the acceptance control first returned the client to the latest version.

### Persistence and interface

The application restarted from an on-disk dependency installation with the former RAM dependency path removed. Existing accounts and all saved image versions remained accessible from local D1/R2. No operating-system reboot was performed.

The shared workroom and profile interface were previously checked at a 390 px viewport. Desktop browser checks covered the image picker and submitted-image gallery.

## Reproducing checks

Follow the README setup instructions, then run the verification commands against a local server. Adapter tests do not require external credentials. Connected AI and PayPal workflows need separately configured credentials and test buyer approval. Provider availability can affect live results.

Build before running local smoke tests; avoid rebuilding while their database cleanup is running. The smoke test removes only the disposable accounts, profiles, sessions, and tasks it creates. Runtime data, uploaded customer work, credentials, account passwords, and transaction-specific references are excluded from the repository.
