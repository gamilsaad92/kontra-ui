import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SignUpForm from '../SignUpForm.jsx';
import { AuthContext } from '../../main.jsx';

const supabase = { auth: { signUp: jest.fn(), signInWithOtp: jest.fn() } };

function renderForm() {
  render(
    <AuthContext.Provider value={{ supabase }}>
      <SignUpForm />
    </AuthContext.Provider>
  );
}

test('magic link option hides password fields', () => {
  renderForm();
  fireEvent.click(screen.getByLabelText(/Email Magic Link/i));
  expect(screen.queryByPlaceholderText('Password')).not.toBeInTheDocument();
  expect(screen.queryByPlaceholderText('Confirm Password')).not.toBeInTheDocument();
});
