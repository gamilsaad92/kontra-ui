import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import DashboardPage from '../DashboardPage.jsx';

beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({ json: () => Promise.resolve({ layout: [] }) })
  );
});

afterEach(() => {
  jest.resetAllMocks();
});

test('fetches dashboard layout and renders cards', async () => {
  render(<DashboardPage />);

  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('/api/dashboard-layout?key=home')
  );

  await waitFor(() => {
    expect(screen.getByText(/Risk Score/i)).toBeInTheDocument();
    expect(screen.getByText(/Delinquency Forecast/i)).toBeInTheDocument();
    expect(screen.getByText(/Recent Activity/i)).toBeInTheDocument();
  });
});
