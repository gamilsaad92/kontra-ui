const { test, expect } = require('@playwright/test');

const coordinatorLink = process.env.PLAYWRIGHT_STAGING_COORDINATOR_LINK;
const participantLink = process.env.PLAYWRIGHT_STAGING_PARTICIPANT_LINK;
const stagingOrigin = 'https://staging.kontraplatform.com';

test('participant link stays participant-scoped in a browser with coordinator access', async ({ page, browserName }) => {
  test.setTimeout(90_000);
  test.skip(
    browserName !== 'chromium',
    'The participant link is one-use; run this staging session check once in Chromium.',
  );
  test.skip(
    !coordinatorLink || !participantLink,
    'Set the two staging link variables after staging has a dedicated test room and invite.',
  );

  const coordinatorUrl = new URL(coordinatorLink);
  const participantUrl = new URL(participantLink);
  expect(coordinatorUrl.origin).toBe(stagingOrigin);
  expect(participantUrl.origin).toBe(stagingOrigin);
  expect(coordinatorUrl.pathname).toContain('/deal-room/');
  expect(participantUrl.pathname).toContain('/deal-room/');
  expect(participantUrl.searchParams.has('invite')).toBe(true);

  // One page and one browser context are intentional: the coordinator
  // HttpOnly cookie remains present when the participant capability is used.
  await page.goto(coordinatorUrl.href);
  await expect(page.getByText('Coordinator Transaction Brief', { exact: true })).toBeVisible();

  await page.goto(participantUrl.href);
  await expect(page.getByText('Participant deal room', { exact: true })).toBeVisible();
  await expect(page.getByText('Your document progress', { exact: true })).toBeVisible();
  await expect(page.getByText('Coordinator Transaction Brief', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Invite Participants', { exact: true })).toHaveCount(0);
});
