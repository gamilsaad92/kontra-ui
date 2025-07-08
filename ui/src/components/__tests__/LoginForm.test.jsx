import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import LoginForm from '../LoginForm.jsx';
import { AuthContext } from '../../main.jsx';

const supabase = { auth: { signInWithPassword: jest.fn(), signInWithOtp: jest.fn() } };

function renderForm() {
  render(
    <AuthContext.Provider value={{ supabase }}>
      <LoginForm />
    </AuthContext.Provider>
  );
}

test('magic link option hides password input', () => {
  renderForm();
  fireEvent.click(screen.getByLabelText(/Email Magic Link/i));
  expect(screen.queryByPlaceholderText(/Password/i)).not.toBeInTheDocument();
});
