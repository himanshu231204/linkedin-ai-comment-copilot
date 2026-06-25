# Environment Setup

**LinkedIn AI Comment Copilot** — Complete guide to environment variables, API keys, and local development setup.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Variables](#environment-variables)
3. [API Key Setup](#api-key-setup)
4. [Backend Setup](#backend-setup)
5. [Extension Setup](#extension-setup)
6. [Verification](#verification)
7. [Render Deployment](#render-deployment)

---

## Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Python | 3.11+ | Backend runtime |
| Google Chrome | Latest | Extension host |
| pip | Latest | Package installer |
| Git | Latest | Version control |

---

## Environment Variables

### Required Variables

| Variable | Provider | Description | Get yours at |
|----------|----------|-------------|-------------|
| `GROQ_API_KEY` | Groq | API key for primary LLM (Llama 3.3 70B) | [console.groq.com/keys](https://console.groq.com/keys) |

### Optional Variables

| Variable | Provider | Default | Description |
|----------|----------|---------|-------------|
| `GOOGLE_API_KEY` | Google AI | None | Fallback LLM (Gemini 2.5 Flash) — enables automatic failover |
| `LANGSMITH_API_KEY` | LangSmith | None | Enables request tracing & observability |
| `LANGSMITH_PROJECT` | LangSmith | `linkedin-ai-comment-copilot` | LangSmith project name |
| `LANGSMITH_ENDPOINT` | LangSmith | `https://api.smith.langchain.com` | LangSmith API endpoint |
| `HOST` | Server | `0.0.0.0` | Backend server bind host |
| `PORT` | Server | `8000` | Backend server bind port |

### LiteLLM Telemetry (set automatically)

These are set in `backend/main.py` and `backend/test_models.py` — you do **not** need to add them to `.env`:

| Variable | Value | Purpose |
|----------|-------|---------|
| `LITELLM_LOCAL_MODEL_COST_MAP` | `True` | Prevents LiteLLM from making background network calls that cause hangs |
| `DO_NOT_TRACK` | `1` | Disables LiteLLM telemetry |

---

## API Key Setup

### 1. Groq API Key (Required — Primary LLM)

```mermaid
graph LR
    A["Go to<br/>console.groq.com"] --> B["Sign up /<br/>Log in"]
    B --> C["Navigate to<br/>API Keys"]
    C --> D["Create new key"]
    D --> E["Copy key"]
    E --> F["Add to .env<br/>GROQ_API_KEY=..."]

    style A fill:#F55036,color:#fff
    style F fill:#057642,color:#fff
```

**Steps:**
1. Visit [console.groq.com/keys](https://console.groq.com/keys)
2. Sign up or log in
3. Click **"Create API Key"**
4. Name your key (e.g., "linkedin-copilot")
5. Copy the generated key
6. Add to `backend/.env`:
   ```env
   GROQ_API_KEY=gsk_...your_key_here
   ```

**Free tier**: 30 requests/minute, 14,400 requests/day

---

### 2. Google AI API Key (Optional — Fallback LLM)

```mermaid
graph LR
    A["Go to<br/>aistudio.google.com"] --> B["Sign in with<br/>Google Account"]
    B --> C["Click 'Get API Key'"]
    C --> D["Create new key"]
    D --> E["Copy key"]
    E --> F["Add to .env<br/>GOOGLE_API_KEY=..."]

    style A fill:#4285F4,color:#fff
    style F fill:#057642,color:#fff
```

**Steps:**
1. Visit [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Select or create a project
5. Copy the generated key
6. Add to `backend/.env`:
   ```env
   GOOGLE_API_KEY=AIzaSy...your_key_here
   ```

**Why optional?** Without this key, the fallback model (Gemini) is unavailable. All requests go to Groq only. If Groq is down or rate-limited, requests will fail instead of falling back.

**Free tier**: 20 requests/day (rate-limited)

---

### 3. LangSmith API Key (Optional)

```mermaid
graph LR
    A["Go to<br/>smith.langchain.com"] --> B["Sign up /<br/>Log in"]
    B --> C["Settings → API Keys"]
    C --> D["Create API Key"]
    D --> E["Copy key"]
    E --> F["Add to .env<br/>LANGSMITH_API_KEY=..."]

    style A fill:#6C47FF,color:#fff
    style F fill:#057642,color:#fff
```

**Steps:**
1. Visit [smith.langchain.com](https://smith.langchain.com)
2. Sign up or log in
3. Go to **Settings** → **API Keys**
4. Click **"Create API Key"**
5. Copy the key
6. Add to `backend/.env`:
   ```env
   LANGSMITH_API_KEY=ls_...your_key_here
   LANGSMITH_PROJECT=linkedin-ai-comment-copilot
   ```

---

## Backend Setup

### Step-by-Step

```bash
# 1. Clone the repository
git clone https://github.com/himanshu231204/linkedin-ai-comment-copilot.git
cd linkedin-ai-comment-copilot

# 2. Navigate to backend
cd backend

# 3. Create virtual environment
python -m venv venv

# 4. Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# 5. Install dependencies
pip install -r requirements.txt

# 6. Create environment file
cp .env.example .env

# 7. Edit .env with your API keys (see above)

# 8. Test model connectivity
cd ..  # back to project root
python -m backend.test_models

# 9. Start the server
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Complete .env File

```env
# ===========================================
# LinkedIn AI Comment Copilot - .env
# ===========================================

# Required: Groq (Primary LLM — all agents)
GROQ_API_KEY=gsk_...your_groq_key

# Optional: Google AI (Fallback LLM — enables automatic failover)
# GOOGLE_API_KEY=AIzaSy...your_google_key

# Optional: LangSmith tracing
# LANGSMITH_API_KEY=ls_...your_langsmith_key
# LANGSMITH_PROJECT=linkedin-ai-comment-copilot
# LANGSMITH_ENDPOINT=https://api.smith.langchain.com

# Optional: Server config
# HOST=0.0.0.0
# PORT=8000
```

---

## Extension Setup

```mermaid
graph TD
    A["Open Chrome"] --> B["Navigate to<br/>chrome://extensions/"]
    B --> C["Enable<br/>Developer Mode"]
    C --> D["Click<br/>'Load unpacked'"]
    D --> E["Select<br/>extension/ folder"]
    E --> F["Extension installed ✓"]

    style F fill:#FFC107,color:#000
```

**Steps:**
1. Open Google Chrome
2. Navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right)
4. Click **"Load unpacked"**
5. Select the `extension/` folder from this project
6. The extension icon appears in your toolbar

### After Extension Updates

1. Go to `chrome://extensions/`
2. Click the **refresh icon** on the extension card
3. Reload any open LinkedIn pages

---

## Verification

### 1. Health Check

```bash
curl http://localhost:8000/health
```

Expected response:
```json
{"status": "healthy"}
```

### 2. Model Connectivity Test

```bash
python -m backend.test_models
```

Expected output:
```
============================================================
  LinkedIn AI Comment Copilot - Model Test
============================================================
  [1/3] Testing Primary LLM (Groq Llama 3.3 70B)...
    [+] Direct call: PASS (0.8s)
    [+] Router call: PASS (0.7s)
  [2/3] Testing Fallback LLM (Gemini 2.5 Flash)...
    [+] Direct call: PASS (1.2s)  (or SKIP if no API key)
  [3/3] Testing Router Fallback...
    [+] Fallback trigger: PASS
  [4/4] Testing Agent Integration...
    [+] Analyzer: PASS
    [+] Planner: PASS
    [+] Writer: PASS
    [+] Reviewer: PASS

  Total: 10 passed, 0 failed
============================================================
```

### 3. Generate Comment Test

```bash
curl -X POST http://localhost:8000/generate-comment ^
  -H "Content-Type: application/json" ^
  -d "{\"post_content\": \"Excited to start my new role at Google!\", \"tone\": \"professional\"}"
```

### 4. LangSmith Verification

If LangSmith is configured, visit [smith.langchain.com](https://smith.langchain.com) and select the `linkedin-ai-comment-copilot` project. You should see traces for each API call.

---

## Render Deployment

The backend is deployed to Render as a Web Service.

### Configuration

- **render.yaml**: Defines the service configuration
- **Procfile**: `web: uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Build command**: `pip install -r backend/requirements.txt`
- **Start command**: Uses `$PORT` (Render injects this automatically)

### Environment Variables on Render

Set these in the Render dashboard under **Environment**:

| Variable | Value |
|----------|-------|
| `GROQ_API_KEY` | `gsk_...your_key` |
| `GOOGLE_API_KEY` | `AIzaSy...your_key` (optional) |
| `LANGSMITH_API_KEY` | `ls_...your_key` (optional) |
| `PYTHON_VERSION` | `3.11` |

### Extension URL

The Chrome extension connects to:
```
https://linkedin-ai-comment-copilot-1.onrender.com
```

This is set in both `extension/background.js` and `extension/popup.js` as `API_BASE_URL`.

---

## Troubleshooting

### Windows DNS Resolution Issue

**Symptom:** `Cannot connect to host ... Could not contact DNS servers`

**Cause:** The `aiodns` package (used by aiohttp for async DNS) has compatibility issues on Windows.

**Fix:**
```bash
pip uninstall aiodns pycares -y
```

This forces aiohttp to use the system DNS resolver instead.

### LangSmith Warning

**Symptom:** `WARNING: LANGSMITH_API_KEY not set - LangSmith tracing disabled`

**Fix:** Ensure your `.env` uses the new `LANGSMITH_*` variable names (not the deprecated `LANGCHAIN_*` names):
```env
LANGSMITH_API_KEY=your_key_here
LANGSMITH_PROJECT=linkedin-ai-comment-copilot
```

### API Returns 500 Error

**Check:**
1. `GROQ_API_KEY` is set in `.env` (required)
2. Groq API is accessible from your network
3. Run `python -m backend.test_models` to verify connectivity

### LiteLLM Hangs

**Symptom:** LLM calls hang indefinitely

**Cause:** LiteLLM makes background network calls for telemetry and model cost lookup.

**Fix:** These are already set in `main.py`, but if you're running tests separately:
```bash
set LITELLM_LOCAL_MODEL_COST_MAP=True
set DO_NOT_TRACK=1
python -m backend.test_models
```

---

*Last updated: June 2026*
