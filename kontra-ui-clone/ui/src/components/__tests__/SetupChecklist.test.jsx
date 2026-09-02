import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import SetupChecklist from '../SetupChecklist.jsx'

test('renders checklist items and toggles state', () => {
  render(<SetupChecklist />)
  const checkbox = screen.getByLabelText(/Complete your profile/i)
  expect(checkbox).toBeInTheDocument()
  expect(checkbox.checked).toBe(false)
  fireEvent.click(checkbox)
  expect(checkbox.checked).toBe(true)
})
