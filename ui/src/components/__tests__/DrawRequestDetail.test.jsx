import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DrawRequestDetail from '../DrawRequestDetail.jsx';

describe('DrawRequestDetail', () => {
  beforeEach(() => {
    global.fetch = jest.fn((url) => {
      if (url.includes('/api/draw-requests/')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              draw: {
                id: 123,
                project: 'Project A',
                amount: 500,
                status: 'submitted',
                submitted_at: '2024-01-01T00:00:00Z'
              }
            })
        });
      }
      if (url.includes('/api/upload-lien-waiver')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { id: 1 } })
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('renders draw details and uploads lien waiver', async () => {
    const { container } = render(
      <DrawRequestDetail drawId={123} onClose={() => {}} />
    );

    expect(await screen.findByText(/Draw #123/)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Contractor Name/i), {
      target: { value: 'ACME' }
    });
    fireEvent.change(screen.getByPlaceholderText(/Waiver Type/i), {
      target: { value: 'final' }
    });

    const fileInput = container.querySelector('input[type="file"]');
    const file = new File(['waiver'], 'waiver.pdf', {
      type: 'application/pdf'
    });
    fireEvent.change(fileInput, { target: { files: [file] } });

    fireEvent.click(screen.getByText(/Upload Waiver/i));

    await waitFor(() => {
      const call = fetch.mock.calls.find(([url]) =>
        url.includes('/api/upload-lien-waiver')
      );
      expect(call).toBeTruthy();
    });

    const uploadCall = fetch.mock.calls.find(([url]) =>
      url.includes('/api/upload-lien-waiver')
    );
    const formData = uploadCall[1].body;
    expect(formData.get('contractor_name')).toBe('ACME');
    expect(formData.get('file').name).toBe('waiver.pdf');

    expect(
      await screen.findByText(/Waiver uploaded successfully/i)
    ).toBeInTheDocument();
  });
});
