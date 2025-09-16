// src/webserver.rs
use axum::{
    extract::{Query, Path},
    http::StatusCode,
    response::{IntoResponse, Redirect},
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};

use crate::auth::{OAuthProvider, get_oauth_config, exchange_code_for_token, get_user_profile};

#[derive(Deserialize)]
struct AuthRequest {
    provider: String,
}

#[derive(Deserialize)]
struct OAuthCallbackQuery {
    code: String,
}

#[derive(Serialize)]
struct AuthResponse {
    url: String,
}


// Redirect to the frontend application
async fn serve_frontend() -> impl IntoResponse {
    Redirect::to("http://localhost:5173")
}

// Initiate OAuth flow
async fn initiate_oauth(Query(request): Query<AuthRequest>) -> Result<Json<AuthResponse>, StatusCode> {
    let provider = match request.provider.as_str() {
        "google" => OAuthProvider::Google,
        "github" => OAuthProvider::GitHub,
        _ => return Err(StatusCode::BAD_REQUEST),
    };
    
    let config = get_oauth_config(&provider).ok_or(StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let auth_url = match provider {
        OAuthProvider::Google => {
            format!(
                "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope=openid%20profile%20email&access_type=offline&prompt=consent",
                config.client_id,
                urlencoding::encode(&config.redirect_uri)
            )
        },
        OAuthProvider::GitHub => {
            format!(
                "https://github.com/login/oauth/authorize?client_id={}&redirect_uri={}&scope=user:email%20read:user",
                config.client_id,
                urlencoding::encode(&config.redirect_uri)
            )
        },
    };
    
    Ok(Json(AuthResponse { url: auth_url }))
}

// Handle OAuth callback
async fn oauth_callback(
    Path(provider_name): Path<String>,
    Query(query): Query<OAuthCallbackQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let provider = match provider_name.as_str() {
        "google" => OAuthProvider::Google,
        "github" => OAuthProvider::GitHub,
        _ => return Err((StatusCode::BAD_REQUEST, "Invalid provider".to_string())),
    };
    
    let config = get_oauth_config(&provider)
        .ok_or((StatusCode::INTERNAL_SERVER_ERROR, "OAuth not configured".to_string()))?;
    
    // Exchange code for access token
    let access_token = exchange_code_for_token(&provider, &query.code, &config)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to exchange code: {}", e)))?;
    
    // Get user profile
    let user = get_user_profile(&provider, &access_token)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to get user profile: {}", e)))?;
    
    // In a real application, you would generate a JWT token here
    // For this example, we'll just return the access token
    let token = access_token;
    
    // Redirect back to the frontend OAuth callback page with user data as query parameters
    let redirect_url = format!(
        "http://localhost:5173/oauth/callback?provider={}&token={}&username={}&email={}",
        provider_name,
        urlencoding::encode(&token),
        urlencoding::encode(&user.username),
        urlencoding::encode(&user.email)
    );
    
    Ok(Redirect::to(&redirect_url))
}

// Health check endpoint
async fn health_check() -> impl IntoResponse {
    "OK"
}

pub async fn run() -> Result<(), Box<dyn std::error::Error>> {
    // Build our application with CORS
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/", get(serve_frontend))
        .route("/health", get(health_check))
        .route("/auth/:provider", get(initiate_oauth))
        .route("/auth/:provider/callback", get(oauth_callback))
        .layer(cors);

    // Run our application
    let addr = SocketAddr::from(([127, 0, 0, 1], 8080));
    println!("Web server running on http://{}", addr);
    
    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await?;
        
    Ok(())
}