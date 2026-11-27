import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OrganizationSettings from '../OrganizationSettings.jsx';
import { apiFetch, setOrgContext } from '../../lib/apiClient';

jest.mock('../../lib/apiClient', () => ({
  apiFetch: jest.fn(),
  setOrgContext: jest.fn(),
}));

const jsonResponse = (data, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data,
});

function renderSettings() {
  return render(
    <MemoryRouter>
      <OrganizationSettings />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  apiFetch.mockImplementation((path) => {
    if (path === '/api/me') return Promise.resolve(jsonResponse({ organizations: [] }));
    if (path === '/api/plans') return Promise.resolve(jsonResponse({ plans: [] }));
    return Promise.resolve(jsonResponse({}));
  });
});

test('first-time organization creation uses the authenticated canonical endpoint', async () => {
  apiFetch.mockImplementation((path, init = {}) => {
    if (path === '/api/me' && init.method === 'POST') {
      return Promise.resolve(jsonResponse({
        org: { id: 'org-new', name: 'Pilot Institution', role: 'owner', branding: {} },
      }, 201));
    }
    if (path === '/api/me') return Promise.resolve(jsonResponse({ organizations: [] }));
    if (path === '/api/plans') return Promise.resolve(jsonResponse({ plans: [] }));
    return Promise.resolve(jsonResponse({}));
  });

  renderSettings();
  const nameInput = await screen.findByLabelText('Organization name');
  fireEvent.change(nameInput, { target: { value: 'Pilot Institution' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create organization' }));

  await screen.findByText('Organization created');
  expect(apiFetch).toHaveBeenCalledWith('/api/me', {
    method: 'POST',
    body: JSON.stringify({ name: 'Pilot Institution' }),
  }, { requireAuth: true, throwOnError: false });
  expect(setOrgContext).toHaveBeenCalledWith({ orgId: 'org-new' });
  expect(await screen.findByRole('link', { name: 'Create a deal room' }))
    .toHaveAttribute('href', '/create-deal-room?organizationId=org-new');
});

test('member role cannot launch owner-only transaction creation or subscription changes', async () => {
  apiFetch.mockImplementation((path) => {
    if (path === '/api/me') {
      return Promise.resolve(jsonResponse({
        orgs: [{
          id: 'org-member',
          name: 'Member Institution',
          role: 'member',
          branding: {},
        }],
      }));
    }
    if (path === '/api/plans') return Promise.resolve(jsonResponse({ plans: [{ name: 'pro', price: 20 }] }));
    return Promise.resolve(jsonResponse({}));
  });

  renderSettings();
  await screen.findByDisplayValue('Member Institution');
  expect(screen.queryByRole('link', { name: 'Create a deal room' })).not.toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Subscription plans' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
    '/api/me',
    {},
    { requireAuth: true, throwOnError: false },
  ));
});
