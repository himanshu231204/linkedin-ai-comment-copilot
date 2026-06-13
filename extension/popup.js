// LinkedIn AI Comment Copilot - Popup Script

const API_BASE_URL = 'http://localhost:8000';
const STORAGE_KEY = 'linkedin_ai_copilot_state';

// ─── Helpers ────────────────────────────────────────────────────────────────

function log(label, ...args) {
  console.log(`[AI Copilot][Popup] ${label}`, ...args);
}

function logError(label, ...args) {
  console.error(`[AI Copilot][Popup] ${label}`, ...args);
}

// ─── DOM References ─────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

const elements = {
  status:        $('status'),
  statusText:    document.querySelector('.status-text'),
  tonePills:     document.querySelectorAll('.tone-pill'),
  postPreview:   $('postPreview'),
  postContent:   $('postContent'),
  commentBox:    $('commentBox'),
  placeholder:   $('placeholder'),
  commentText:   $('commentText'),
  skeleton:      $('skeleton'),
  commentActions:$('commentActions'),
  wordCount:     $('wordCount'),
  btnCopy:       $('btnCopy'),
  btnRegenerate: $('btnRegenerate'),
  btnInsert:     $('btnInsert'),
  toast:         $('toast'),
  toastMessage:  $('toastMessage'),
};

// ─── State ──────────────────────────────────────────────────────────────────

let currentComment = '';
let currentPostContent = '';
let selectedTone = 'professional';
let isLoading = false;

// ─── Init ───────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  log('Popup opened');

  await loadStateFromStorage();
  setupEventListeners();
  checkHealth();
  updateTonePillsUI();
  updatePostPreview(currentPostContent);

  // If we have a persisted comment, show it immediately
  if (currentComment) {
    log('Restoring persisted comment');
    displayComment(currentComment);
  }
});

// ─── Storage ────────────────────────────────────────────────────────────────

async function loadStateFromStorage() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const state = result[STORAGE_KEY];

    if (!state) {
      log('No persisted state found');
      return;
    }

    log('Loaded state from storage', {
      hasComment: !!state.comment,
      hasPost: !!state.postContent,
      tone: state.tone,
      timestamp: state.timestamp ? new Date(state.timestamp).toISOString() : 'none',
    });

    if (state.tone) {
      selectedTone = state.tone;
    }
    if (state.comment) {
      currentComment = state.comment;
    }
    if (state.postContent) {
      currentPostContent = state.postContent;
    }
  } catch (error) {
    logError('Failed to load state', error);
  }
}

async function saveStateToStorage() {
  try {
    const state = {
      tone: selectedTone,
      comment: currentComment,
      postContent: currentPostContent,
      timestamp: Date.now(),
    };
    await chrome.storage.local.set({ [STORAGE_KEY]: state });
    log('State saved to storage');
  } catch (error) {
    logError('Failed to save state', error);
  }
}

// ─── Health Check ───────────────────────────────────────────────────────────

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

function setStatus(status, text) {
  if (!elements.status || !elements.statusText) return;
  elements.status.className = `status ${status}`;
  elements.statusText.textContent = text;
}

// ─── Event Listeners ────────────────────────────────────────────────────────

function setupEventListeners() {
  // Tone pill clicks
  elements.tonePills.forEach(pill => {
    pill.addEventListener('click', () => {
      if (isLoading) return;

      const tone = pill.dataset.tone;
      if (tone === selectedTone) return;

      selectedTone = tone;
      updateTonePillsUI();
      saveStateToStorage();

      // Auto-regenerate if we have post content
      if (currentPostContent) {
        generateComment(currentPostContent);
      }
    });
  });

  // Copy button
  elements.btnCopy?.addEventListener('click', () => {
    copyToClipboard(currentComment);
  });

  // Regenerate button
  elements.btnRegenerate?.addEventListener('click', () => {
    if (currentPostContent) {
      generateComment(currentPostContent);
    }
  });

  // Insert button
  elements.btnInsert?.addEventListener('click', () => {
    insertComment(currentComment);
  });

  // ─── Message Listener ──────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    log('Message received', message.type);

    switch (message.type) {
      case 'COMMENT_GENERATED':
        handleCommentGenerated(message);
        break;

      case 'GENERATE_COMMENT':
        handleExternalGenerate(message);
        break;
    }

    // Return false — we never need to sendResponse from the popup
    return false;
  });
}

// ─── Message Handlers ───────────────────────────────────────────────────────

function handleCommentGenerated(message) {
  log('Comment generated', {
    commentLength: message.comment?.length,
    postLength: message.postContent?.length,
  });

  if (!message.comment) {
    logError('Received empty comment');
    return;
  }

  currentComment = message.comment;
  currentPostContent = message.postContent || currentPostContent;

  displayComment(currentComment);
  updatePostPreview(currentPostContent);
  setStatus('connected', 'Connected');
  saveStateToStorage();
}

function handleExternalGenerate(message) {
  if (message.postContent) {
    currentPostContent = message.postContent;
    updatePostPreview(message.postContent);
    saveStateToStorage();
    generateComment(message.postContent);
  }
}

// ─── UI Updates ─────────────────────────────────────────────────────────────

