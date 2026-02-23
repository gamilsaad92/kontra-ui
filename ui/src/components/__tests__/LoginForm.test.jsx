import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import LoginForm from '../LoginForm.jsx';
import { AuthContext } from '../../lib/authContext';

const supabase = { auth: { signInWithPassword: jest.fn(), signInWithOtp: jest.fn() } };

function renderForm() {
  render(
    <AuthContext.Provider value={{ supabase, isLoading: false }}>
      <LoginForm />
    </AuthContext.Provider>
  );
}

test('magic link option hides password input', () => {
  renderForm();
  fireEvent.click(screen.getByLabelText(/Email Magic Link/i));
  expect(screen.queryByPlaceholderText(/Password/i)).not.toBeInTheDocument();
});

test('shows auth provider errors for password login', async () => {
  supabase.auth.signInWithPassword.mockResolvedValueOnce({
    data: { session: null },
    error: { message: 'Invalid login credentials' },
  });

  renderForm();
  fireEvent.change(screen.getByPlaceholderText(/Email/i), {
    target: { value: 'test@example.com' },
  });
  fireEvent.change(screen.getByPlaceholderText(/Password/i), {
    target: { value: 'secret123' },
  });
  fireEvent.click(screen.getByRole('button', { name: /Log In/i }));

 expect(await screen.findByText(/Invalid login credentials/i)).toBeInTheDocument();
});
