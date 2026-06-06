# Yaad — CLAUDE.md

AI-powered kirana reorder engine. Merchants snap a photo of products being sold,
Claude Opus 4.5 identifies the items, and personalised Hindi voice note reminders
fire automatically when those items are due for reorder.

---

## Core rule

### 95% confidence rule
If you are 95% confident you are moving in the right direction — on architecture,
API usage, data models, or implementation — proceed without asking for clarification.
Only stop if you are genuinely uncertain about product intent or are missing critical
information that cannot be inferred from context.

---

## Tech stack

| Layer             | Tool                                        |
|-------------------|---------------------------------------------|
| Backend           | FastAPI (Python 3.11+)                      |
| Database          | Supabase (PostgreSQL + Storage for audio)   |
| Vision / items    | Claude Opus 4.5 via Paytm Inference       |
| Message gen       | Sarvam 30B                                  |
| Voice note TTS    | Sarvam Bulbul V3                            |
| Frontend          | React + Vite                                |
| Scheduler         | APScheduler                                 |

---

## Directory structure

```
yaad/
├── backend/
│   ├── main.py                    # FastAPI app entry point
│   ├── config.py                  # Settings via pydantic-settings
│   ├── models.py                  # Pydantic request/response models
│   ├── scheduler.py               # APScheduler — daily reminder cron
│   ├── routes/
│   │   ├── billing.py             # Flow 1: payment → photo → items → DB
│   │   ├── reminders.py           # Flow 2: generate message + voice note
│   │   └── customers.py           # Customer CRUD + history
│   └── services/
│       ├── vision.py              # Claude Sonnet via Paytm Inference
│       ├── sarvam.py              # Sarvam 30B message gen + Bulbul V3 TTS
│       └── supabase_client.py     # DB + Storage operations
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api/
│   │   │   └── client.js          # Axios instance pointing to FastAPI
│   │   └── components/
│   │       ├── Dashboard.jsx      # Main view — customer at-risk list
│   │       ├── CustomerCard.jsx   # Per-customer row with risk badge
│   │       ├── PhotoModal.jsx     # Upload photo → show detected items
│   │       ├── VoiceNotePlayer.jsx # WA-style bubble + audio waveform
│   │       └── SoundboxSimulator.jsx # Demo soundbox button + audio
│   └── package.json
├── supabase/
│   └── schema.sql                 # Table definitions
├── scripts/
│   └── seed.py                    # Pre-populate demo customers + transactions
├── .env.example
├── CLAUDE.md
└── README.md
```

---

## Two flows

### Flow 1 — billing (real-time, triggered by payment)

```
POST /billing/simulate-payment   →  plays soundbox audio, returns txn_id
POST /billing/detect-items       →  accepts { txn_id, image_base64 }
                                     calls Claude Opus 4.5 via Paytm Inference
                                     returns [{ name, quantity, category, reorder_days }]
POST /billing/confirm            →  saves transaction + items to Supabase
                                     computes reorder_due_at per item
```

### Flow 2 — reminder (daily cron + on-demand for demo)

```
GET  /reminders/due              →  customers with items past reorder_due_at
POST /reminders/generate/{id}    →  streams three states:
                                     1. generating_message  (Sarvam 30B)
                                     2. synthesising_audio  (Bulbul V3)
                                     3. ready               (returns audio_url)
GET  /reminders/history          →  all reminders for dashboard list
```

---

## API integration patterns

### Paytm Inference — Claude Opus 4.5 (vision)

Base URL: `https://api.inference.paytm.com`
Use the Anthropic-compatible `/v1/messages` endpoint.

