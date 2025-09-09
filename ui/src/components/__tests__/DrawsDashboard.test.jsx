import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DrawsDashboard from '../DrawsDashboard.jsx';

describe('DrawsDashboard', () => {
  beforeEach(() => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ draw: { id: 1 } })
      })
    );
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

    const body = fetch.mock.calls[0][1].body;
    expect(body.getAll('documents')).toHaveLength(1);

    expect(
      await screen.findByText(/Upload Lien Waiver \(Draw #1\)/i)
    ).toBeInTheDocument();
  });
});
