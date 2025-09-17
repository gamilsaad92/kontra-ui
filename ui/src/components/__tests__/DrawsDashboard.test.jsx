import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DrawsDashboard from '../DrawsDashboard.jsx';

describe('DrawsDashboard', () => {
  beforeEach(() => {
   global.fetch = jest.fn((url, options = {}) => {
      if (url.includes('/api/draw-requests?status=approved')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ draws: [] }) });
      }
      if (url.includes('/api/draw-requests?status=funded')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ draws: [] }) });
      }
      if (url.includes('/api/draw-requests?status=submitted')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ draws: [] }) });
      }
      if (url.includes('/api/draw-requests?status=pending')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ draws: [] }) });
      }
      if (url.includes('/api/draw-requests/tokenizations')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ notes: [] }) });
      }
      if (url.includes('/api/draws/escrow-notes')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ balance: 0, lockedCollateral: 0, ratio: 1.25, availableCapacity: 0, notes: [] })
        });
      }
      if (url.includes('/api/draws/syndications')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ campaigns: [] }) });
      }
      if (url.includes('/api/get-draws')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ draws: [] }) });
      }
      if (url.includes('/api/list-lien-waivers')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ waivers: [] }) });
      }
      if (url.includes('/api/waiver-checklist')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ checklist: [] }) });
      }
      if (options.method === 'POST' && url.includes('/api/draw-requests') && !url.includes('syndication')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ draw: { id: 1 } }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });    
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('submits a draw request with document and shows lien waiver form', async () => {
    const { container } = render(<DrawsDashboard />);

    fireEvent.change(screen.getByPlaceholderText(/Project/i), {
      target: { value: 'Project A' }
    });
    fireEvent.change(screen.getByPlaceholderText(/Draw Number/i), {
      target: { value: '1' }
    });
    fireEvent.change(screen.getByPlaceholderText(/Amount/i), {
      target: { value: '1000' }
    });
    fireEvent.change(screen.getByPlaceholderText(/Description/i), {
      target: { value: 'Test draw' }
    });

    const fileInput = container.querySelector('input[type="file"][multiple]');
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    fireEvent.click(screen.getByText(/Submit/i));

    await waitFor(() => expect(fetch).toHaveBeenCalled());

       const submissionCall = fetch.mock.calls.find(
      ([url, options]) =>
        url.includes('/api/draw-requests') &&
        !url.includes('syndication') &&
        !url.includes('tokenize') &&
        options?.method === 'POST'
    );

    expect(submissionCall).toBeTruthy();
    const body = submissionCall[1].body;
    expect(body.getAll('documents')).toHaveLength(1);

    expect(
      await screen.findByText(/Upload Lien Waiver \(Draw #1\)/i)
    ).toBeInTheDocument();
  });
});
