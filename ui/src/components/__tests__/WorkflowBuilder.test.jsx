import React from 'react';
import { render, screen } from '@testing-library/react';
import WorkflowBuilder from '../WorkflowBuilder';

test('renders Save Workflow button', () => {
  render(<WorkflowBuilder />);
  expect(screen.getByText(/Save Workflow/)).toBeInTheDocument();
});
