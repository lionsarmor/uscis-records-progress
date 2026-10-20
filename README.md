# Records request progress

Read-only public request status and saved email text. James confirmed all ten requests sent on October 20, 2026. Browser-only draft edits and actual sent-mail copies have not been imported.

The public page reads agency response updates from the owner's password-protected response service on the droplet. The GET progress endpoint is public; write operations require owner authentication. No credentials are stored in this repository.

GitHub Pages serves the root of the main branch. Both public views load the same response log. Search engines are asked not to index this material; it remains publicly accessible.

The editor supports multiple document uploads per agency, up to 25 MB per file. Originals are stored on the droplet and downloaded from the public document links; they are not committed to GitHub. Uploads and deletions require editor access. The JSON progress backup includes document metadata, not the original files.

The public overview groups agencies into expandable court, police, and sheriff cards. Search covers agency names, request text/dockets, replies, and document names. Filters and expand/collapse controls help review a subset. Documents, individual replies, and the original request remain inside each card; periodic refreshes preserve expansion state and retain the last loaded data if the live service is temporarily unavailable.

Each agency also has an RFE review checklist with explicit source labels. Requirements are summarized from the supplied October 14, 2026 RFE, printed pages 2–4; case routing comes from the January 2, 2025 CORI inventory and existing agency requests. Supporting requests and personal notarized-statement follow-up are distinguished from agency document requirements. No item is automatically completed based on uploads.

Checkboxes are personal browser-local review state, saved in localStorage under `records-rfe-2026-10-14-checks-v1`. They persist across reloads and synchronize between tabs at the same origin, but do not modify the shared progress database, sync between the two public origins, or establish completeness/USCIS acceptance. Storage failure is visibly labeled. The copy control copies only unchecked checklist items and falls back to selectable text if clipboard access fails. Checklist content is embedded as JSON in index.html so both existing hosts can serve it without backend changes.