function updateTonePillsUI() {
  elements.tonePills.forEach(pill => {
    pill.classList.toggle('active', pill.dataset.tone === selectedTone);
  });
}

function updatePostPreview(content) {
  if (!elements.postContent) return;

  if (content && content.trim()) {
    elements.postContent.textContent = content;
    elements.postContent.classList.remove('placeholder-text');
  } else {
    elements.postContent.textContent = 'Click "Generate AI Comment" on any LinkedIn post to get started...';
    elements.postContent.classList.add('placeholder-text');
  }
}

function displayComment(comment) {
  if (!comment) {
    log('displayComment called with empty comment');
    return;
  }

  log('Displaying comment', comment.substring(0, 60) + '...');

  // Hide placeholder
  if (elements.placeholder) {
    elements.placeholder.style.display = 'none';
  }

  // Hide skeleton
  if (elements.skeleton) {
    elements.skeleton.style.display = 'none';
  }

  // Show comment text
  if (elements.commentText) {
    elements.commentText.textContent = comment;
    elements.commentText.classList.add('visible');
  }

  // Show action buttons
  if (elements.commentActions) {
    elements.commentActions.style.display = 'flex';
  }

  // Highlight comment box
  if (elements.commentBox) {
    elements.commentBox.classList.add('active');
  }

  // Update word count
  if (elements.wordCount) {
    const count = comment.split(/\s+/).filter(w => w.length > 0).length;
    elements.wordCount.textContent = `${count} words`;
  }

  currentComment = comment;
}

function setLoadingState(loading) {
  isLoading = loading;

  if (loading) {
    if (elements.placeholder) elements.placeholder.style.display = 'none';
    if (elements.commentText) elements.commentText.classList.remove('visible');
    if (elements.skeleton) elements.skeleton.style.display = 'flex';
    if (elements.commentActions) elements.commentActions.style.display = 'none';
    if (elements.commentBox) elements.commentBox.classList.remove('active');
    if (elements.btnCopy) elements.btnCopy.disabled = true;
    if (elements.btnInsert) elements.btnInsert.disabled = true;
    if (elements.btnRegenerate) elements.btnRegenerate.disabled = true;
  } else {
    if (elements.skeleton) elements.skeleton.style.display = 'none';
    if (elements.btnCopy) elements.btnCopy.disabled = false;
    if (elements.btnInsert) elements.btnInsert.disabled = false;
    if (elements.btnRegenerate) elements.btnRegenerate.disabled = false;
  }
}

// ─── Comment Generation ─────────────────────────────────────────────────────

async function generateComment(postContent) {
  if (isLoading) {
    log('Already loading, skipping');
    return;
  }

  try {
    setLoadingState(true);
    setStatus('loading', 'Generating...');
    document.body.classList.add('generating');

    log('Calling API directly from popup');

    const response = await fetch(`${API_BASE_URL}/generate-comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        post_content: postContent,
        tone: selectedTone,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.comment) {
      throw new Error('API returned empty comment');
    }

    currentComment = data.comment;
    currentPostContent = postContent;
    displayComment(currentComment);
    await saveStateToStorage();
    setStatus('connected', 'Connected');
    log('Comment generated from popup direct call');
  } catch (error) {
    logError('Generation failed', error.message);
    setStatus('error', 'Generation failed');
  } finally {
    setLoadingState(false);
    document.body.classList.remove('generating');
  }
}

// ─── Actions ────────────────────────────────────────────────────────────────

async function copyToClipboard(text) {
  if (!text) {
    showToast('No comment to copy', 'error');
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard!');
  } catch (error) {
    logError('Copy failed', error);
    // Fallback: use execCommand
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showToast('Copied to clipboard!');
    } catch (fallbackError) {
      showToast('Failed to copy', 'error');
    }
  }
}

async function insertComment(comment) {
  if (!comment) {
    showToast('No comment to insert', 'error');
    return;
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      showToast('No active tab', 'error');
      return;
    }

    if (!tab.url?.includes('linkedin.com')) {
      showToast('Open LinkedIn to insert', 'error');
      return;
    }

    await chrome.tabs.sendMessage(tab.id, {
      type: 'INSERT_COMMENT',
      comment,
    });
    showToast('Comment inserted!');
  } catch (error) {
    logError('Insert failed', error);
    showToast('Failed to insert — is the comment box open?', 'error');
  }
}

// ─── Toast ──────────────────────────────────────────────────────────────────

function showToast(message, type = 'success') {
  if (!elements.toast || !elements.toastMessage) return;

  elements.toastMessage.textContent = message;
  elements.toast.className = `toast ${type}`;

  const toastIcon = elements.toast.querySelector('svg');
  if (toastIcon) {
    if (type === 'error') {
      toastIcon.innerHTML = '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>';
      toastIcon.style.color = '#f87171';
    } else {
      toastIcon.innerHTML = '<polyline points="20 6 9 17 4 12"></polyline>';
      toastIcon.style.color = '#4ade80';
    }
  }

  elements.toast.classList.add('show');

  setTimeout(() => {
    elements.toast.classList.remove('show');
  }, 2500);
}
