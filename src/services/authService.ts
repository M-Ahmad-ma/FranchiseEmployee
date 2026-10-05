import { API_BASE_URL, USE_MOCK } from '../config';
import { delay } from './utils';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface Credentials {
  email: string;
  password: string;
}

/** Mock password floor — swap USE_MOCK to false to hit the real endpoint. */
export const MIN_PASSWORD_LENGTH = 6;

const GENERIC_ERROR = 'Incorrect email or password.';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidEmail = (email: string) => EMAIL_PATTERN.test(email.trim());

/** Turns "ahmad.khan@x.com" into "Ahmad Khan" for the mock profile. */
function nameFromEmail(email: string) {
  const handle = email.trim().split('@')[0] ?? '';
  const name = handle
    .split(/[._-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  return name || 'Franchise Employee';
}

/**
 * Sign in with email + password.
 * Mock validates locally so the flow is demoable without a backend;
 * set USE_MOCK to false to hit the real endpoint.
 */
export async function signIn({
  email,
  password,
}: Credentials): Promise<AuthUser> {
  if (USE_MOCK) {
    await delay();
    if (!isValidEmail(email) || password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(GENERIC_ERROR);
    }
    return {
      id: 'mock-user-1',
      name: nameFromEmail(email),
      email: email.trim(),
      role: 'Franchise Employee',
    };
  }

  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), password }),
  });

  if (!res.ok) {
    throw new Error(GENERIC_ERROR);
  }

  return res.json();
}
