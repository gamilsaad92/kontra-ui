import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import LoginForm from '../LoginForm.jsx';
import { AuthContext } from '../../lib/authContext';

const signIn = jest.fn();

function renderForm() {
  render(
   <AuthContext.Provider value={{ signIn, loading: false, isAuthed: false, session: null }}>
      <LoginForm />
    </AuthContext.Provider>
  );
}

test('renders password input for Supabase password login', () => {
  renderForm();
  expect(screen.getByPlaceholderText(/Password/i)).toBeInTheDocument();
});

test('shows auth provider errors for password login', async () => {
 signIn.mockResolvedValueOnce({
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
