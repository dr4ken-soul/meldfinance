import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthActionPage } from './AuthActionPage';

const { verifyPasswordResetCode, confirmPasswordReset } = vi.hoisted(() => ({
  verifyPasswordResetCode: vi.fn(),
  confirmPasswordReset: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  applyActionCode: vi.fn(),
  confirmPasswordReset,
  reload: vi.fn(),
  verifyPasswordResetCode,
}));

vi.mock('../lib/firebase', () => ({
  getFirebaseAuth: () => ({ currentUser: null }),
}));

describe('AuthActionPage password reset', () => {
  beforeEach(() => {
    verifyPasswordResetCode.mockReset().mockResolvedValue('paul@example.com');
    confirmPasswordReset.mockReset().mockResolvedValue(undefined);
  });

  it('renders the branded reset form, supports password visibility, and confirms success', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/auth/action?mode=resetPassword&oobCode=valid-code&apiKey=test-key']}>
        <Routes><Route path="/auth/action" element={<AuthActionPage />} /></Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Choose a new password.' })).toBeInTheDocument();
    expect(screen.getByText('Secure account access')).toBeInTheDocument();

    const newPassword = screen.getByLabelText('New password');
    await user.click(screen.getByRole('button', { name: 'Show new password' }));
    expect(newPassword).toHaveAttribute('type', 'text');

    await user.type(newPassword, 'A-long-new-passphrase-2026');
    await user.type(screen.getByLabelText('Confirm new password'), 'A-long-new-passphrase-2026');
    await user.click(screen.getByRole('button', { name: 'Save new password' }));

    await waitFor(() => expect(confirmPasswordReset).toHaveBeenCalledWith(expect.any(Object), 'valid-code', 'A-long-new-passphrase-2026'));
    expect(await screen.findByRole('heading', { name: 'Password updated.' })).toBeInTheDocument();
  });
});
