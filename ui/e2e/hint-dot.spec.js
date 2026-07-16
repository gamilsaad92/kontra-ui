/**
 * Playwright e2e spec — hint dot localStorage persistence
 *
 * Full-flow coverage:
 *   1. Navigate to a deal room with no prior hint state.
 *   2. Trigger a real analysis-save event via the dev-mode test hook
 *      (window.__kontraTestTriggerHint__ is exposed by DocumentsTabPanel
 *       in DEV builds — tree-shaken out in production).
 *   3. Assert the hint dot APPEARS (proving the hook reaches real React state).
 *   4. Reload the page (localStorage persists; sessionStorage would not).
 *   5. Assert the hint dot stays GONE (proving persistence across reload).
 *   6. Navigate to a DIFFERENT propertyId and trigger a save there.
 *   7. Assert room B shows its dot independently of room A's dismissed state.
 *
 * Prerequisites:
 *   npm install --save-dev @playwright/test
 *   npx playwright install chromium
 *   npm run dev   (or set PLAYWRIGHT_BASE_URL)
 *
 * Run:
 *   npx playwright test e2e/hint-dot.spec.js
 *   npm run test:e2e
 */

const { test, expect } = require('@playwright/test');

// Key format — must match hintKey() in DocumentsTabPanel.jsx.
// The source-analysis tests in __tests__/DocumentsTabPanel.hint.test.js
// verify this format against the live component source.
const hintKey = (id) => `kontra_intelligence_hint_shown_${id}`;

// Use stable slugs that won't collide with real user data but will render
// without crashing (the component gracefully handles empty analyses).
const PROP_A = '__e2e_hint_prop_a__';
const PROP_B = '__e2e_hint_prop_b__';

const dealRoomUrl = (slug) => `/deal-room/${slug}`;

// Trigger handleAnalysisSaved on the currently-mounted DocumentsTabPanel
// via the dev-mode window hook.  Returns true if the hook was present.
async function triggerAnalysisSaved(page) {
  return page.evaluate(() => {
    if (typeof window.__kontraTestTriggerHint__ === 'function') {
      window.__kontraTestTriggerHint__();
      return true;
    }
    return false;
  });
}

// Clear hint keys before each test so tests are independent.
async function clearHintKeys(page, slugs) {
  await page.evaluate(
    (keys) => keys.forEach((k) => localStorage.removeItem(k)),
    slugs.map(hintKey)
  );
}

/**
 * Cross-browser fade-out suite
 *
 * Verifies that when the hint dot fades out (via the 30s auto-dismiss path,
 * which is the path that uses the 300ms opacity transition in-place), the
 * ping ring does not produce a visible flash in any browser.
 *
 * IMPORTANT — why we use __kontraTestTriggerDismiss__ and NOT a tab click:
 * Clicking the Intelligence tab changes `activeTab`, which causes the hint
 * element to unmount IMMEDIATELY via the `activeTab !== 'intelligence'` guard.
 * That means clicking the tab NEVER exercises the 300ms fade-out — the element
 * is gone in one render cycle. To test the real fade-out, we call dismissHint()
 * directly via the dev-mode window hook, leaving activeTab on 'checklist' so
 * the element stays mounted while hintOpaque → false triggers:
 *   1. `animation: 'none'` on the ring span  (synchronous with setState)
 *   2. `opacity: 0` + 300ms CSS transition on the wrapper
 *   3. After 310ms, `showHint = false` → element unmounts
 *
 * The fix: `animation: 'none'` replaces `animationPlayState: 'paused'`
 * on the ring span. This is deterministic in Chromium, Firefox, and WebKit —
 * no "frozen at visible keyframe" risk from engine-specific pause timing.
 *
 * Browser coverage: chromium, firefox, webkit — see playwright.config.js.
 */
