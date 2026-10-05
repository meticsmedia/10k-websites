# The Real Backend (optional, free on every Hostinger plan)

A static site can only send form messages somewhere else. This module gives the site its own backend on the same hosting: accepted form submissions are saved, email notifications can be configured and verified, and the owner has a private inbox page to read, answer, mark done and download everything as a spreadsheet. It needs PHP on a compatible Hostinger plan and deploys with the same site archive. Verify the selected plan supports it; notification mailbox availability and cost are separate. It stores messages in SQLite when the server has it and in a locked data file when it does not, so storage can work with either server capability. Admin activation and email delivery still need separate checks.

## When to offer it

At the form decision in Phase 8, as one of the choices:
1. **A real inbox on your own website** (Recommended for real businesses): messages saved on your hosting, an email for each one, and a private inbox page.
2. An email link (opens the visitor's email app).
3. A free form service (Formspree), which needs an account.
4. A link to an existing booking or checkout page.
5. A demo-only success message (invented brands).

Say in one line what the real inbox is not: it is not online payments, customer accounts or a booking calendar that blocks dates. Those are bigger projects.

## Adding it

1. Run from the website folder: `node <this skill's folder>/tools/backend.mjs site --name "Business Name" --owner owner@email.com --url https://their-domain.com`. It copies `api/`, `admin/`, `data/` and `forms.js` into `site/`, writes `api/config.php` once, and prints `INBOX_SETUP_CODE`. Running it again keeps the database and secret.
2. Mark each form and point it at the backend, so it also works without JavaScript:
```html
<form data-k-form="booking" method="post" action="api/submit.php">
  <label>Name <input name="name" required autocomplete="name"></label>
  <label>Email <input name="email" type="email" required autocomplete="email"></label>
  <label>Preferred date <input name="preferred_date" type="date"></label>
  <label>Message <textarea name="message"></textarea></label>
  <button type="submit">Send request</button>
  <p data-k-sent tabindex="-1">Thank you. We reply within a day.</p>
  <p data-k-error>Something went wrong. Please email hello@their-domain.com.</p>
</form>
<script src="forms.js" defer></script>
```
   `name`, `email` and `message` are stored in their own columns; any other field (dates, quantities, the service they want) is stored and shown too. On inner pages use `/api/submit.php` and `/forms.js`.
3. Style the sent and error messages like the rest of the page. The script hides them until needed.

## What it does for safety (so you never have to write it)

- Spam: a hidden field only bots fill, a signed page-load time (forms sent within 3 seconds are rejected), and at most 5 sends per visitor per 10 minutes.
- The database lives outside the public folder when the host allows it (Hostinger does), under a random name, so no deploy can overwrite it and nobody can download it. `data/` with its own lock is the fallback.
- The inbox has a password only the owner knows, lockout after 8 wrong tries, protection against forged clicks, and is hidden from search engines. The spreadsheet download is safe to open in Excel.
- Every value is limited in length and escaped before it is shown.

## Notifications and durable storage

Storage, admin activation and notification delivery are distinct states. Built-in server email may be limited or filtered; verify delivery before promising notifications. Do not assume a free website address includes a mailbox or that the destination email belongs to a Hostinger mailbox.

The supplied admin UI configures a Hostinger SMTP mailbox by default (`smtp.hostinger.com` over implicit TLS). Verify current mailbox eligibility and the owner's domain/account before suggesting creation. An arbitrary existing email address may be the recipient but is not necessarily a compatible sending mailbox. Do not ask the user to enter credentials for another provider into the Hostinger-default form. If another SMTP provider is needed, implement and verify its explicit host/port/TLS configuration before offering that path, or retain server email with an honest tested/unverified status.

Guide the owner to create/use a supported mailbox with their own password, then open the private inbox, expand Email notifications, enter it there, and press Save and send a test. The password stays on their hosting encrypted; never ask for it in chat. Verify current plan terms rather than promising a fixed free mailbox count. Messages remain in private storage even if email fails; preserve that database and the configuration secret across redeploys.

## Handing it to the owner (after it is live)

1. Tell them their inbox address (`https://their-domain.com/admin/`) and the setup code, in one short message: "Open your inbox, enter this code once, and choose your own password. I never see your password." Never ask for their password, and never choose it for them.
2. Once they have set their password, walk them through the mailbox step above, then send one clearly labeled test message through the live form to the configured owner recipient and ask them to confirm it appears in both the inbox and their email. Do not use a real third party’s address or send repeated tests. This end-to-end check is part of the explicitly selected real-inbox workflow; respect any user request to defer it.
3. Forgotten password: re-run `backend.mjs` with `--new-code`, redeploy, and give them the new code.

## Local preview

Use `node .10k/tools/preview.mjs site --port 8080`; never serve PHP configuration with a generic static server. PHP does not run in this preview, so forms show "This form starts working once the site is online." That is expected. Test the form on the live site.

## Deploying

The `api/`, `admin/` and `data/` folders go online with the rest of `site/`. After deploying, open `https://their-domain.com/api/submit.php?check=1`. It must answer with `"ok":true`, and should show `"private_folder":true` and `"writable":true`. Then check that `https://their-domain.com/api/config.php` does NOT show its contents. If the check shows code or downloads a file instead, PHP is not running there (see troubleshooting).

## Verification record

When local PHP is available, exercise storage, validation, timing/honeypot, unauthenticated admin and private-file protection in a temporary copy with notifications disabled. Delete test data afterward. Do not change the production owner/config for a test. If PHP is unavailable, record that limit and verify the real host before claiming the inbox works. The static browser checker uses GET/HEAD only and must never submit a live enquiry implicitly.

Record independently: site published; health/private storage verified; owner password set; labeled enquiry saved; notification received. A healthy endpoint or successful SMTP connection alone does not confirm inbox arrival. Keep owner-only setup pending honestly without holding back unrelated completed website work.
