import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import DocumentReview from '../DocumentReview.jsx';

test('shows error when required fields are missing', async () => {
  render(<DocumentReview />);
  fireEvent.click(screen.getByText(/Upload/i));
  expect(await screen.findByText(/File and document type required/i)).toBeInTheDocument();
});
