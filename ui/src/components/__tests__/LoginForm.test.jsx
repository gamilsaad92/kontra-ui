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

test('recovers when password login request never resolves', async () => {
  jest.useFakeTimers();
  supabase.auth.signInWithPassword.mockImplementationOnce(
    () => new Promise(() => {})
  );

  renderForm();
  fireEvent.change(screen.getByPlaceholderText(/Email/i), {
    target: { value: 'test@example.com' },
  });
  fireEvent.change(screen.getByPlaceholderText(/Password/i), {
    target: { value: 'secret123' },
  });
  fireEvent.click(screen.getByRole('button', { name: /Log In/i }));

  expect(screen.getByRole('button', { name: /Logging in/i })).toBeDisabled();

  jest.advanceTimersByTime(12000);

  expect(await screen.findByText(/timed out/i)).toBeInTheDocument();
  expect(await screen.findByRole('button', { name: /Log In/i })).toBeEnabled();

  jest.useRealTimers();
});