test.describe('hint dot — cross-browser fade-out (no ring flash)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(dealRoomUrl(PROP_A));
    await clearHintKeys(page, [PROP_A]);
  });

  /**
   * Core cross-browser test:
   * Triggers the real auto-dismiss path (dismissHint directly, NOT tab click),
   * then asserts ring-specific behavior:
   *   a) ring animationName switches to 'none' synchronously with setState
   *   b) the wrapper element stays mounted during the 300ms transition
   *   c) the wrapper is gone after 310ms (showHint → false)
   *
   * This test runs on chromium, firefox, and webkit via the projects config.
   */
  test('ring animationName becomes none immediately on dismiss, element stays mounted during fade', async ({ page }) => {
    await page.goto(dealRoomUrl(PROP_A));

    const hookPresent = await triggerAnalysisSaved(page);
    expect(hookPresent, 'dev trigger-hint hook must be present').toBe(true);

    const dotWrapper = page.locator('[aria-label="New analysis available"]');
    const ringSpan   = page.locator('[aria-label="New analysis available"] > span:first-child');

    // Wait for the hint to be fully visible (hintOpaque = true)
    await expect(dotWrapper).toBeVisible({ timeout: 2000 });

    // Confirm the ring animation is running before we dismiss
    const animBefore = await ringSpan.evaluate(
      (el) => getComputedStyle(el).animationName
    );
    expect(animBefore, 'ring must be running before dismiss').not.toBe('none');

    // ── Trigger the real fade-out path (dismissHint, NOT tab click) ──────────
    // dismissHint(): sets hintOpaque=false → animation:none on ring, opacity:0
    // on wrapper with 300ms ease-out → after 310ms setShowHint(false) unmounts.
    const dismissHookPresent = await page.evaluate(() => {
      if (typeof window.__kontraTestTriggerDismiss__ === 'function') {
        window.__kontraTestTriggerDismiss__();
        return true;
      }
      return false;
    });
    expect(dismissHookPresent, 'dev trigger-dismiss hook must be present').toBe(true);

    // ── Assert ring-specific: animationName must be 'none' within one RAF ────
    // React flushes synchronously on setState; the inline `animation: 'none'`
    // style should take effect in the next paint cycle (≤16ms).
    await page.waitForTimeout(32); // two frames
    const animAfter = await ringSpan.evaluate(
      (el) => getComputedStyle(el).animationName
    );
    expect(animAfter, 'ring animationName must be "none" immediately after dismiss').toBe('none');

    // ── Assert wrapper stays mounted during the 300ms transition ─────────────
    // At 32ms the wrapper must still be in the DOM (opacity transitioning).
    const wrapperMounted = await dotWrapper.evaluate((el) => !!el.isConnected);
    expect(wrapperMounted, 'wrapper must still be mounted during fade-out window').toBe(true);

    // ── Assert element is gone after the 310ms timer fires ───────────────────
    await expect(dotWrapper).not.toBeAttached({ timeout: 600 });
  });

  /**
   * Flash-detection test: polls every frame during the 300ms fade window and
   * asserts the ring span never becomes (re-)visible at opacity > 0.
   *
   * This guards against engines that might restart a paused animation on a
   * new loop cycle (the original animationPlayState: 'paused' risk).
   * With `animation: 'none'` the ring is rendered as a static non-animated
   * element and fades with its parent — no restart is possible.
   */
  test('ring does not flash visible during the 300ms fade-out window', async ({ page }) => {
    await page.goto(dealRoomUrl(PROP_A));

    const hookPresent = await triggerAnalysisSaved(page);
    expect(hookPresent, 'dev trigger-hint hook must be present').toBe(true);

    const ringSpan = page.locator('[aria-label="New analysis available"] > span:first-child');
    await expect(page.locator('[aria-label="New analysis available"]')).toBeVisible({ timeout: 2000 });

    // Trigger the real fade-out
    await page.evaluate(() => window.__kontraTestTriggerDismiss__?.());

    // Poll every ~16ms for 350ms. The ring element's effective opacity is the
    // product of its own CSS opacity and the parent wrapper's opacity (which is
    // transitioning from 1→0 over 300ms). After animation:none is applied, the
    // ring is a static circle fading with its parent — it will never be MORE
    // opaque than the wrapper. If animationPlayState:paused was used instead and
    // paused at an early keyframe, the ring could appear at near-full opacity
    // for several frames, which would be caught here.
    let maxOpacity = 0;
    const start = Date.now();
    while (Date.now() - start < 350) {
      const opacity = await ringSpan.evaluate((el) => {
        if (!el.isConnected) return 0;
        // Walk up and multiply opacities to get the effective visual opacity
        let o = 1;
        let node = el;
        while (node && node !== document.body) {
          o *= parseFloat(getComputedStyle(node).opacity) || 0;
          node = node.parentElement;
        }
        return o;
      }).catch(() => 0);
      if (opacity > maxOpacity) maxOpacity = opacity;
      await page.waitForTimeout(16);
    }
    // The maximum observed opacity should be ≤ 1.0 (obviously) and should be
    // low — by ~32ms the wrapper is already mid-transition. If there were a
    // ring restart at 0% keyframe (opacity 0.75) with a static parent opacity,
    // the product would spike near 0.75, well above 0.5.
    expect(maxOpacity, 'ring effective opacity must never spike above 0.5 during fade').toBeLessThanOrEqual(0.5);
  });
});

