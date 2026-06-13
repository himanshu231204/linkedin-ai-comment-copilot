// LinkedIn AI Comment Copilot - Content Script (MV3)

(function () {
  'use strict';

  // ─── Constants ─────────────────────────────────────────────────────────────

  const LOG_PREFIX = '[AI Copilot][Content]';
  const BUTTON_CLASS = 'ai-comment-copilot-btn';
  const BANNER_CLASS = 'ai-comment-login-banner';
  const NO_POSTS_CLASS = 'ai-comment-no-posts';

  // ─── Logging ───────────────────────────────────────────────────────────────

  function log(label, ...args) {
    console.log(`${LOG_PREFIX} ${label}`, ...args);
  }

  function logWarn(label, ...args) {
    console.warn(`${LOG_PREFIX} ${label}`, ...args);
  }

  function logError(label, ...args) {
    console.error(`${LOG_PREFIX} ${label}`, ...args);
  }

  // ─── URL / Auth Detection ──────────────────────────────────────────────────

  // Pages where post detection is relevant
  const VALID_FEED_PATHS = [
    '/feed/',
    '/feed',
    '/feed/hot-news',
    '/notifications/',
    '/messaging/',
  ];

  const NON_FEED_PATHS = [
    '/login',
    '/checkpoint',
    '/authwall',
    '/signup',
    '/reginsight',
    '/verify',
    '/two-factor',
    '/mynetwork',
    '/jobs/',
    '/learning/',
    '/search/',
    '/settings/',
    '/premium',
  ];

  function getCurrentPath() {
    return window.location.pathname || '/';
  }

  function isFeedPage() {
    const path = getCurrentPath();
    // Explicitly deny non-feed pages
    if (NON_FEED_PATHS.some((p) => path.startsWith(p))) return false;
    // Allow feed pages
    if (VALID_FEED_PATHS.some((p) => path.startsWith(p))) return true;
    // Allow single-post pages (/feed/update/urn:li:...)
    if (path.startsWith('/feed/update/')) return true;
    // Allow profile posts
    if (path.startsWith('/in/') || path.startsWith('/company/')) return true;
    // Allow any /feed/* path (notifications, etc.)
    if (path.startsWith('/feed')) return true;
    // Deny everything else
    return false;
  }

  function isLoginPage() {
    const body = document.body;
    if (!body) return false;

    const bodyText = body.innerText || '';
    const bodyClasses = body.className || '';

    // Detect login / auth wall patterns
    return (
      bodyText.includes('Sign in') ||
      bodyText.includes('Join now') ||
      bodyClasses.includes('login') ||
      bodyClasses.includes('auth') ||
      document.querySelector('input[name="session_key"]') !== null ||
      document.querySelector('input[name="session_password"]') !== null ||
      document.querySelector('[data-tracking-control-name="authwall"]') !== null
    );
  }

  function isLoggedIn() {
    // Strategy 1: Check for known logged-in elements (old + new LinkedIn)
    const positiveSelectors = [
      // Old LinkedIn
      '.global-nav__me',
      '.feed-identity-module',
      'img.global-nav__me-photo',
      '.presence-entity',
      // New LinkedIn (2024-2025)
      '[data-test="viewer-profile-card"]',
      '.feed-shared-update-v2',
      '.global-nav__me-photo',
      '.profile-rail-card__actor-link',
      '.scaffold-layout__main',
      // Navigation that only appears when logged in
      'button[aria-label="My Network"]',
      'button[aria-label="Notifications"]',
      'button[aria-label="Messaging"]',
      'a[href="/mynetwork/"]',
      'a[href="/notifications/"]',
      'a[href="/messaging/"]',
      // Profile section (left sidebar when logged in)
      '.core-rail',
      '[class*="global-nav"]',
    ];

    for (const sel of positiveSelectors) {
      try {
        if (document.querySelector(sel)) {
          log('isLoggedIn: matched selector', sel);
          return true;
        }
      } catch (_) {}
    }

    // Strategy 2: Check for negative signals (definitely NOT logged in)
    if (isLoginPage()) {
      log('isLoggedIn: detected login page');
      return false;
    }

    // Strategy 3: Heuristic — if there are many interactive elements, probably logged in
    const buttons = document.querySelectorAll('button').length;
    const links = document.querySelectorAll('a[href]').length;
    const totalInteractive = buttons + links;
    log('isLoggedIn: interactive elements', totalInteractive);

    // Logged-out LinkedIn has very few buttons/links
    // Logged-in LinkedIn has 50+ interactive elements
    if (totalInteractive > 30) {
      log('isLoggedIn: heuristic — many interactive elements, likely logged in');
      return true;
    }

    // Strategy 4: Check page title and meta
    const title = document.title || '';
    if (title.includes('LinkedIn') && !title.includes('Login') && !title.includes('Sign')) {
      // Page title suggests logged-in state but not definitive
      log('isLoggedIn: title suggests logged-in but not confirmed');
    }

    log('isLoggedIn: all checks failed');
    return false;
  }

  // ─── Selectors ─────────────────────────────────────────────────────────────

  // LinkedIn feed post selectors (2025-2026)
  // LinkedIn uses CSS-in-JS with hashed class names that change every deploy.
  // We use stable data attributes and semantic selectors instead.
  const POST_SELECTORS = [
    // Primary: stable data attributes (survives class name changes)
    '[data-view-name="feed-full-update"]',
    '[data-view-name*="feed-update"]',
    '[data-view-name*="update"]',

    // Home feed posts use componentkey attribute
    'div[componentkey*="FeedType"]',
    'div[componentkey*="feed"]',

    // Semantic ARIA/role selectors
    '[role="listitem"]',
    '[data-testid*="feed"]',
    '[data-testid*="post"]',

    // Legacy class-based (still works on some LinkedIn versions)
    'li.feed-item',
    'li[class*="feed-item"]',
    '.feed-shared-update-v2',
    'article',
  ];

  const ACTION_BAR_SELECTORS = [
    // LinkedIn 2025-2026: stable attributes
    '[data-view-name*="social"]',
    '[data-view-name*="action"]',
    '[data-testid*="social"]',
    '[data-testid*="reaction"]',
    '.social-action-bar',
    '[class*="social-action-bar"]',
    // Legacy
    '.feed-shared-update-v2__social-actions',
    '.social-details-social-activity',
    '[class*="social-actions"]',
    '[class*="reactions-bar"]',
  ];

  const CONTENT_SELECTORS = [
    // LinkedIn 2025-2026: stable data attributes
    '[data-testid="expandable-text-box"]',
    '[data-view-name="feed-commentary"]',
    '[data-view-name*="text"]',
    // LinkedIn 2025 class-based (may still work)
    '.attributed-text-segment-list__content',
    '[class*="attributed-text-segment-list"]',
    // Legacy
    '.feed-shared-text__text',
    '.feed-shared-update-v2__commentary',
    '[data-testid="feed-shared-text"]',
    '.update-components-text',
    '[class*="update-components-text"]',
    '[class*="feed-shared-text"]',
    '.feed-shared-inline-show-more-text',
  ];

  // ─── State ─────────────────────────────────────────────────────────────────

  // Track the CURRENT post being operated on — saved when Generate is clicked,
  // used when Insert Comment is clicked
  let currentPostElement = null;

  let state = {
    url: window.location.href,
    loggedIn: false,
    isFeedPage: false,
    loginBannerShown: false,
    noPostsBannerShown: false,
    postsFound: 0,
    buttonsFound: 0,
    contentScriptLoaded: true,
    scanCount: 0,
    lastScanTime: null,
  };

  // ─── DOM Observer ──────────────────────────────────────────────────────────

  const observer = new MutationObserver((mutations) => {
    const hasNewNodes = mutations.some((m) => m.addedNodes.length > 0);
    const hasRemovedButtons = mutations.some((m) => {
      return Array.from(m.removedNodes).some((node) => {
        if (node.nodeType !== 1) return false;
        return node.classList?.contains(BUTTON_CLASS) ||
               node.querySelector?.(`.${BUTTON_CLASS}`);
      });
    });
    if (hasNewNodes || hasRemovedButtons) {
      debounce(runScan, 800);
    }
  });

  let debounceTimer = null;
  function debounce(fn, delay) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fn, delay);
  }

  // ─── Init ──────────────────────────────────────────────────────────────────

  function init() {
    state.url = window.location.href;
    state.loggedIn = isLoggedIn();
    state.isFeedPage = isFeedPage();

    log('Initializing content script');
    log('URL:', state.url);
    log('Logged in:', state.loggedIn);
    log('Feed page:', state.isFeedPage);

    // Check if we should even be running
    if (!state.loggedIn) {
      log('User not logged in — showing login banner');
      showLoginBanner();
      return;
    }

    if (!state.isFeedPage) {
      log('Not a feed page — skipping post detection');
      log('Supported pages:', VALID_FEED_PATHS.join(', '));
      return;
    }

    // All clear — start scanning
    runScan();

    // Observe DOM changes for dynamically loaded posts
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Periodic scan for LinkedIn's virtualized feed
    setInterval(() => {
      runScan();
      updateState();
    }, 3000);

    // Listen for SPA navigation
    setInterval(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== state.url) {
        log('URL changed, re-initializing', currentUrl);
        state.url = currentUrl;
        state.isFeedPage = isFeedPage();
        state.loggedIn = isLoggedIn();

        if (state.isFeedPage && state.loggedIn) {
          runScan();
        } else if (!state.loggedIn) {
          showLoginBanner();
        }
      }
    }, 2000);

    log('Ready');
  }

  // ─── State Tracking ────────────────────────────────────────────────────────

  function updateState() {
    const posts = findLinkedInPosts();
    const buttons = document.querySelectorAll(`.${BUTTON_CLASS}`);

    state.postsFound = posts.length;
    state.buttonsFound = buttons.length;
    state.lastScanTime = new Date().toISOString();
    state.scanCount++;
  }

  // ─── Post Processing ───────────────────────────────────────────────────────

  function runScan() {
    state.loggedIn = isLoggedIn();
    state.isFeedPage = isFeedPage();

    if (!state.loggedIn) {
      showLoginBanner();
      return;
    }

    hideLoginBanner();

    if (!state.isFeedPage) {
      return;
    }

    // DOM structure dump (first scan only)
    if (state.scanCount === 0) {
      log('=== FULL DOM DIAGNOSTIC ===');

      // 1. Check all post selectors and log results
      log('--- Post Selector Results ---');
      const allSelectors = [
        '[data-view-name="feed-full-update"]',
        '[data-view-name*="feed-update"]',
        '[data-view-name*="update"]',
        'div[componentkey*="FeedType"]',
        'div[componentkey*="feed"]',
        '[role="listitem"]',
        '[data-testid*="feed"]',
        '[data-testid*="post"]',
        'li.feed-item',
        'li[class*="feed-item"]',
        '.feed-shared-update-v2',
        'article',
      ];
      allSelectors.forEach(sel => {
        try {
          const count = document.querySelectorAll(sel).length;
          log(`  ${sel}: ${count}`);
        } catch (e) {
          log(`  ${sel}: ERROR`);
        }
      });

      // 2. Check action bar selectors
      log('--- Action Bar Selectors ---');
      const actionSelectors = [
        '[data-view-name*="social"]',
        '[data-view-name*="action"]',
        '[data-testid*="social"]',
        '.social-action-bar',
        '[class*="social-action-bar"]',
      ];
      actionSelectors.forEach(sel => {
        try {
          const count = document.querySelectorAll(sel).length;
          if (count > 0) log(`  ${sel}: ${count}`);
        } catch (_) {}
      });

      // 3. Check content selectors
      log('--- Content Selectors ---');
      const contentSelectors = [
        '[data-testid="expandable-text-box"]',
        '[data-view-name="feed-commentary"]',
        '.attributed-text-segment-list__content',
      ];
      contentSelectors.forEach(sel => {
        try {
          const count = document.querySelectorAll(sel).length;
          if (count > 0) log(`  ${sel}: ${count}`);
        } catch (_) {}
      });

      // 4. Check all data-view-name attributes
      log('--- data-view-name Attributes ---');
      const viewNameEls = document.querySelectorAll('[data-view-name]');
      const viewNames = new Map();
      viewNameEls.forEach(el => {
        const name = el.getAttribute('data-view-name');
        viewNames.set(name, (viewNames.get(name) || 0) + 1);
      });
      [...viewNames.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([name, count]) => {
        log(`  ${name}: ${count}`);
      });

      // 5. Check componentkey attributes
      log('--- componentkey Attributes ---');
      const ckEls = document.querySelectorAll('[componentkey]');
      log(`  Total: ${ckEls.length}`);
      const ckPatterns = new Map();
      ckEls.forEach(el => {
        const ck = el.getAttribute('componentkey') || '';
        const pattern = ck.replace(/\d+/g, 'N').substring(0, 60);
        ckPatterns.set(pattern, (ckPatterns.get(pattern) || 0) + 1);
      });
      [...ckPatterns.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([pattern, count]) => {
        log(`  ${pattern}: ${count}`);
      });

      // 6. Social buttons
      log('--- Social Buttons ---');
      const allButtons = Array.from(document.querySelectorAll('button'));
      const socialBtns = allButtons.filter(btn => {
        const text = (btn.textContent || '').toLowerCase();
        const label = (btn.getAttribute('aria-label') || '').toLowerCase();
        return text.includes('like') || text.includes('comment') || text.includes('share') ||
               label.includes('like') || label.includes('comment') || label.includes('share');
      });
      log(`  Total social buttons: ${socialBtns.length}`);
      socialBtns.slice(0, 3).forEach((btn, i) => {
        const parentChain = [];
        let p = btn.parentElement;
        for (let k = 0; k < 5 && p && p !== document.body; k++) {
          const attrs = [];
          if (p.getAttribute('data-view-name')) attrs.push(`data-view-name="${p.getAttribute('data-view-name')}"`);
          if (p.getAttribute('componentkey')) attrs.push(`componentkey="${p.getAttribute('componentkey')?.substring(0, 40)}"`);
          if (p.getAttribute('role')) attrs.push(`role="${p.getAttribute('role')}"`);
          parentChain.push(`${p.tagName}${attrs.length ? ' [' + attrs.join(', ') + ']' : ''}`);
          p = p.parentElement;
        }
        log(`  [${i}] "${btn.textContent?.trim().substring(0, 20)}" → ${parentChain.join(' → ')}`);
      });

      log('=== END DIAGNOSTIC ===');
    }

    const posts = findLinkedInPosts();
    let injected = 0;

    posts.forEach((post) => {
      if (addGenerateButton(post)) {
        injected++;
      }
    });

    state.postsFound = posts.length;
    state.buttonsFound = document.querySelectorAll(`.${BUTTON_CLASS}`).length;

    log(
      `Scan complete: ${posts.length} posts, ${injected} new buttons, ` +
        `${state.buttonsFound} total buttons`
    );

    // Show "no posts" hint if needed
    if (posts.length === 0) {
      showNoPostsHint();
    } else {
      hideNoPostsHint();
    }
  }

  // Track processed action bars to prevent duplicate buttons
  const processedActionBars = new WeakSet();

  function findLinkedInPosts() {
    const posts = new Set();

    log('--- Post Detection Scan ---');

    // Strategy 1: Find social buttons (Like/Comment/Share), walk up to action bar,
    // then walk up to post container. This bypasses LinkedIn's obfuscated DOM entirely.
    const allButtons = Array.from(document.querySelectorAll('button'));
    const socialButtonLabels = ['like', 'comment', 'share', 'repost', 'send'];

    const actionBars = new Set();
    allButtons.forEach((btn) => {
      const text = (btn.textContent || '').toLowerCase().trim();
      const label = (btn.getAttribute('aria-label') || '').toLowerCase();
      const isSocial = socialButtonLabels.some(s => text === s || label.includes(s));
      if (!isSocial) return;

      // Walk up to find the action bar container (the div holding Like/Comment/Share)
      let bar = btn.parentElement;
      for (let i = 0; i < 5 && bar && bar !== document.body; i++) {
        const btns = bar.querySelectorAll('button');
        if (btns.length >= 2 && btns.length <= 8) {
          actionBars.add(bar);
          break;
        }
        bar = bar.parentElement;
      }
    });

    log(`Found ${actionBars.size} action bars`);

    // For each action bar, find the post container using multiple heuristics
    actionBars.forEach((bar) => {
      // CRITICAL: Skip if this action bar was already processed
      if (processedActionBars.has(bar)) return;

      const post = findPostFromActionBar(bar);
      if (!post) return;

      // Skip if this post already has a button
      if (post.querySelector(`.${BUTTON_CLASS}`)) return;

      // Mark this action bar as processed
      processedActionBars.add(bar);

      // Add to posts set
      posts.add(post);
    });

    log(`Strategy 1 (action bars): found ${posts.size} posts`);

    // Strategy 2: Try selector-based detection as fallback (only if Strategy 1 found nothing)
    if (posts.size === 0) {
      log('Strategy 1 found nothing, trying selector-based detection');
      POST_SELECTORS.forEach((selector) => {
        try {
          const matches = document.querySelectorAll(selector);
          if (matches.length > 0) {
            log(`Selector "${selector}" matched ${matches.length} elements`);
          }
          matches.forEach((el) => {
            const rect = el.getBoundingClientRect();
            if (rect.width < 100 || rect.height < 30) return;

            const post = findPostContainer(el);
            if (post && !post.querySelector(`.${BUTTON_CLASS}`)) {
              posts.add(post);
            }
          });
        } catch (e) {
          // Invalid selector — skip silently
        }
      });
      log(`Strategy 2 (selectors): found ${posts.size} posts`);
    }

    return Array.from(posts);
  }

  /**
   * Find the post container starting from an action bar element.
   * Uses multiple heuristics to handle LinkedIn's obfuscated and virtualized DOM.
   */
  function findPostFromActionBar(bar) {
    let post = bar.parentElement;

    for (let i = 0; i < 15 && post && post !== document.body; i++) {
      // Must contain the action bar
      if (!post.contains(bar)) break;

      // Heuristic 1: Check for article element (LinkedIn posts always have one)
      if (post.querySelector('article')) {
        return post;
      }

      // Heuristic 2: Check for data-view-name with feed-related values
      const viewName = post.getAttribute('data-view-name') || '';
      if (viewName.includes('feed') || viewName.includes('update')) {
        return post;
      }

      // Heuristic 3: Check for componentkey with FeedType
      const componentkey = post.getAttribute('componentkey') || '';
      if (componentkey.includes('FeedType') || componentkey.includes('feed')) {
        return post;
      }

      // Heuristic 4: Check for role="listitem"
      if (post.getAttribute('role') === 'listitem') {
        return post;
      }

      // Heuristic 5: Check for LinkedIn-specific class patterns
      const className = post.className || '';
      if (className.includes('feed-shared') ||
          className.includes('reusable-feed') ||
          className.includes('share-activity') ||
          className.includes('feed-item')) {
        return post;
      }

      // Heuristic 6: Check for data-urn (LinkedIn activity IDs)
      const urn = post.getAttribute('data-urn') || '';
      if (urn.includes('feed') || urn.includes('activity') || urn.includes('share')) {
        return post;
      }

      // Heuristic 7: Size + content check (less strict than before)
      const rect = post.getBoundingClientRect();
      const hasText = (post.innerText || '').length > 50;
      if (rect.width > 200 && rect.height > 50 && hasText) {
        // Additional check: must not be a small nested element
        // Verify it's a top-level post container by checking it's not inside another post
        if (!post.closest(`.${BUTTON_CLASS}`)) {
          return post;
        }
      }

      post = post.parentElement;
    }

    return null;
  }

  /**
   * Legacy findPostContainer for selector-based detection.
   * Walks up from a matched element to find the post container.
   */
  function findPostContainer(element) {
    let current = element;

    for (let i = 0; i < 20; i++) {
      if (!current || current === document.body) break;

      // LinkedIn 2025-2026: data-view-name or componentkey
      if (current.getAttribute?.('data-view-name')?.includes('feed') ||
          current.getAttribute?.('data-view-name')?.includes('update') ||
          current.getAttribute?.('componentkey')?.includes('FeedType') ||
          current.getAttribute?.('role') === 'listitem') {
        return current;
      }

      // LinkedIn 2025: LI.feed-item
      if (current.tagName === 'LI' && current.className?.includes('feed-item')) {
        return current;
      }

      // Legacy: data-urn based
      const urn = current.getAttribute('data-urn');
      if (urn && (urn.includes('feed') || urn.includes('activity') || urn.includes('share'))) {
        return current;
      }

      // Legacy: class-based
      if (
        current.classList?.contains('feed-shared-update-v2') ||
        current.classList?.contains('reusable-feed__post') ||
        current.classList?.contains('share-activity-card')
      ) {
        return current;
      }

      current = current.parentElement;
    }

    // Fallback: try to find the closest post-like element
    return (
      element.closest('[data-view-name*="feed"]') ||
      element.closest('[componentkey*="FeedType"]') ||
      element.closest('[role="listitem"]') ||
      element.closest('li[class*="feed-item"]') ||
      element.closest('article') ||
      element.closest('[data-urn]') ||
      element
    );
  }

  function findActionBar(post) {
    // Strategy 1: Look inside the post container
    for (const selector of ACTION_BAR_SELECTORS) {
      const bar = post.querySelector(selector);
      if (bar) return bar;
    }

    // Strategy 2: LinkedIn 2025 — action bar may be a sibling of the article
    // Look at the post's parent for social-action-bar
    if (post.parentElement) {
      for (const selector of ACTION_BAR_SELECTORS) {
        const bar = post.parentElement.querySelector(selector);
        if (bar) return bar;
      }
    }

    // Strategy 3: Find by button pattern (Like/Comment/Share)
    const allButtons = Array.from(post.querySelectorAll('button'));
    const socialButtons = allButtons.filter((btn) => {
      const text = (btn.textContent || '').toLowerCase();
      const label = (btn.getAttribute('aria-label') || '').toLowerCase();
      return (
        text.includes('like') ||
        text.includes('comment') ||
        text.includes('share') ||
        text.includes('send') ||
        label.includes('like') ||
        label.includes('comment') ||
        label.includes('share')
      );
    });

    if (socialButtons.length > 0) {
      return (
        socialButtons[0].parentElement?.parentElement ||
        socialButtons[0].parentElement
      );
    }

    // Strategy 4: Fallback — find div with 2-6 buttons (action bar pattern)
    const divs = post.querySelectorAll('div');
    for (const div of divs) {
      const buttons = div.querySelectorAll('button');
      if (buttons.length >= 2 && buttons.length <= 6) {
        return div;
      }
    }

    return null;
  }

  // ─── Button Injection ──────────────────────────────────────────────────────

  function addGenerateButton(post) {
    // CRITICAL: Check if button already exists ANYWHERE in this post
    if (post.querySelector(`.${BUTTON_CLASS}`)) return false;

    // Try to find action bar within the post
    let actionBar = findActionBar(post);

    // If not found within post, check parent (LinkedIn 2025 structure)
    if (!actionBar && post.parentElement) {
      actionBar = findActionBar(post.parentElement);
    }

    // If still not found, look for social buttons and walk up
    if (!actionBar) {
      const allButtons = Array.from(post.querySelectorAll('button'));
      const socialBtns = allButtons.filter((btn) => {
        const text = (btn.textContent || '').toLowerCase().trim();
        const label = (btn.getAttribute('aria-label') || '').toLowerCase();
        return ['like', 'comment', 'share', 'repost', 'send'].some(
          s => text === s || label.includes(s)
        );
      });

      if (socialBtns.length > 0) {
        // Walk up from first social button to find action bar container
        let bar = socialBtns[0].parentElement;
        for (let i = 0; i < 5 && bar && bar !== document.body; i++) {
          const btns = bar.querySelectorAll('button');
          if (btns.length >= 2 && btns.length <= 8) {
            actionBar = bar;
            break;
          }
          bar = bar.parentElement;
        }
      }
    }

    if (!actionBar) {
      logWarn('addGenerateButton: no action bar found in post');
      return false;
    }

    // FINAL GUARD: Check if this specific action bar already has a button
    if (actionBar.querySelector(`.${BUTTON_CLASS}`)) return false;

    const button = createButton();
    actionBar.insertBefore(button, actionBar.firstChild);
    log('Button injected into action bar');
    return true;
  }

  function createButton() {
    const button = document.createElement('button');
    button.className = BUTTON_CLASS;
    button.setAttribute('type', 'button');
    button.setAttribute('aria-label', 'Generate AI comment');
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
        <path d="M2 17l10 5 10-5"></path>
        <path d="M2 12l10 5 10-5"></path>
      </svg>
      <span>Generate AI Comment</span>
    `;
    button.title = 'Generate AI comment';

    // Use capturing phase (true) to fire BEFORE LinkedIn's handlers
    button.addEventListener('click', handleButtonClick, true);

    // Fallback: also listen for pointerdown in case LinkedIn blocks click events
    button.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Manually fire the click handler
      handleButtonClick(e);
    }, true);

    return button;
  }

  // ─── Click Handler ─────────────────────────────────────────────────────────

  function handleButtonClick(e) {
    try {
      e.preventDefault();
      e.stopPropagation();
    } catch (_) {
      // Event may already be prevented — continue
    }

    const button = e.currentTarget || e.target?.closest?.(`.${BUTTON_CLASS}`);
    if (!button) {
      logError('handleButtonClick: could not find button element');
      return;
    }

    log('Button clicked!');

    // Find post container — try multiple strategies
    let post = null;

    // Strategy 1: Walk up from button to find action bar, then post
    let actionBar = button.parentElement;
    for (let i = 0; i < 5 && actionBar && actionBar !== document.body; i++) {
      const btns = actionBar.querySelectorAll('button');
      if (btns.length >= 2 && btns.length <= 8) {
        post = findPostFromActionBar(actionBar);
        break;
      }
      actionBar = actionBar.parentElement;
    }

    // Strategy 2: Walk up directly from button
    if (!post) {
      post = findPostContainer(button);
    }

    if (!post) {
      logError('Could not find post container for button');
      showNotification('Could not find post', 'error');
      return;
    }

    log('Found post container:', post.tagName, post.className?.substring(0, 50));

    // SAVE the post reference so Insert Comment knows which post to target
    currentPostElement = post;

    const content = extractContent(post);

    if (!content || content.length < 20) {
      logError('Post content too short or empty:', content?.length || 0);
      showNotification(
        'Could not read post content. Try clicking on the post first.',
        'error'
      );
      return;
    }

    log('Button clicked — post content length:', content.length, 'preview:', content.substring(0, 80));
    setLoading(button, true);
    showNotification('Generating comment...', 'info');

    // Check if extension context is still valid
    if (!chrome.runtime?.id) {
      logError('Extension context invalidated — please reload the extension');
      setLoading(button, false);
      showNotification(
        'Extension context invalidated — please reload the extension and refresh LinkedIn',
        'error'
      );
      return;
    }

    log('Sending GENERATE_COMMENT message to background...');

    chrome.runtime.sendMessage(
      {
        type: 'GENERATE_COMMENT',
        postContent: content,
      },
      (response) => {
        log('Response received from background:', response ? 'yes' : 'no', response);

        setLoading(button, false);

        if (chrome.runtime.lastError) {
          logError('sendMessage failed', chrome.runtime.lastError.message);
          showNotification(
            'Extension error — please reload the extension and refresh LinkedIn',
            'error'
          );
          return;
        }

        if (!response) {
          log('No response from background — popup may need to be opened');
          showNotification(
            'Request sent! Check the extension popup for your comment.',
            'success'
          );
          return;
        }

        if (response.success && response.comment) {
          log('Comment received:', response.comment);
          showCommentNotification(response.comment);
          navigator.clipboard.writeText(response.comment).catch(() => {
            log('Clipboard write failed — user may need to grant permission');
          });
        } else {
          logError('Generation failed:', response.error);
          showNotification(
            'Failed: ' + (response.error || 'Unknown error'),
            'error'
          );
        }
      }
    );
  }

  // ─── Content Extraction ────────────────────────────────────────────────────

  function extractContent(post) {
    let content = '';

    // Strategy 1: Known selectors
    for (const selector of CONTENT_SELECTORS) {
      try {
        const el = post.querySelector(selector);
        if (el) {
          const text = el.innerText?.trim() || el.textContent?.trim();
          if (text && text.length > 20) {
            content = text;
            break;
          }
        }
      } catch (e) {
        // Skip
      }
    }

    // Strategy 2: LinkedIn text containers (span[dir="auto"])
    if (!content) {
      const spans = post.querySelectorAll('span[dir="auto"]');
      const texts = [];
      spans.forEach((span) => {
        const t = span.innerText?.trim();
        if (t && t.length > 10 && !isUIElement(t)) {
          texts.push(t);
        }
      });
      if (texts.length > 0) {
        content = texts.join(' ');
      }
    }

    // Strategy 3: Paragraph elements
    if (!content) {
      const paragraphs = post.querySelectorAll('p');
      const texts = [];
      paragraphs.forEach((p) => {
        const t = p.innerText?.trim();
        if (t && t.length > 10 && !isUIElement(t)) {
          texts.push(t);
        }
      });
      if (texts.length > 0) {
        content = texts.join(' ');
      }
    }

    // Strategy 4: All text, filtered
    if (!content) {
      const allText = post.innerText;
      const lines = allText.split('\n').filter((line) => {
        const t = line.trim();
        return t.length > 15 && !isUIElement(t);
      });
      content = lines.join(' ');
    }

    return content.replace(/\s+/g, ' ').trim().substring(0, 5000);
  }

  function isUIElement(text) {
    const lower = text.toLowerCase();
    const uiPatterns = [
      'like', 'comment', 'share', 'send', 'repost',
      'follow', 'connect', 'see more', 'show less',
      'react', 'reply', 'views', 'reactions',
      'comments', 'reposts', 'followed', 'endorsed',
      'promoted', 'sponsored',
    ];
    return uiPatterns.some(
      (p) => lower === p || lower.startsWith(p + ' ')
    );
  }

  // ─── UI: Login Banner ──────────────────────────────────────────────────────

  function showLoginBanner() {
    if (state.loginBannerShown) return;
    state.loginBannerShown = true;

    // Remove any existing banner first
    removeBanner(BANNER_CLASS);

    const banner = document.createElement('div');
    banner.className = BANNER_CLASS;
    banner.setAttribute('role', 'alert');
    banner.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 99999;
        background: linear-gradient(135deg, #0077b5 0%, #005885 100%);
        color: white;
        padding: 14px 20px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        text-align: center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
      ">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <span>
          <strong>AI Comment Copilot:</strong> Please sign in to LinkedIn and open the Feed page.
        </span>
        <button id="ai-copilot-dismiss-login" style="
          background: rgba(255,255,255,0.2);
          border: 1px solid rgba(255,255,255,0.4);
          color: white;
          padding: 4px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
        ">Dismiss</button>
      </div>
    `;

    document.body.appendChild(banner);
    // CSP-safe: use event listener instead of inline onclick
    const dismissBtn = banner.querySelector('#ai-copilot-dismiss-login');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => banner.remove());
    }
    log('Login banner displayed');
  }

  function hideLoginBanner() {
    removeBanner(BANNER_CLASS);
    state.loginBannerShown = false;
  }

  // ─── UI: No Posts Hint ─────────────────────────────────────────────────────

  function showNoPostsHint() {
    // Only show if we've done at least 3 scans and still no posts
    // This prevents false alarms during page load
    if (state.noPostsBannerShown) return;
    if (state.scanCount < 3) return;

    state.noPostsBannerShown = true;

    removeBanner(NO_POSTS_CLASS);

    const hint = document.createElement('div');
    hint.className = NO_POSTS_CLASS;
    hint.setAttribute('role', 'status');
    hint.innerHTML = `
      <div style="
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 99999;
        background: #1b1f23;
        color: #e1e5e9;
        padding: 14px 20px;
        border-radius: 10px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.3);
        max-width: 320px;
        display: flex;
        align-items: flex-start;
        gap: 10px;
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f5c75d" stroke-width="2" style="flex-shrink:0;margin-top:1px" aria-hidden="true">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
        <div>
          <div>No LinkedIn feed posts detected.</div>
          <div style="margin-top:4px;color:#8b949e;font-size:12px">
            Open <strong>linkedin.com/feed</strong> while logged in.
          </div>
        </div>
        <button id="ai-copilot-dismiss-hint" style="
          background: transparent;
          border: none;
          color: #8b949e;
          cursor: pointer;
          font-size: 16px;
          line-height: 1;
          padding: 0 2px;
          margin-left: 4px;
        " aria-label="Dismiss">&times;</button>
      </div>
    `;

    document.body.appendChild(hint);
    // CSP-safe: use event listener instead of inline onclick
    const dismissHint = hint.querySelector('#ai-copilot-dismiss-hint');
    if (dismissHint) {
      dismissHint.addEventListener('click', () => {
        hint.remove();
        state.noPostsBannerShown = false;
      });
    }
    log('No posts hint displayed');

    // Auto-dismiss after 8s
    setTimeout(() => {
      if (hint.parentElement) {
        hint.remove();
        state.noPostsBannerShown = false;
      }
    }, 8000);
  }

  function hideNoPostsHint() {
    removeBanner(NO_POSTS_CLASS);
    state.noPostsBannerShown = false;
  }

  function removeBanner(className) {
    document.querySelectorAll(`.${className}`).forEach((el) => el.remove());
  }

  // ─── UI: Notification ──────────────────────────────────────────────────────

  function showNotification(message, type = 'info') {
    document.querySelectorAll('.ai-comment-notification').forEach((n) => n.remove());

    const notification = document.createElement('div');
    notification.className = `ai-comment-notification ${type}`;
    notification.setAttribute('role', 'status');
    notification.setAttribute('aria-live', 'polite');
    notification.style.cssText = `
      position: fixed;
      bottom: 80px;
      right: 20px;
      z-index: 2147483647;
      background: ${type === 'error' ? '#cf222e' : type === 'success' ? '#1a7f37' : '#0077b5'};
      color: white;
      padding: 12px 18px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.25);
      max-width: 360px;
      opacity: 0;
      transform: translateY(10px);
      transition: opacity 0.2s, transform 0.2s;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    requestAnimationFrame(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateY(0)';
    });

    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateY(10px)';
      setTimeout(() => notification.remove(), 300);
    }, 4000);
  }

  /**
   * Show the generated comment in a prominent, copyable card.
   * This is the PRIMARY way users see the AI-generated comment.
   */
  function showCommentNotification(comment) {
    // Remove any existing comment notifications
    document.querySelectorAll('.ai-comment-card').forEach((n) => n.remove());

    const card = document.createElement('div');
    card.className = 'ai-comment-card';
    card.setAttribute('role', 'alert');
    card.setAttribute('aria-live', 'assertive');
    card.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 2147483647;
      background: #ffffff;
      color: #191919;
      padding: 0;
      border-radius: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.08);
      max-width: 420px;
      width: 420px;
      overflow: hidden;
      opacity: 0;
      transform: translateY(20px);
      transition: opacity 0.3s, transform 0.3s;
    `;

    const wordCount = comment.split(/\s+/).filter(w => w.length > 0).length;

    card.innerHTML = `
      <div style="
        background: linear-gradient(135deg, #0a66c2 0%, #004182 100%);
        color: white;
        padding: 12px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      ">
        <div style="display:flex;align-items:center;gap:8px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
            <path d="M2 17l10 5 10-5"></path>
            <path d="M2 12l10 5 10-5"></path>
          </svg>
          <span style="font-weight:600;font-size:13px;">AI Comment Generated</span>
        </div>
        <span style="font-size:11px;opacity:0.8;">${wordCount} words · Copied to clipboard</span>
      </div>
      <div style="padding:16px;">
        <div id="ai-comment-text" style="
          line-height: 1.5;
          color: #191919;
          white-space: pre-wrap;
          word-wrap: break-word;
          max-height: 150px;
          overflow-y: auto;
          margin-bottom: 12px;
        ">${comment}</div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button id="ai-comment-copy" style="
            background: #0a66c2;
            color: white;
            border: none;
            padding: 6px 14px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s;
          ">Copy</button>
          <button id="ai-comment-insert" style="
            background: #1a7f37;
            color: white;
            border: none;
            padding: 6px 14px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s;
          ">Insert Comment</button>
          <button id="ai-comment-dismiss" style="
            background: transparent;
            color: #666;
            border: 1px solid #ddd;
            padding: 6px 14px;
            border-radius: 6px;
            font-size: 12px;
            cursor: pointer;
            transition: background 0.2s;
          ">✕</button>
        </div>
      </div>
    `;

    document.body.appendChild(card);

    // Animate in
    requestAnimationFrame(() => {
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    });

    // Copy button
    card.querySelector('#ai-comment-copy').addEventListener('click', () => {
      navigator.clipboard.writeText(comment).then(() => {
        const copyBtn = card.querySelector('#ai-comment-copy');
        copyBtn.textContent = 'Copied!';
        copyBtn.style.background = '#1a7f37';
        setTimeout(() => {
          copyBtn.textContent = 'Copy';
          copyBtn.style.background = '#0a66c2';
        }, 2000);
      });
    });

    // Insert button — opens LinkedIn comment box and pastes
    card.querySelector('#ai-comment-insert').addEventListener('click', () => {
      // Use the saved post reference from when Generate was clicked
      insertCommentIntoLinkedIn(comment, currentPostElement);
      const insertBtn = card.querySelector('#ai-comment-insert');
      insertBtn.textContent = 'Inserted!';
      setTimeout(() => {
        insertBtn.textContent = 'Insert Comment';
      }, 2000);
    });

    // Dismiss button
    card.querySelector('#ai-comment-dismiss').addEventListener('click', () => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(20px)';
      setTimeout(() => card.remove(), 300);
    });

    // Auto-dismiss after 60 seconds
    setTimeout(() => {
      if (card.parentElement) {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        setTimeout(() => card.remove(), 300);
      }
    }, 60000);
  }

  /**
   * Insert comment into LinkedIn's comment box.
   * Uses polling to wait for the comment box to appear after clicking.
   * @param {string} comment - The comment text to insert
   * @param {Element|null} postElement - The specific post to insert into (scoped)
   */
  function insertCommentIntoLinkedIn(comment, postElement) {
    // Step 1: Find and click the Comment button to open the comment box
    let commentBtn = null;

    if (postElement) {
      // Find the Comment button WITHIN this specific post
      const buttons = postElement.querySelectorAll('button');
      commentBtn = Array.from(buttons).find(btn => {
        const text = (btn.textContent || '').toLowerCase().trim();
        const label = (btn.getAttribute('aria-label') || '').toLowerCase();
        return (text === 'comment' || label === 'comment' ||
               (text.includes('comment') && !text.includes('generate'))) &&
               !btn.classList.contains(BUTTON_CLASS);
      });
    }

    // Fallback: find on the whole page if scoped search failed
    if (!commentBtn) {
      const commentTriggers = Array.from(document.querySelectorAll('button'));
      commentBtn = commentTriggers.find(btn => {
        const text = (btn.textContent || '').toLowerCase().trim();
        const label = (btn.getAttribute('aria-label') || '').toLowerCase();
        return (text === 'comment' || label === 'comment' ||
               (text.includes('comment') && !text.includes('generate'))) &&
               !btn.classList.contains(BUTTON_CLASS);
      });
    }

    if (!commentBtn) {
      showNotification('Click the Comment button first, then try Insert', 'error');
      return;
    }

    // SNAPSHOT: Record all existing comment boxes BEFORE clicking
    const existingBoxes = new Set(
      document.querySelectorAll('[contenteditable="true"]')
    );

    commentBtn.click();
    showNotification('Opening comment box...', 'info');

    // Step 2: Poll for the NEWLY OPENED comment box
    let attempts = 0;
    const maxAttempts = 20; // 2 seconds total

    const commentBoxSelectors = [
      '.ql-editor[contenteditable="true"]',
      '[contenteditable="true"][data-placeholder*="comment" i]',
      '[contenteditable="true"][aria-placeholder*="comment" i]',
      '.comments-comment-box__form [contenteditable="true"]',
      '.comment-form [contenteditable="true"]',
      '[contenteditable="true"][role="textbox"]',
      '[contenteditable="true"]:not([style*="display: none"])',
    ];

    const pollForCommentBox = setInterval(() => {
      attempts++;

      for (const sel of commentBoxSelectors) {
        const boxes = document.querySelectorAll(sel);
        for (const box of boxes) {
          // SKIP boxes that already existed before we clicked Comment
          if (existingBoxes.has(box)) continue;

          // Make sure the box is visible and large enough
          const rect = box.getBoundingClientRect();
          if (rect.width < 50 || rect.height < 20) continue;

          // Make sure it's not our own UI
          if (box.closest('.ai-comment-card') || box.closest('.ai-comment-notification')) continue;

          // Found the NEW comment box!
          clearInterval(pollForCommentBox);

          // Focus and insert text
          box.focus();
          box.click();

          // Method 1: execCommand (works with Quill)
          document.execCommand('selectAll', false, null);
          document.execCommand('insertText', false, comment);

          // Method 2: Direct textContent (fallback)
          if (!box.textContent || box.textContent.trim().length < 10) {
            box.textContent = comment;
          }

          // Method 3: innerHTML (another fallback)
          if (!box.textContent || box.textContent.trim().length < 10) {
            box.innerHTML = comment;
          }

          // Trigger input events for LinkedIn's React state
          box.dispatchEvent(new Event('input', { bubbles: true }));
          box.dispatchEvent(new Event('change', { bubbles: true }));
          box.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));

          showNotification('Comment inserted! Click Post to publish.', 'success');
          return;
        }
      }

      // Stop polling after max attempts
      if (attempts >= maxAttempts) {
        clearInterval(pollForCommentBox);
        showNotification('Comment box not found. Click Comment button first, then try Insert again.', 'error');
      }
    }, 100);
  }

  // ─── UI: Button Loading State ──────────────────────────────────────────────

  function setLoading(button, loading) {
    if (loading) {
      button.classList.add('loading');
      button.disabled = true;
      button.innerHTML = `
        <svg class="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke-dasharray="30 60"></circle>
        </svg>
        <span>Generating...</span>
      `;
    } else {
      button.classList.remove('loading');
      button.disabled = false;
      button.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
          <path d="M2 17l10 5 10-5"></path>
          <path d="M2 12l10 5 10-5"></path>
        </svg>
        <span>Generate AI Comment</span>
      `;
    }
  }

  // ─── Message Listener (from popup) ─────────────────────────────────────────

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'INSERT_COMMENT') {
      insertComment(message.comment);
      sendResponse({ success: true });
    }
    return true;
  });

  function insertComment(comment) {
    const input =
      document.querySelector('.ql-editor[contenteditable="true"]') ||
      document.querySelector('[data-placeholder="Add a comment..."]') ||
      document.querySelector('[contenteditable="true"]');

    if (input) {
      input.focus();
      input.textContent = comment;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      showNotification('Comment inserted!', 'success');
    } else {
      showNotification('Open the comment box first', 'error');
    }
  }

  // ─── Debug Utility ─────────────────────────────────────────────────────────

  function registerDebugUtility() {
    // Expose on window for debugging in the browser console
    window.AICopilotDebug = function () {
      const posts = findLinkedInPosts();
      const buttons = document.querySelectorAll(`.${BUTTON_CLASS}`);

      const result = {
        url: window.location.href,
        loggedIn: isLoggedIn(),
        isFeedPage: isFeedPage(),
        postsFound: posts.length,
        buttonsFound: buttons.length,
        contentScriptLoaded: true,
        scanCount: state.scanCount,
        lastScanTime: state.lastScanTime,
        selectors: {
          'data-urn': document.querySelectorAll('[data-urn]').length,
          'article': document.querySelectorAll('article').length,
          'feed-shared-update-v2': document.querySelectorAll('.feed-shared-update-v2').length,
          'reusable-feed__post': document.querySelectorAll('.reusable-feed__post').length,
          'share-activity-card': document.querySelectorAll('.share-activity-card').length,
        },
        bodyClasses: document.body.className,
        bodyTextSnippet: (document.body.innerText || '').substring(0, 200),
      };

      console.table(result);
      return result;
    };

    // Test the full message flow (button click → background → API)
    window.AICopilotTestFlow = async function () {
      console.log('[AI Copilot] Testing full message flow...');

      // 1. Check extension context
      if (!chrome.runtime?.id) {
        console.error('❌ Extension context invalidated — reload extension and refresh LinkedIn');
        return;
      }
      console.log('✅ Extension context valid');

      // 2. Check if background script is reachable
      try {
        const healthResponse = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({ type: 'CHECK_HEALTH' }, (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          });
        });
        console.log('✅ Background script reachable:', healthResponse);
      } catch (err) {
        console.error('❌ Background script unreachable:', err.message);
        return;
      }

      // 3. Test API call directly
      try {
        const apiResponse = await fetch('http://localhost:8000/generate-comment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            post_content: 'Test post content for debugging',
            tone: 'professional',
          }),
        });
        const data = await apiResponse.json();
        console.log('✅ API direct call works:', data.comment?.substring(0, 50));
      } catch (err) {
        console.error('❌ API direct call failed:', err.message);
        return;
      }

      // 4. Test full flow via message
      try {
        const fullResponse = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(
            {
              type: 'GENERATE_COMMENT',
              postContent: 'Test post: Excited to share my new role at Google!',
            },
            (response) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(response);
              }
            }
          );
        });
        console.log('✅ Full flow works:', fullResponse);
      } catch (err) {
        console.error('❌ Full flow failed:', err.message);
      }

      console.log('[AI Copilot] Flow test complete');
    };

    // Inspect the DOM around social buttons to understand the structure
    window.AICopilotInspectButtons = function () {
      console.log('[AI Copilot] Inspecting social button structure...');

      const allButtons = Array.from(document.querySelectorAll('button'));
      const socialBtns = allButtons.filter(btn => {
        const text = (btn.textContent || '').toLowerCase().trim();
        const label = (btn.getAttribute('aria-label') || '').toLowerCase();
        return ['like', 'comment', 'share', 'repost', 'send'].some(
          s => text === s || label.includes(s)
        );
      });

      console.log(`Found ${socialBtns.length} social buttons`);

      socialBtns.slice(0, 5).forEach((btn, i) => {
        console.group(`[${i}] Button: "${btn.textContent?.trim().substring(0, 20)}"`);

        // Walk up and show parent chain
        let el = btn;
        for (let k = 0; k < 8; k++) {
          el = el.parentElement;
          if (!el || el === document.body) break;

          const attrs = [];
          if (el.getAttribute('data-view-name')) attrs.push(`data-view-name="${el.getAttribute('data-view-name')}"`);
          if (el.getAttribute('componentkey')) attrs.push(`componentkey="${el.getAttribute('componentkey')?.substring(0, 40)}"`);
          if (el.getAttribute('role')) attrs.push(`role="${el.getAttribute('role')}"`);
          if (el.getAttribute('data-urn')) attrs.push(`data-urn="${el.getAttribute('data-urn')?.substring(0, 40)}"`);

          const rect = el.getBoundingClientRect();
          const sizeInfo = `${Math.round(rect.width)}x${Math.round(rect.height)}`;
          const textLen = (el.innerText || '').length;

          console.log(`  Level ${k + 1}: ${el.tagName} [${attrs.join(', ')}] size=${sizeInfo} textLen=${textLen}`);

          // Check if this would be identified as a post
          if (el.querySelector('article')) console.log('    → Has article element');
          if (textLen > 50 && rect.width > 200) console.log('    → Meets size+text threshold');
        }

        console.groupEnd();
      });
    };

    log('Debug utilities registered: window.AICopilotDebug(), window.AICopilotTestFlow(), window.AICopilotInspectButtons()');

    // Note: Script injection into page context is blocked by LinkedIn's CSP.
    // Debug functions are accessible via content script console in DevTools:
    // DevTools → Console → Click "top" dropdown → Select content script context
  }

  // ─── Bootstrap ─────────────────────────────────────────────────────────────

  // ALWAYS register debug utility first — even before init()
  // This ensures AICopilotDebug() is available in console regardless of auth state
  registerDebugUtility();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
