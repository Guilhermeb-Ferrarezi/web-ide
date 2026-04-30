import { config } from '../../config.ts';
import { createOctokit } from '../../utils/octokit.ts';

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';

export const OAUTH_SCOPES = ['repo', 'read:user', 'user:email'].join(' ');

export function buildAuthorizeUrl(state: string) {
  const params = new URLSearchParams({
    client_id: config.GITHUB_CLIENT_ID,
    redirect_uri: config.GITHUB_CALLBACK_URL,
    scope: OAUTH_SCOPES,
    state,
    allow_signup: 'true',
  });
  return `${GITHUB_AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  const res = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: config.GITHUB_CLIENT_ID,
      client_secret: config.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: config.GITHUB_CALLBACK_URL,
    }),
  });

  if (!res.ok) {
    throw new Error(`GitHub token exchange failed: ${res.status}`);
  }

  const data = (await res.json()) as { access_token?: string; error?: string; error_description?: string };

  if (data.error || !data.access_token) {
    throw new Error(data.error_description ?? data.error ?? 'No access token returned');
  }

  return data.access_token;
}

export async function fetchGithubUser(accessToken: string) {
  const octokit = createOctokit(accessToken);
  const { data } = await octokit.users.getAuthenticated();
  return {
    userId: String(data.id),
    login: data.login,
    avatarUrl: data.avatar_url,
    name: data.name ?? data.login,
    email: data.email ?? null,
  };
}