```python
import anthropic

client = anthropic.Anthropic(
    base_url="https://api.inference.paytm.com",
    api_key=settings.PI_API_KEY
)

ITEM_DETECTION_PROMPT = """You are a kirana store assistant in India.
Look at this photo and return ONLY a valid JSON array.
Each object: {"name": "...", "quantity": 1, "category": "...", "reorder_days": 7}
Categories: dairy, bakery, staples, snacks, beverages, personal_care, household
Default reorder_days: dairy=7, bakery=5, staples=30, snacks=14, beverages=14,
personal_care=30, household=45
Only include clearly visible items. Common Indian grocery/FMCG only.
Return ONLY the JSON array, no other text."""

response = client.messages.create(
    model="Claude Opus 4.5",  # gateway id; see GET /v1/models on Paytm Inference
    max_tokens=512,
    messages=[{
        "role": "user",
        "content": [
            {"type": "text", "text": ITEM_DETECTION_PROMPT},
            {"type": "image", "source": {
                "type": "base64",
                "media_type": "image/jpeg",
                "data": base64_image
            }}
        ]
    }]
)
# Parse response.content[0].text as JSON
```

### Sarvam — message generation (Sarvam 30B)

```python
async def generate_message(customer_name: str, items: list[str], days: int) -> str:
    async with httpx.AsyncClient() as client:
        r = await client.post(
            "https://api.sarvam.ai/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings.SARVAM_API_KEY}"},
            json={
                "model": "sarvam-m",
                "messages": [{
                    "role": "user",
                    "content": f"""Write a warm Hindi WhatsApp reminder from a kirana shopkeeper.
Customer: {customer_name}
Items bought {days} days ago: {', '.join(items)}
Under 30 words. Sound local, not corporate.
Return ONLY the message."""
                }]
            }
        )
        return r.json()["choices"][0]["message"]["content"]
```

### Sarvam — Bulbul V3 TTS

```python
async def generate_voice_note(text: str, language: str = "hi-IN") -> str:
    # Returns base64-encoded audio string
    async with httpx.AsyncClient() as client:
        r = await client.post(
            "https://api.sarvam.ai/text-to-speech",
            headers={"api-subscription-key": settings.SARVAM_API_KEY},
            json={
                "inputs": [text],
                "target_language_code": language,
                "speaker": "meera",
                "model": "bulbul:v3"
            }
        )
        return r.json()["audios"][0]  # base64 string
```

---

## Database schema

```sql
-- customers
create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  language text default 'hi',
  created_at timestamptz default now()
);

-- transactions
create table transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  amount numeric,
  created_at timestamptz default now()
);

-- items
create table items (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid references transactions(id),
  name text not null,
  quantity int default 1,
  category text,
  reorder_days int,
  reorder_due_at timestamptz,
  created_at timestamptz default now()
);

-- reminders
create table reminders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  message_text text,
  audio_url text,
  status text default 'pending',
  created_at timestamptz default now()
);
```

---

## Code style

- Python: type hints on every function signature
- Pydantic models for all request/response shapes — define in `models.py`
- No raw `print()` — use `logging.getLogger(__name__)`
- API call logic lives in `services/` — routes stay thin (validate input, call service, return response)
- All external calls are `async` — never use `requests` (use `httpx.AsyncClient`)
- React: functional components only, no class components
- One component per file, one responsibility per component
- All API calls from frontend go through `src/api/client.js`

## Error handling

- Wrap every Paytm Inference and Sarvam API call in try/except
- Log full error context before returning to client
- FastAPI: return `HTTPException` with structured detail, never let raw exceptions surface
- Frontend: show inline error states in the UI, never silent failures

## Demo-specific behaviour

- Soundbox simulation: `POST /billing/simulate-payment` returns a `{ audio_clip_url }` —
  frontend plays this clip (pre-generated via Bulbul V3) to simulate the soundbox firing
- No real WhatsApp sending — reminders are displayed only in the dashboard UI
- Seed script at `scripts/seed.py` pre-populates 4 customers with varied purchase histories
  so the dashboard is non-empty on first load
- `POST /reminders/generate/{customer_id}` should use SSE (Server-Sent Events) to stream
  progress: `generating_message` → `synthesising_audio` → `ready`
