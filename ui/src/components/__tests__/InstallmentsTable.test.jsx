import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import InstallmentsTable from '../InstallmentsTable.jsx';

test('filters installments by status', () => {
  render(<InstallmentsTable />);
  // header plus five rows
  expect(screen.getAllByRole('row')).toHaveLength(6);

  const select = screen.getByRole('combobox');
  fireEvent.change(select, { target: { value: 'paid' } });

  // header plus two paid rows
  expect(screen.getAllByRole('row')).toHaveLength(3);
});
