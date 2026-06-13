// LinkedIn AI Comment Copilot - Background Service Worker (MV3)

const API_BASE_URL = 'http://localhost:8000';
const STORAGE_KEY = 'linkedin_ai_copilot_state';

// ─── Helpers ────────────────────────────────────────────────────────────────

function log(label, ...args) {
  console.log(`[AI Copilot][BG] ${label}`, ...args);
}

function logError(label, ...args) {
  console.error(`[AI Copilot][BG] ${label}`, ...args);
}

// Safe broadcast — always succeeds even if no listener is registered
async function broadcast(message) {
  try {
    await chrome.runtime.sendMessage(message);
    log('Broadcast sent', message.type);
  } catch (err) {
    // Popup is closed — this is expected, not an error
    log('Broadcast receiver not available (popup closed?)', message.type);
  }
}

// Persist generated data so the popup can load it on next open
async function persistComment(comment, postContent, tone) {
  try {
    const state = {
      comment: comment || '',
      postContent: postContent || '',
      tone: tone || 'professional',
      timestamp: Date.now(),
    };
    await chrome.storage.local.set({ [STORAGE_KEY]: state });
    log('Comment persisted to storage');
  } catch (err) {
    logError('Failed to persist comment', err);
  }
}

// ─── Message Router ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  log('Message received', message.type, 'from', sender.tab?.url || 'popup');

  switch (message.type) {
    case 'GENERATE_COMMENT':
      handleGenerateComment(message, sender, sendResponse);
      return true; // async — keep message channel open

    case 'CHECK_HEALTH':
      handleCheckHealth(sendResponse);
      return true;

    default:
      log('Unknown message type', message.type);
      return false;
  }
});

// ─── Handlers ───────────────────────────────────────────────────────────────

async function handleGenerateComment(message, sender, sendResponse) {
  const { postContent } = message;
  log('Generating comment for post', postContent?.substring(0, 80) + '...');

  try {
    const comment = await fetchGeneratedComment(postContent);
    log('Comment received from API', comment?.substring(0, 60) + '...');

    // 1. Always persist to storage (popup can load later)
    await persistComment(comment, postContent);

    // 2. Broadcast to extension pages (popup, if open)
    await broadcast({
      type: 'COMMENT_GENERATED',
      postContent,
      comment,
    });

    // 3. Respond to content script
    try {
      sendResponse({ success: true, comment });
    } catch (err) {
      // sendResponse may fail if port is closed — that's OK
      log('sendResponse failed (port closed?)', err.message);
    }
  } catch (error) {
    logError('Generation failed', error.message);

    try {
      sendResponse({ success: false, error: error.message });
    } catch (err) {
      log('sendResponse failed on error', err.message);
    }
  }
}

async function handleCheckHealth(sendResponse) {
  try {
    const healthy = await checkApiHealth();
    sendResponse({ success: true, healthy });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// ─── API Calls ──────────────────────────────────────────────────────────────

async function getSelectedTone() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const state = result[STORAGE_KEY];
    return state?.tone || 'professional';
  } catch (error) {
    logError('Failed to read tone from storage', error);
    return 'professional';
  }
}

async function fetchGeneratedComment(postContent) {
  const tone = await getSelectedTone();
  log('Calling API', { tone, postLength: postContent?.length });

  const response = await fetch(`${API_BASE_URL}/generate-comment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      post_content: postContent,
      tone,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => 'no body');
    throw new Error(`API error ${response.status}: ${text}`);
  }

  const data = await response.json();

  if (!data.comment) {
    throw new Error('API returned empty comment');
  }

  return data.comment;
}

async function checkApiHealth() {
  const response = await fetch(`${API_BASE_URL}/health`);
  return response.ok;
}

// ─── Lifecycle ──────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    log('Extension installed');
    chrome.storage.local.set({
      [STORAGE_KEY]: {
        tone: 'professional',
        comment: '',
        postContent: '',
        timestamp: Date.now(),
      },
    });
  } else if (details.reason === 'update') {
    log('Extension updated to version', chrome.runtime.getManifest().version);
  }
});

log('Service worker loaded');
