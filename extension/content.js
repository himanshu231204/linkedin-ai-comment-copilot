// LinkedIn AI Comment Copilot - Content Script

(function() {
  'use strict';

  // Configuration
  const BUTTON_CLASS = 'ai-comment-copilot-btn';
  const POST_SELECTORS = [
    '.feed-shared-update-v2',
    '.feed-shared-update__description',
    '.occludable-update',
    '[data-urn]',
  ];

  // Observe DOM changes to detect new posts
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length) {
        processNewNodes(mutation.addedNodes);
      }
    });
  });

  // Initialize
  function init() {
    // Process existing posts
    processExistingPosts();
    
    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  // Process existing posts on page
  function processExistingPosts() {
    const posts = findLinkedInPosts();
    posts.forEach(addGenerateButton);
  }

  // Process newly added nodes
  function processNewNodes(nodes) {
    nodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const posts = findLinkedInPostsInElement(node);
        posts.forEach(addGenerateButton);
      }
    });
  }

  // Find all LinkedIn posts on the page
  function findLinkedInPosts() {
    const posts = new Set();
    POST_SELECTORS.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => {
        const post = findParentPost(el);
        if (post) posts.add(post);
      });
    });
    return Array.from(posts);
  }

  // Find LinkedIn posts in a specific element
  function findLinkedInPostsInElement(element) {
    const posts = new Set();
    POST_SELECTORS.forEach((selector) => {
      element.querySelectorAll?.(selector).forEach((el) => {
        const post = findParentPost(el);
        if (post) posts.add(post);
      });
      if (element.matches?.(selector)) {
        const post = findParentPost(element);
        if (post) posts.add(post);
      }
    });
    return Array.from(posts);
  }

  // Find the parent post container
  function findParentPost(element) {
    let current = element;
    while (current && current !== document.body) {
      if (current.classList?.contains('feed-shared-update-v2') ||
          current.getAttribute('data-urn')?.includes('feed')) {
        return current;
      }
      current = current.parentElement;
    }
    return element.closest('[data-urn]') || element;
  }

  // Add generate button to a post
  function addGenerateButton(post) {
    // Check if button already exists
    if (post.querySelector(`.${BUTTON_CLASS}`)) return;

    // Find the action bar (like, comment, share)
    const actionBar = post.querySelector('.feed-shared-update-v2__social-actions') ||
                     post.querySelector('.social-details-social-activity') ||
                     post.querySelector('[class*="social-actions"]');
    
    if (!actionBar) return;

    // Create button
    const button = createGenerateButton();
    
    // Insert button
    actionBar.appendChild(button);
  }

  // Create the generate button element
  function createGenerateButton() {
    const button = document.createElement('button');
    button.className = BUTTON_CLASS;
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
        <path d="M2 17l10 5 10-5"></path>
        <path d="M2 12l10 5 10-5"></path>
      </svg>
      <span>Generate AI Comment</span>
    `;

    // Click handler
    button.addEventListener('click', handleGenerateClick);

    return button;
  }

  // Handle generate button click
  function handleGenerateClick(e) {
    e.preventDefault();
    e.stopPropagation();

    const button = e.currentTarget;
    const post = findParentPost(button);

    if (!post) return;

    // Extract post content
    const postContent = extractPostContent(post);
    
    if (!postContent) {
      showNotification('Could not extract post content', 'error');
      return;
    }

    // Show loading state
    setButtonLoading(button, true);

    // Send message to background script
    chrome.runtime.sendMessage({
      type: 'GENERATE_COMMENT',
      postContent: postContent,
    }, (response) => {
      setButtonLoading(button, false);
      
      if (response?.success) {
        showNotification('Generating comment...', 'success');
      } else {
        showNotification('Failed to start generation', 'error');
      }
    });
  }

  // Extract text content from a post
  function extractPostContent(post) {
    const selectors = [
      '.feed-shared-text__text',
      '.feed-shared-update-v2__commentary',
      '[data-testid="feed-shared-text"]',
      '.share-activity-card__commentary',
    ];

    for (const selector of selectors) {
      const element = post.querySelector(selector);
      if (element) {
        return element.textContent.trim();
      }
    }

    // Fallback: get all text
    return post.textContent.trim().substring(0, 5000);
  }

  // Set button loading state
  function setButtonLoading(button, loading) {
    if (loading) {
      button.classList.add('loading');
      button.disabled = true;
      button.innerHTML = `
        <svg class="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" stroke-dasharray="30 60"></circle>
        </svg>
        <span>Generating...</span>
      `;
    } else {
      button.classList.remove('loading');
      button.disabled = false;
      button.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
          <path d="M2 17l10 5 10-5"></path>
          <path d="M2 12l10 5 10-5"></path>
        </svg>
        <span>Generate AI Comment</span>
      `;
    }
  }

  // Insert comment into LinkedIn comment box
  function insertCommentIntoLinkedIn(comment) {
    // Find the comment input
    const commentInput = document.querySelector('.ql-editor[contenteditable="true"]') ||
                        document.querySelector('[data-placeholder="Add a comment..."]') ||
                        document.querySelector('.comments-comment-box__editor');

    if (commentInput) {
      commentInput.focus();
      commentInput.textContent = comment;
      
      // Trigger input event for LinkedIn to detect change
      const event = new Event('input', { bubbles: true });
      commentInput.dispatchEvent(event);
      
      showNotification('Comment inserted!', 'success');
    } else {
      showNotification('Could not find comment box', 'error');
    }
  }

  // Show notification
  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `ai-comment-notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'INSERT_COMMENT') {
      insertCommentIntoLinkedIn(message.comment);
      sendResponse({ success: true });
    }
    return true;
  });

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();