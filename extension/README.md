# LinkedIn AI Comment Copilot - Chrome Extension

A Chrome Extension that generates AI-powered LinkedIn comments using the LangGraph multi-agent backend.

## Features

- **Post Detection**: Automatically detects LinkedIn posts
- **AI Comment Button**: Injects "Generate AI Comment" button on each post
- **Tone Selector**: Choose from 10 different comment tones
- **One-Click Copy**: Copy generated comments to clipboard
- **Insert to LinkedIn**: Automatically fills LinkedIn comment box
- **Regenerate**: Generate alternative comments

## Supported Tones

- Professional
- Technical
- Supportive
- Networking
- Thoughtful
- Friendly
- Encouraging
- Curious
- Founder
- Recruiter

## Installation

### Prerequisites

1. Start the backend server:
```bash
cd ../backend
.\venv\Scripts\python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Make sure `GOOGLE_API_KEY` and `GROQ_API_KEY` are set in `backend/.env`.

### Install Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `extension/` folder
5. The extension icon will appear in your toolbar

### Usage

1. Navigate to LinkedIn
2. Scroll through your feed - "Generate AI Comment" buttons appear on posts
3. Click the button on any post
4. Select your desired tone in the popup
5. Copy, regenerate, or insert the generated comment

## Files

```
extension/
├── manifest.json       # Extension configuration (Manifest V3)
├── popup.html          # Extension popup UI
├── popup.css           # Popup styling
├── popup.js            # Popup logic & API calls
├── content.js          # Content script (LinkedIn page injection)
├── content.css         # Content script styles
├── background.js       # Service worker (background tasks)
├── generate_icons.py   # Icon generation script
├── icons/              # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md           # This file
```

## API Communication

The extension communicates with the FastAPI backend at `http://localhost:8000`:

- `GET /health` - Check API status
- `POST /generate-comment` - Generate a comment

## Permissions

- `activeTab` - Access current tab
- `scripting` - Inject content scripts
- `storage` - Save settings
- `linkedin.com` - Access LinkedIn pages
- `localhost:8000` - Communicate with backend

## Troubleshooting

### Button not appearing
- Refresh the LinkedIn page
- Ensure the extension is enabled
- Check if the content script is injected

### Generation fails
- Verify the backend is running at `http://localhost:8000`
- Check the console for error messages
- Ensure `GOOGLE_API_KEY` and `GROQ_API_KEY` are set in the backend `.env`

### Comment not inserting
- Click on the comment box first
- Refresh and try again
- Check if LinkedIn's UI has changed