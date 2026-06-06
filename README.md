# Yaad

> *Yaad aana* — Hindi for "to be remembered."

AI-powered reorder reminder engine for Indian kirana stores. Merchants snap a photo
of products being sold, the system identifies items and logs the transaction, then
sends personalised Hindi voice note reminders when those items are due for reorder.

Built at hackathon using the full Paytm Inference + Sarvam AI stack.

---

## The problem

India has 12 million kirana stores. None of them have a CRM.

When a customer pays ₹200 at a kirana, the Paytm soundbox says
*"Do sau rupaye prapt hue"* — and that is where the data trail ends.
The merchant has no record of what was sold. The customer has no reminder
when they run out. The store loses repeat business to Blinkit and Zepto
not because of price, but because quick commerce sends push notifications
and kiranas do not.

The deeper problem: these stores are invisible to the formal economy.
No item-level transaction data means no credit access, no inventory insight,
no customer intelligence.

---

## The solution

Yaad adds one step to a transaction the merchant is already completing.

```
Customer pays → soundbox fires → merchant taps once → snaps photo of items
→ AI identifies products → logs to database → reorder reminder fires
   automatically as a Hindi voice note when items are due
```

The merchant's behavior changes by exactly one tap. Everything else is automatic.

---

## Architecture

### System overview

Two independent flows connected through a shared Supabase database.

```
① BILLING (triggered by payment)

  Soundbox         Merchant          Claude Opus 4.5      Supabase DB
  (webhook)   →   snaps photo   →   Paytm Inference    →   items stored
                                    object detection


② DAILY REMINDER (triggered by scheduler)

  Scheduler    →   Sarvam 30B   →   Bulbul V3   →   Dashboard
  reads DB         gen message      TTS audio       WA-style UI
  daily
```

### Flow 1 — Billing (real-time)

| Step | What happens | API |
|---|---|---|
| 1 | Paytm soundbox fires on payment | Paytm webhook |
| 2 | Push notification appears on merchant's phone | FastAPI |
| 3 | Merchant taps → camera opens | Frontend |
| 4 | Merchant snaps photo of products on counter | Mobile camera |
| 5 | Image sent to backend as base64 | FastAPI |
| 6 | Claude Opus 4.5 identifies items from photo | Paytm Inference |
| 7 | Items returned: `[{name, quantity, category, reorder_days}]` | — |
| 8 | Merchant confirms → transaction + items saved to Supabase | Supabase |
| 9 | `reorder_due_at` computed per item: `purchased_at + reorder_days` | — |

### Flow 2 — Daily reminder

| Step | What happens | API |
|---|---|---|
| 1 | APScheduler runs once daily (configurable time) | APScheduler |
| 2 | Query: items where `reorder_due_at <= now()` | Supabase |
| 3 | For each customer: personalised Hindi message generated | Sarvam 30B |
| 4 | Message converted to voice note audio | Sarvam Bulbul V3 |
| 5 | Audio file stored in Supabase Storage | Supabase Storage |
| 6 | Reminder record created with `audio_url` | Supabase |
| 7 | Dashboard displays WA-style chat bubble with playable audio | React |

### Data model

```
customers          transactions         items
─────────          ────────────         ─────
id                 id                   id
name               customer_id ──→      transaction_id ──→
phone              amount               name
language           created_at           quantity
                                        category
                                        reorder_days
reminders                               reorder_due_at
─────────
id
customer_id ──→
message_text
audio_url
status
created_at
```

### Default reorder windows (auto-assigned by item category)

| Category | Reorder window |
|---|---|
| Dairy (eggs, milk, paneer) | 7 days |
| Bakery (bread, buns) | 5 days |
| Beverages | 14 days |
| Snacks (biscuits, chips) | 14 days |
| Staples (atta, dal, rice) | 30 days |
| Personal care | 30 days |
| Household | 45 days |

---

## Tech stack

| Layer | Tool | Purpose |
|---|---|---|
| Backend | FastAPI (Python 3.11+) | API server, orchestration |
| Database | Supabase PostgreSQL | Transaction + customer data |
| File storage | Supabase Storage | Voice note audio files |
| Vision AI | Claude Opus 4.5 via Paytm Inference | Object detection from photo |
| Message AI | Sarvam 30B | Personalised Hindi message generation |
| Voice AI | Sarvam Bulbul V3 | Hindi text-to-speech |
| Scheduler | APScheduler | Daily reminder cron |
| Frontend | React + Vite | Merchant dashboard |

---

## Demo flow

The demo runs end-to-end in ~2.5 minutes across five screens.

### Screen 1 — Dashboard (opening state)

Merchant opens the app. Dashboard shows 3–4 pre-populated at-risk customers
with purchase history and reorder status. Judges see the value immediately
before anything is demoed.

