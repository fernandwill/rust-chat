// src/auth.rs
use serde::{Deserialize, Serialize};

// OAuth provider types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OAuthProvider {
    Google,
    GitHub,
}

// User profile from OAuth providers
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthUser {
    pub id: String,
    pub username: String,
    pub email: String,
    pub avatar: Option<String>,
    pub provider: OAuthProvider,
}

// OAuth configuration
#[derive(Debug, Clone)]
pub struct OAuthConfig {
    pub client_id: String,
    pub client_secret: String,
    pub redirect_uri: String,
}

// Get OAuth configuration from environment variables
pub fn get_oauth_config(provider: &OAuthProvider) -> Option<OAuthConfig> {
    match provider {
        OAuthProvider::Google => {
            let client_id = std::env::var("GOOGLE_CLIENT_ID").ok()?;
            let client_secret = std::env::var("GOOGLE_CLIENT_SECRET").ok()?;
            let redirect_uri = std::env::var("GOOGLE_REDIRECT_URI")
                .unwrap_or_else(|_| "http://localhost:8080/auth/google/callback".to_string());

            Some(OAuthConfig {
                client_id,
                client_secret,
                redirect_uri,
            })
        }
        OAuthProvider::GitHub => {
            let client_id = std::env::var("GITHUB_CLIENT_ID").ok()?;
            let client_secret = std::env::var("GITHUB_CLIENT_SECRET").ok()?;
            let redirect_uri = std::env::var("GITHUB_REDIRECT_URI")
                .unwrap_or_else(|_| "http://localhost:8080/auth/github/callback".to_string());

            Some(OAuthConfig {
                client_id,
                client_secret,
                redirect_uri,
            })
        }
    }
}

// Exchange authorization code for access token
pub async fn exchange_code_for_token(
    provider: &OAuthProvider,
    code: &str,
    config: &OAuthConfig,
) -> Result<String, Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();

    match provider {
        OAuthProvider::Google => {
            let params = [
                ("client_id", config.client_id.as_str()),
                ("client_secret", config.client_secret.as_str()),
                ("code", code),
                ("grant_type", "authorization_code"),
                ("redirect_uri", config.redirect_uri.as_str()),
            ];

            let res = client
                .post("https://oauth2.googleapis.com/token")
                .form(&params)
                .send()
                .await?;

            let json: serde_json::Value = res.json().await?;
            let access_token = json["access_token"]
                .as_str()
                .ok_or("No access token in response")?;

            Ok(access_token.to_string())
        }
        OAuthProvider::GitHub => {
            let params = [
                ("client_id", config.client_id.as_str()),
                ("client_secret", config.client_secret.as_str()),
                ("code", code),
                ("redirect_uri", config.redirect_uri.as_str()),
            ];

            let res = client
                .post("https://github.com/login/oauth/access_token")
                .header("Accept", "application/json")
                .form(&params)
                .send()
                .await?;

            let json: serde_json::Value = res.json().await?;
            let access_token = json["access_token"]
                .as_str()
                .ok_or("No access token in response")?;

            Ok(access_token.to_string())
        }
    }
}

// Get user profile from access token
pub async fn get_user_profile(
    provider: &OAuthProvider,
    access_token: &str,
) -> Result<OAuthUser, Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();

    match provider {
        OAuthProvider::Google => {
            let res = client
                .get("https://www.googleapis.com/oauth2/v2/userinfo")
                .header("Authorization", format!("Bearer {}", access_token))
                .send()
                .await?;

            let json: serde_json::Value = res.json().await?;

            Ok(OAuthUser {
                id: json["id"].as_str().unwrap_or_default().to_string(),
                username: json["name"].as_str().unwrap_or_default().to_string(),
                email: json["email"].as_str().unwrap_or_default().to_string(),
                avatar: json["picture"].as_str().map(|s| s.to_string()),
                provider: OAuthProvider::Google,
            })
        }
        OAuthProvider::GitHub => {
            let res = client
                .get("https://api.github.com/user")
                .header("Authorization", format!("Bearer {}", access_token))
                .header("User-Agent", "Rustcord")
                .send()
                .await?;

            let json: serde_json::Value = res.json().await?;

            // Get email separately as it might not be in the user endpoint
            let email = if let Some(email) = json["email"].as_str() {
                email.to_string()
            } else {
                // Try to get email from emails endpoint
                match client
                    .get("https://api.github.com/user/emails")
                    .header("Authorization", format!("Bearer {}", access_token))
                    .header("User-Agent", "Rustcord")
                    .send()
                    .await
                {
                    Ok(email_res) => {
                        if let Ok(emails) = email_res.json::<Vec<serde_json::Value>>().await {
                            emails
                                .iter()
                                .find(|email| email["primary"].as_bool().unwrap_or(false))
                                .and_then(|email| email["email"].as_str())
                                .unwrap_or("")
                                .to_string()
                        } else {
                            "".to_string()
                        }
                    }
                    Err(_) => "".to_string(),
                }
            };

            Ok(OAuthUser {
                id: json["id"].to_string(),
                username: json["login"].as_str().unwrap_or_default().to_string(),
                email,
                avatar: json["avatar_url"].as_str().map(|s| s.to_string()),
                provider: OAuthProvider::GitHub,
            })
        }
    }
}
