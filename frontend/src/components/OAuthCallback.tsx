// src/components/OAuthCallback.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

interface OAuthCallbackProps {
  onLoginSuccess: (user: any) => void;
}

const OAuthCallback: React.FC<OAuthCallbackProps> = ({ onLoginSuccess }) => {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get parameters from URL
        const provider = searchParams.get('provider');
        const token = searchParams.get('token');
        const username = searchParams.get('username');
        const email = searchParams.get('email');
        const avatar = searchParams.get('avatar');
        const oauthError = searchParams.get('error');
        
        // Check if there was an OAuth error
        if (oauthError) {
          setError(`OAuth error: ${oauthError}`);
          return;
        }
        
        // Check if we have the required parameters
        if (provider && token && username && email) {
          // Create user object from the parameters
          const user = {
            id: `oauth_${provider}_${Date.now()}`,
            username,
            email,
            avatar: avatar || undefined,
            provider,
          };
          
          // Notify the parent component of successful login
          onLoginSuccess(user);
          // Navigate back to the main app
          navigate('/');
        }
        // If we don't have the parameters, this might be the initial OAuth callback
        // from the provider to our backend, which will then redirect back to /login
        // with the parameters. In that case, we just wait.
      } catch (err) {
        console.error('Error handling OAuth callback:', err);
        setError('An error occurred during authentication');
      }
    };
    
    handleCallback();
  }, [searchParams, navigate]);
  
  if (error) {
    return (
      <div className="oauth-callback">
        <div className="error-message">
          <h2>Authentication Error</h2>
          <p>{error}</p>
          <button onClick={() => navigate('/login')}>Back to Login</button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="oauth-callback">
      <div className="loading-message">
        <p>Authenticating...</p>
      </div>
    </div>
  );
};

export default OAuthCallback;