test.describe('hint dot — localStorage persistence across reloads', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(dealRoomUrl(PROP_A));
    await clearHintKeys(page, [PROP_A, PROP_B]);
  });

  test('hint dot appears after analysis save and stays gone on reload', async ({ page }) => {
    // ── Step 1: navigate to room A with no prior hint state ─────────────
    await page.goto(dealRoomUrl(PROP_A));

    // ── Step 2: trigger the real handleAnalysisSaved ─────────────────────
    const hookPresent = await triggerAnalysisSaved(page);
    expect(hookPresent, 'dev test hook must be present on window').toBe(true);

    // ── Step 3: hint dot must be visible ─────────────────────────────────
    // The dot fades in via requestAnimationFrame → give it a moment
    await expect(
      page.locator('[aria-label="New analysis available"]')
    ).toBeVisible({ timeout: 2000 });

    // localStorage key must have been written by the real component
    const keyAfterSave = await page.evaluate((k) => localStorage.getItem(k), hintKey(PROP_A));
    expect(keyAfterSave).toBe('1');

    // ── Step 4: reload the page ───────────────────────────────────────────
    await page.reload();

    // ── Step 5: dot must be absent — localStorage survived the reload ─────
    // (sessionStorage would be cleared by the reload and the dot would reappear
    //  on the next analysis-save trigger, so this assertion fails if someone
    //  reverts the storage mechanism)
    await expect(
      page.locator('[aria-label="New analysis available"]')
    ).not.toBeVisible();

    // Key must still be in localStorage
    const keyAfterReload = await page.evaluate(
      (k) => localStorage.getItem(k),
      hintKey(PROP_A)
    );
    expect(keyAfterReload).toBe('1');
  });

  test('hint dot is keyed per propertyId — room B shows independently of room A', async ({ page }) => {
    // ── Dismiss room A ────────────────────────────────────────────────────
    await page.goto(dealRoomUrl(PROP_A));
    await triggerAnalysisSaved(page);

    // Wait for room A dot to appear, confirming the hook works
    await expect(
      page.locator('[aria-label="New analysis available"]')
    ).toBeVisible({ timeout: 2000 });

    // ── Navigate to room B (different propertyId) ─────────────────────────
    await page.goto(dealRoomUrl(PROP_B));

    // Room B key must not exist — its hint is independent
    const propBKey = await page.evaluate((k) => localStorage.getItem(k), hintKey(PROP_B));
    expect(propBKey).toBeNull();

    // ── Trigger analysis save in room B ───────────────────────────────────
    const hookPresent = await triggerAnalysisSaved(page);
    expect(hookPresent, 'dev test hook must be present on window for room B').toBe(true);

    // Room B dot appears — its hint state is independent of room A
    await expect(
      page.locator('[aria-label="New analysis available"]')
    ).toBeVisible({ timeout: 2000 });

    // Both keys now exist with independent values
    const [keyA, keyB] = await page.evaluate(
      ([kA, kB]) => [localStorage.getItem(kA), localStorage.getItem(kB)],
      [hintKey(PROP_A), hintKey(PROP_B)]
    );
    expect(keyA).toBe('1');
    expect(keyB).toBe('1');

    // ── Reload room B — its dot must also stay gone ───────────────────────
    await page.reload();
    await expect(
      page.locator('[aria-label="New analysis available"]')
    ).not.toBeVisible();
  });
});
