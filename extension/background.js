// LinkedIn AI Comment Copilot - Background Service Worker

const API_BASE_URL = 'http://localhost:8000';

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GENERATE_COMMENT') {
    handleGenerateComment(message.postContent)
      .then((comment) => sendResponse({ success: true, comment }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }
  
  if (message.type === 'CHECK_HEALTH') {
    checkHealth()
      .then((healthy) => sendResponse({ success: true, healthy }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// Generate comment via API
async function handleGenerateComment(postContent) {
  try {
    const response = await fetch(`${API_BASE_URL}/generate-comment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        post_content: postContent,
        tone: 'professional', // Default tone
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.comment;
  } catch (error) {
    console.error('Generation failed:', error);
    throw error;
  }
}

// Check API health
async function checkHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.ok;
  } catch (error) {
    return false;
  }
}

// Extension install handler
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('LinkedIn AI Comment Copilot installed');
    
    // Set default settings
    chrome.storage.local.set({
      linkedin_ai_copilot_settings: {
        apiBaseURL: API_BASE_URL,
        defaultTone: 'professional',
      },
    });
  }
});