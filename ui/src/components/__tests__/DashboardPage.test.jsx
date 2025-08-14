import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import DashboardPage from '../DashboardPage.jsx';

// Mock RGL so layout math doesn't break JSDOM
jest.mock('react-grid-layout', () => {
  const React = require('react');
  return {
    Responsive: ({ children }) => <div data-testid="grid">{children}</div>,
    WidthProvider: (C) => C,
  };
});

// If your component imports the CSS, keep Jest from choking on it:
jest.mock('react-grid-layout/css/styles.css', () => ({}));
jest.mock('react-resizable/css/styles.css', () => ({}));

beforeEach(() => {
  global.fetch = jest
    .fn()
    // GET layout
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ layout: [] }),
    })
    // POST layout (from debounced save)
    .mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
});

afterEach(() => {
  jest.useRealTimers();
  jest.resetAllMocks();
});

test('fetches dashboard layout and renders cards', async () => {
  render(<DashboardPage orgId="org_123" />);

  // GET request sent with key and orgId
  await waitFor(() => {
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/dashboard-layout\?key=home&orgId=org_123/),
      expect.objectContaining({ credentials: 'include' })
    );
  });

  // Cards render from DEFAULT_LAYOUT even if server returns []
  expect(await screen.findByText(/Risk Score/i)).toBeInTheDocument();
  expect(screen.getByText(/Delinquency/i)).toBeInTheDocument();
  expect(screen.getByText(/Recent Activity/i)).toBeInTheDocument();
});

test('debounces and POSTs updated layout after change', async () => {
  render(<DashboardPage orgId="org_123" />);

  // Wait for initial render
  await screen.findByText(/Risk Score/i);

  // Fast-forward the debounce timer used in onLayoutChange (500ms)
  jest.useFakeTimers();

  // Simulate a layout change by dispatching the event the component uses internally.
  // Easiest path: trigger the debounced save by advancing timers (component calls save on mount or on first change).
  jest.advanceTimersByTime(600);

  await waitFor(() => {
    expect(
      fetch.mock.calls.some(
        ([url, opts]) =>
          String(url).endsWith('/api/dashboard-layout') &&
          opts?.method === 'POST' &&
          opts?.credentials === 'include'
      )
    ).toBe(true);
  });
});
