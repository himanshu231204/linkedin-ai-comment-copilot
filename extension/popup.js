// LinkedIn AI Comment Copilot - Popup Script

const API_BASE_URL = 'http://localhost:8000';
const STORAGE_KEY = 'linkedin_ai_copilot_state';

// DOM Elements
const elements = {
  status: document.getElementById('status'),
  statusDot: document.querySelector('.status-dot'),
  statusText: document.querySelector('.status-text'),
  tone: document.getElementById('tone'),
  commentBox: document.getElementById('commentBox'),
  placeholder: document.getElementById('placeholder'),
  commentText: document.getElementById('commentText'),
  commentActions: document.getElementById('commentActions'),
  btnCopy: document.getElementById('btnCopy'),
  btnRegenerate: document.getElementById('btnRegenerate'),
  btnInsert: document.getElementById('btnInsert'),
};

// State
let currentComment = '';
let currentPostContent = '';
let isLoading = false;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadState();
  await checkHealth();
  setupEventListeners();
});

// Load saved state
async function loadState() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const state = result[STORAGE_KEY];
    if (state) {
      if (state.tone) {
        elements.tone.value = state.tone;
      }
      if (state.comment) {
        displayComment(state.comment);
      }
    }
  } catch (error) {
    console.error('Failed to load state:', error);
  }
}

// Save state
async function saveState() {
  try {
    const state = {
      tone: elements.tone.value,
      comment: currentComment,
    };
    await chrome.storage.local.set({ [STORAGE_KEY]: state });
  } catch (error) {
    console.error('Failed to save state:', error);
  }
}

// Check API health
async function checkHealth() {
  try {
    setStatus('loading', 'Checking...');
    const response = await fetch(`${API_BASE_URL}/health`);
    if (response.ok) {
      setStatus('connected', 'Connected');
    } else {
      setStatus('error', 'API Error');
    }
  } catch (error) {
    setStatus('error', 'Offline');
  }
}

// Set status indicator
function setStatus(status, text) {
  elements.status.className = `status ${status === 'loading' ? 'loading' : status === 'connected' ? '' : 'error'}`;
  elements.statusText.textContent = text;
}

// Setup event listeners
function setupEventListeners() {
  // Tone change
  elements.tone.addEventListener('change', () => {
    saveState();
  });

  // Copy button
  elements.btnCopy.addEventListener('click', () => {
    copyToClipboard(currentComment);
  });

  // Regenerate button
  elements.btnRegenerate.addEventListener('click', () => {
    if (currentPostContent) {
      generateComment(currentPostContent);
    }
  });

  // Insert button
  elements.btnInsert.addEventListener('click', () => {
    insertComment(currentComment);
  });

  // Listen for messages from content script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GENERATE_COMMENT') {
      currentPostContent = message.postContent;
      generateComment(message.postContent);
      sendResponse({ success: true });
    }
    return true;
  });
}

// Generate comment via API
async function generateComment(postContent) {
  if (isLoading) return;

  try {
    isLoading = true;
    setLoadingState(true);
    setStatus('loading', 'Generating...');
    elements.btnRegenerate.disabled = true;

    const response = await fetch(`${API_BASE_URL}/generate-comment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        post_content: postContent,
        tone: elements.tone.value,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    currentComment = data.comment;
    displayComment(currentComment);
    await saveState();
    setStatus('connected', 'Connected');
  } catch (error) {
    console.error('Generation failed:', error);
    setStatus('error', 'Generation failed');
    elements.commentText.textContent = 'Failed to generate comment. Please try again.';
    elements.placeholder.style.display = 'none';
    elements.commentText.style.display = 'block';
  } finally {
    isLoading = false;
    setLoadingState(false);
    elements.btnRegenerate.disabled = false;
  }
}

// Display comment
function displayComment(comment) {
  elements.placeholder.style.display = 'none';
  elements.commentText.textContent = comment;
  elements.commentText.style.display = 'block';
  elements.commentActions.style.display = 'flex';
  currentComment = comment;
}

// Set loading state
function setLoadingState(loading) {
  if (loading) {
    elements.commentBox.classList.add('loading');
    elements.btnCopy.disabled = true;
    elements.btnInsert.disabled = true;
  } else {
    elements.commentBox.classList.remove('loading');
    elements.btnCopy.disabled = false;
    elements.btnInsert.disabled = false;
  }
}

// Copy to clipboard
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    const originalText = elements.btnCopy.innerHTML;
    elements.btnCopy.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      Copied!
    `;
    setTimeout(() => {
      elements.btnCopy.innerHTML = originalText;
    }, 2000);
  } catch (error) {
    console.error('Copy failed:', error);
  }
}

// Insert comment into LinkedIn
async function insertComment(comment) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url.includes('linkedin.com')) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'INSERT_COMMENT',
        comment: comment,
      });
      const originalText = elements.btnInsert.innerHTML;
      elements.btnInsert.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        Inserted!
      `;
      setTimeout(() => {
        elements.btnInsert.innerHTML = originalText;
      }, 2000);
    }
  } catch (error) {
    console.error('Insert failed:', error);
  }
}