```
Customer          Items             Last purchase    Status
────────────────────────────────────────────────────────────
Priya Sharma      Eggs, Bread       13 days ago      🔴 due today
Rajesh Kumar      Milk, Dahi        6 days ago       🟡 due soon
Anita Patel       Atta, Toor Dal    4 days ago       🟢 ok
Suresh Mehta      Maggi, Biscuits   11 days ago      🔴 due today
```

### Screen 2 — Soundbox fires (simulated)

A "Simulate Payment ₹200" button appears in the top right corner.
Click → Bulbul-generated audio plays: *"Do sau rupaye prapt hue"*.
A notification slides in from the top: *"₹200 received — tap to log items"*.
The photo modal opens automatically.

> The soundbox audio clip is itself generated by Bulbul V3 during setup.
> No physical Paytm device is needed for the demo.

### Screen 3 — Photo → item detection (live AI call)

The modal has a drag-and-drop upload area. Drop any grocery photo.
The system accepts any real photo — Parle-G packets, oil bottles, soap bars,
Maggi, whatever is on the counter. This is not hardcoded.

States shown visibly in the UI:
```
📸 Photo uploaded
⏳ Analysing items...
✅ Detected: Eggs ×12, Bread ×1
```

The call fires to Claude Opus 4.5 via Paytm Inference. Reorder windows
are auto-assigned by category. Merchant reviews and confirms.
Transaction is logged to Supabase with `reorder_due_at` computed per item.

### Screen 4 — Customer list updates

The new transaction appears at the top of the dashboard in real time.
Clicking on Priya Sharma's card shows her full purchase history and
highlights eggs as due today.

### Screen 5 — The magic moment (live AI calls)

Click "Generate Reminder" on any overdue customer card.
Two API calls fire in sequence — progress streamed visibly:

```
⏳ Generating message...    ← Sarvam 30B
⏳ Synthesising voice...    ← Sarvam Bulbul V3
✅ Ready
```

A WhatsApp-style chat bubble appears in a side panel with an audio
waveform visualiser. Hit play. The reminder fires in Hindi:

> *"Namaskar Priya ji, 13 din pehle aapne ande aur bread liye the —
>  aaj khatam ho gaye honge. Aao, fresh stock aa gaya hai!"*

---

## What is real vs mocked

| Component | Status | Notes |
|---|---|---|
| Soundbox payment trigger | Mocked | Button + Bulbul-generated audio clip |
| Customer purchase history | Seeded | `scripts/seed.py` pre-populates data |
| Photo → item detection | **Live** | Real Claude Opus 4.5 API call |
| Hindi message generation | **Live** | Real Sarvam 30B API call |
| Voice note audio | **Live** | Real Bulbul V3 API call |
| WhatsApp delivery | Mocked | Shown in dashboard UI only |

The three AI calls are all real and run live in front of judges.

---

## Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- Supabase project
- Paytm Inference account (`console.inference.paytm.com`)
- Sarvam AI account (`dashboard.sarvam.ai`)

### Installation

```bash
# Clone
git clone https://github.com/your-username/yaad
cd yaad

# Backend
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

### Environment variables

```bash
cp .env.example .env
# Fill in PI_API_KEY, SARVAM_API_KEY, SUPABASE_URL,
# SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
```

### Database setup

```bash
# Run schema in Supabase SQL editor
cat supabase/schema.sql

# Seed demo data
cd backend
python scripts/seed.py
```

### Running locally

```bash
# Terminal 1 — backend
cd backend
uvicorn main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend
npm run dev
```

App runs at `http://localhost:5173`.

---

## API reference

### Billing

| Method | Endpoint | Description |
|---|---|---|
| POST | `/billing/simulate-payment` | Simulate soundbox webhook, returns audio clip URL |
| POST | `/billing/detect-items` | Accept base64 image, return detected items |
| POST | `/billing/confirm` | Save transaction + items to DB |

### Reminders

| Method | Endpoint | Description |
|---|---|---|
| GET | `/reminders/due` | List customers with overdue items |
| POST | `/reminders/generate/{customer_id}` | Generate message + voice note (SSE stream) |
| GET | `/reminders/history` | All generated reminders |

### Customers

| Method | Endpoint | Description |
|---|---|---|
| GET | `/customers` | List all customers |
| GET | `/customers/{id}` | Customer detail + purchase history |
| POST | `/customers` | Create customer |

---

## Product vision (beyond the demo)

**v1 — Demo (current):** Photo → item detection → reorder voice note on dashboard.

**v2 — WhatsApp delivery:** Connect WhatsApp Business API to send the voice note
directly to the customer's phone. The two-step flow (text template → open window →
send audio) is already mapped out.

**v3 — Swiggy Instamart plugin:** When the merchant is out of stock, the reminder
deeplinks to their Instamart storefront. Nazar becomes a distribution layer
for quick commerce platforms rather than competing with them.

**v4 — Merchant credit:** Item-level transaction data builds a verifiable revenue
record. Six months of Yaad data = proof of sales volume = basis for formal credit.
This is the long-term moat — the data layer the kirana never had.
