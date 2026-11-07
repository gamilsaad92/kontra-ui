import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import DashboardPage from '../DashboardPage.jsx';

// Mock RGL so layout math doesn't break JSDOM
jest.mock('react-grid-layout', () => {
  const React = require('react');
  return {
    Responsive: ({ children, onLayoutChange }) => (
      <div data-testid="grid" onClick={() => onLayoutChange([{ i: 'riskScore', x: 1, y: 0, w: 4, h: 8 }])}>
        {children}
      </div>
    ),
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
     expect.stringMatching(/\/api\/dashboard-layout\?key=home&orgId=org_123/)
    );
  });

  // Cards render from DEFAULT_LAYOUT even if server returns []
  expect(await screen.findByRole('heading', { name: /Risk Score/i })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /Delinquency Forecast/i })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /Recent Activity/i })).toBeInTheDocument();
});

test('debounces and POSTs updated layout after change', async () => {
  jest.useFakeTimers();
  render(<DashboardPage orgId="org_123" />);
  await waitFor(() => expect(screen.getByRole('heading', { name: /Risk Score/i })).toBeInTheDocument());
  fireEvent.click(screen.getByTestId('grid'));
  jest.advanceTimersByTime(500);

  await waitFor(() => {
    expect(
      fetch.mock.calls.some(
        ([url, opts]) =>
          String(url).endsWith('/api/dashboard-layout') &&
            opts?.method === 'POST'
      )
    ).toBe(true);
  });
});
