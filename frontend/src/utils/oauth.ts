// src/utils/oauth.ts

// OAuth configuration
export const OAuthProviders = {
  GOOGLE: 'google',
  GITHUB: 'github'
} as const;

export type OAuthProvider = typeof OAuthProviders[keyof typeof OAuthProviders];

// OAuth configuration
export interface OAuthConfig {
  clientId: string;
  redirectUri: string;
  scope: string;
}

// User profile from OAuth providers
export interface OAuthUser {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  provider: OAuthProvider;
}

// Google OAuth configuration
export const getGoogleOAuthConfig = (): OAuthConfig => {
  return {
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    redirectUri: import.meta.env.VITE_GOOGLE_REDIRECT_URI || 'http://localhost:8080/auth/google/callback',
    scope: 'openid profile email'
  };
};

// GitHub OAuth configuration
export const getGitHubOAuthConfig = (): OAuthConfig => {
  return {
    clientId: import.meta.env.VITE_GITHUB_CLIENT_ID,
    redirectUri: import.meta.env.VITE_GITHUB_REDIRECT_URI || 'http://localhost:8080/auth/github/callback',
    scope: 'user:email read:user'
  };
};

// Generate OAuth URL for Google
export const getGoogleOAuthUrl = (): string => {
  const config = getGoogleOAuthConfig();
  
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: config.scope,
    access_type: 'offline',
    prompt: 'consent'
  });
  
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
};

// Generate OAuth URL for GitHub
export const getGitHubOAuthUrl = (): string => {
  const config = getGitHubOAuthConfig();
  
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scope
  });
  
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
};