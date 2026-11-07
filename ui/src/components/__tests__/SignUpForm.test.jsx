import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SignUpForm from '../SignUpForm.jsx';
import { AuthContext } from '../../lib/authContext';

const supabase = { auth: { signUp: jest.fn(), signInWithOtp: jest.fn() } };

function renderForm() {
  render(
   <AuthContext.Provider value={{ supabase, isLoading: false }}>
      <SignUpForm />
    </AuthContext.Provider>
  );
}

test('signup role selection keeps the required password fields', () => {
  renderForm();
  expect(document.querySelectorAll('input[type="password"]')).toHaveLength(2);
  expect(screen.getByRole('button', { name: 'Create Borrower Account' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Investor/ }));
  expect(screen.getByRole('button', { name: 'Create Investor Account' })).toBeInTheDocument();
  expect(document.querySelectorAll('input[type="password"]')).toHaveLength(2);
});
