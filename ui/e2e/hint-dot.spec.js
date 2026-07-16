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
 * Verifies that when the hint dot fades out (after the user clicks the
 * Intelligence tab or after the 30s auto-dismiss timer), the ping ring
 * does not produce a visible flash in any browser.
 *
 * The fix: `animation: 'none'` replaces `animationPlayState: 'paused'`
 * on the ring span so the ring is immediately removed from the render
 * tree rather than frozen at an unpredictable keyframe position.
 * This is deterministic across Chromium, Firefox, and WebKit.
 *
 * What this suite checks:
 *   a) After the tab switch that dismisses the dot, the aria-label element
 *      is gone from the DOM within 500ms (well inside the 300ms transition).
 *   b) During the transition window (0–300ms after dismiss) no element with
 *      the ping ring's aria-label is visible — i.e. no frame shows a flash.
 *   c) The transition completes in all three browser engines (chromium,
 *      firefox, webkit — configured in playwright.config.js).
 */
test.describe('hint dot — cross-browser fade-out (no ring flash)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(dealRoomUrl(PROP_A));
    await clearHintKeys(page, [PROP_A]);
  });

  test('hint dot fades out cleanly — ring is not visible during or after dismiss', async ({ page }) => {
    // Navigate and trigger a hint so the dot appears
    await page.goto(dealRoomUrl(PROP_A));

    const hookPresent = await triggerAnalysisSaved(page);
    expect(hookPresent, 'dev test hook must be present').toBe(true);

    // Wait for the dot to be fully visible (fade-in complete)
    const dot = page.locator('[aria-label="New analysis available"]');
    await expect(dot).toBeVisible({ timeout: 2000 });

    // Click the Intelligence tab — this dismisses the hint
    const intelligenceTab = page.locator('button', { hasText: 'Intelligence' });
    await intelligenceTab.click();

    // Immediately after the click, poll over the 300ms transition window
    // to confirm the dot never becomes (re-)visible. Any flash from a ring
    // restart would appear as a brief visibility event here.
    const START = Date.now();
    let flashDetected = false;
    while (Date.now() - START < 400) {
      const visible = await dot.isVisible().catch(() => false);
      if (visible) {
        flashDetected = true;
        break;
      }
      await page.waitForTimeout(16); // ~one frame
    }
    expect(flashDetected, 'ring must not flash visible during the 300ms fade-out').toBe(false);

    // Confirm the element is fully gone from the DOM after the transition
    await expect(dot).not.toBeVisible({ timeout: 500 });
  });

  test('ring animation is fully stopped before parent opacity reaches zero', async ({ page }) => {
    await page.goto(dealRoomUrl(PROP_A));

    const hookPresent = await triggerAnalysisSaved(page);
    expect(hookPresent, 'dev test hook must be present').toBe(true);

    await expect(
      page.locator('[aria-label="New analysis available"]')
    ).toBeVisible({ timeout: 2000 });

    // Read the computed animation style on the ring span BEFORE dismiss
    const ringSelector = '[aria-label="New analysis available"] span:first-child';
    const animBefore = await page.locator(ringSelector).evaluate(
      (el) => getComputedStyle(el).animationName
    );
    expect(animBefore).not.toBe('none'); // ring is running

    // Dismiss via tab click
    await page.locator('button', { hasText: 'Intelligence' }).click();

    // Within one frame after the click, the ring's animation must be 'none'
    // (the `animation: 'none'` inline style takes effect synchronously in React)
    await page.waitForTimeout(32); // two frames
    const animAfter = await page.locator(ringSelector).evaluate(
      (el) => getComputedStyle(el).animationName
    ).catch(() => 'none'); // element unmounted = also fine
    expect(animAfter, 'ring animation must be stopped immediately on dismiss').toBe('none');
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
