# Freshchat Admin Checklist

Complete this on the Freshchat / Freshworks admin side before syncing data into the dashboard.  
When done, put domain + token in `.env.local` (never commit secrets) and tell the builder.

Related: [BUILD_PLAN.md](./BUILD_PLAN.md)

---

## A. Account & plan

- [ ] Confirm product: standalone Freshchat **or** Freshdesk Omni / Freshsales Suite chat module
- [ ] Confirm plan supports Chat/Conversations API (docs: **Pro / Enterprise** for Chat API; Extract may still work — **verify on your account**)
- [ ] Record account chat URL from Admin API settings (standalone: `https://<account>.freshchat.com` — Suite may use `*.myfreshworks.com`)
- [ ] Note datacenter if shown (US / EUC / IND / AUS / US2)

**Verify:** Browser opens the correct tenant admin.

---

## B. API token

- [ ] Standalone: **Admin → Configure → API Tokens → Generate Token**
- [ ] Suite: **Settings → Admin Settings → Website Tracking and APIs → API Settings → Your API Key**
- [ ] Copy token once into a password manager (do not paste into Slack/git)
- [ ] Note: regenerating may invalidate the previous token

**Verify:**

```bash
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  "https://<domain>.freshchat.com/v2/agents?items_per_page=1"
```

Expect `200`. `401` = bad token; `403` = permission/plan.

---

## C. Domain for our `.env`

- [ ] Set `FRESHCHAT_API_BASE=https://<exact-host>/v2`
- [ ] Do **not** use a generic `api.freshchat.com` unless docs for your tenant say so

**Verify:** Same curl as above against that host.

---

## D. Reporting / Extract access

- [ ] Confirm the token can call Extract: `POST /v2/reports/raw` with a tiny 1-hour `Chat-Transcript` window
- [ ] Confirm events available: at least `Chat-Transcript`, `CSAT-Score`, `Conversation-Resolution-Label`
- [ ] Ask Freshworks support (if unclear) for **your** Extract limits: jobs/day, max range for transcripts

**Verify:** Job returns `id` + `link`; poll until `COMPLETED` or `FAILED`; download CSV opens.

**Rate limits to respect (public docs):**

- 1 Extract POST / minute
- ~120 jobs / day / event type
- Transcript window often **24h** (confirm on live account — support tables conflict with API ref)
- CSAT / Resolution-Label typically ≤ 1 month
- Lookback floor ~15 months for many events
- Download URL ~1 hour TTL

### Sample Extract request (tiny window)

```bash
curl -s -X POST "https://<domain>.freshchat.com/v2/reports/raw" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "start": "2026-09-08T00:00:00.000Z",
    "end": "2026-09-08T23:59:00.000Z",
    "event": "Chat-Transcript",
    "format": "csv"
  }'
```

Then poll: `GET /v2/reports/raw/{id}` until `status` is `COMPLETED`.

---

## E. CSAT surveys enabled

- [ ] Enable Customer Satisfaction surveys (Admin CSAT / Conversations CSAT settings)
- [ ] Confirm survey sends on resolve for the channels you care about
- [ ] Document eligibility (min messages, expiry, which channels)

**Verify:** Resolve a **test** conversation → rate it → rating appears in Freshchat UI → later appears in `CSAT-Score` extract (by **rating date**).

---

## F. Resolution / conversation labels

- [ ] Configure Conversation Labels (categories + subcategories)
- [ ] Decide if agents must apply a label on resolve (recommended for clean subjects)
- [ ] Document auto-resolve / mobile / offline exceptions that skip labels

**Verify:** Resolve test chat with a label → row appears in `Conversation-Resolution-Label` extract.  
If labels are usually empty → expect most subjects from the **keyword classifier** (Phase 2).

---

## G. Agents, groups, channels

- [ ] Agents exist and are assigned on chats
- [ ] Groups/channels named clearly (they become dashboard dimensions)

**Verify:** `GET /v2/agents` returns your team; sample transcript rows have `actor_type` / channel fields.

---

## H. Sign-off fixture (create 3 test conversations)

Create and keep IDs for reconciliation:

1. Resolved + rated CSAT + resolution label
2. Resolved + **no** CSAT
3. Still open / unresolved

**Verify after first sync:** counts and avg CSAT on dashboard match what you see in Freshchat for those three.

| # | Conversation ID | Expected CSAT | Expected label | Status |
|---|-----------------|---------------|----------------|--------|
| 1 | | | | resolved + rated |
| 2 | | — | | resolved, unrated |
| 3 | | — | | open |

---

## I. What to send back to the builder

When checklist is done, provide (securely):

```text
FRESHCHAT_API_BASE=https://_____.freshchat.com/v2
FRESHCHAT_API_TOKEN=_____
Preferred first lookback days: 3 (recommended for first test) or 30
Timezone for reports UI: Asia/Kolkata (or other)
Are resolution labels used consistently? yes / mostly empty
Is CSAT enabled on production channels? yes / no
```

---

## Open points to confirm on your account

1. Is `Chat-Transcript` max range **24h** on your tenant? (validate with one POST)
2. Does Extract work on your plan even if Chat REST is restricted?
3. Exact host string for Suite vs standalone
4. Typical resolution-label fill rate (drives classifier effort)

---

## Official references

- [API token generation](https://crmsupport.freshworks.com/support/solutions/articles/50000004463-api-tokens)
- [Freshchat API](https://developers.freshchat.com/api/)
- [Extract API](https://crmsupport.freshworks.com/support/solutions/articles/50000004465-extract-api)
- [Raw chat data / limits](https://crmsupport.freshworks.com/support/solutions/articles/50000004681-how-can-i-fetch-the-raw-data-of-my-chats-)
- [CSAT setup](https://crmsupport.freshworks.com/support/solutions/articles/50000005571-customer-satisfaction-survey-for-web-and-mobile-sdk)
- [Conversation labels](https://crmsupport.freshworks.com/support/solutions/articles/50000004400-conversation-labels-and-label-reports)
