use std::sync::{Arc, Mutex};

use axum::{
    extract::{Query, State, WebSocketUpgrade},
    http::StatusCode,
    response::{IntoResponse, Redirect},
    routing::{get},
    Router,
};
use axum::extract::ws::{WebSocket, Message as WsMessage};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tower_http::cors::CorsLayer;

use dotenv::dotenv;
use std::env;


use aes::Aes256;
use cbc::{Encryptor, Decryptor};
use cbc::cipher::{BlockEncryptMut, BlockDecryptMut, KeyIvInit};
use rand::{Rng, thread_rng};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;

type Aes256CbcEnc = Encryptor<Aes256>;
type Aes256CbcDec = Decryptor<Aes256>;

// AES-256-CBC encryption
fn encrypt_message_aes(message: &str, key: &[u8; 32]) -> String {
    let mut rng = thread_rng();
    let mut iv = [0u8; 16];
    rng.fill(&mut iv);
    
    let mut buffer = message.as_bytes().to_vec();
    
    // PKCS7 padding
    let padding_len = 16 - (buffer.len() % 16);
    for _ in 0..padding_len {
        buffer.push(padding_len as u8);
    }
    
    let cipher = Aes256CbcEnc::new(key.into(), &iv.into());
    let buffer_len = buffer.len();
    cipher.encrypt_padded_mut::<cbc::cipher::block_padding::NoPadding>(&mut buffer, buffer_len).unwrap();
    
    let mut result = iv.to_vec();
    result.extend_from_slice(&buffer);
    BASE64.encode(&result)
}

// AES-256-CBC decryption
fn decrypt_message_aes(encrypted: &str, key: &[u8; 32]) -> Result<String, String> {
    let data = BASE64.decode(encrypted).map_err(|e| format!("Base64 decode error: {}", e))?;
    
    if data.len() < 16 {
        return Err("Invalid encrypted data".to_string());
    }
    
    let (iv, ciphertext) = data.split_at(16);
    let mut buffer = ciphertext.to_vec();
    
    let iv_array: [u8; 16] = iv.try_into().map_err(|_| "Invalid IV length".to_string())?;
    let cipher = Aes256CbcDec::new(key.into(), &iv_array.into());
    cipher.decrypt_padded_mut::<cbc::cipher::block_padding::Pkcs7>(&mut buffer)
        .map_err(|e| format!("Decryption error: {}", e))?;
    
    String::from_utf8(buffer).map_err(|e| format!("UTF-8 error: {}", e))
}

// Generate AES key from password
fn generate_aes_key(password: &str) -> [u8; 32] {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    
    let mut hasher = DefaultHasher::new();
    password.hash(&mut hasher);
    let hash = hasher.finish();
    
    let mut key = [0u8; 32];
    let hash_bytes = hash.to_le_bytes();
    
    // Repeat the hash to fill the 32-byte key
    for i in 0..32 {
        key[i] = hash_bytes[i % 8];
    }
    
    // XOR with password bytes for additional entropy
    let password_bytes = password.as_bytes();
    for (i, &byte) in password_bytes.iter().enumerate() {
        key[i % 32] ^= byte;
    }
    
    key
}

#[derive(Serialize, Deserialize, Clone)]
struct User {
    id: String,
    username: String,
    email: String,
    provider: String,
}

type AppState = Arc<Mutex<Vec<User>>>;

#[derive(Deserialize)]
struct CodeParams {
    code: String,
}

async fn google_callback(
    Query(params): Query<CodeParams>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let client_id = env::var("GOOGLE_CLIENT_ID").ok();
    let client_secret = env::var("GOOGLE_CLIENT_SECRET").ok();
    let redirect_uri = env::var("GOOGLE_REDIRECT_URI").unwrap_or_else(|_| "http://localhost:8080/auth/google/callback".to_string());

    if client_id.is_none() || client_secret.is_none() {
        return (StatusCode::INTERNAL_SERVER_ERROR, "Missing OAuth credentials").into_response();
    }

    let client = reqwest::Client::new();
    let token_response = match client
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("client_id", client_id.as_ref().unwrap()),
            ("client_secret", client_secret.as_ref().unwrap()),
            ("code", &params.code),
            ("grant_type", &"authorization_code".to_string()),
            ("redirect_uri", &redirect_uri),
        ])
        .send()
        .await {
            Ok(resp) => match resp.json::<Value>().await {
                Ok(json) => json["access_token"].as_str().map(|t| t.to_string()),
                Err(_) => None,
            },
            Err(_) => None,
        };

    if let Some(access_token) = token_response {
        let user_info = match client
            .get("https://www.googleapis.com/oauth2/v2/userinfo")
            .bearer_auth(access_token)
            .send()
            .await {
                Ok(resp) => resp.json::<Value>().await.ok(),
                Err(_) => None,
            };

        if let Some(info) = user_info {
            if let (Some(id), Some(name), Some(email)) = (
                info["id"].as_str(),
                info["name"].as_str(),
                info["email"].as_str(),
            ) {
                let user = User {
                    id: id.to_string(),
                    username: name.to_string(),
                    email: email.to_string(),
                    provider: "google".to_string(),
                };
                state.lock().unwrap().push(user);
                return Redirect::to("http://localhost:5173/?auth=success&provider=google").into_response();
            }
        }
    }

    (StatusCode::INTERNAL_SERVER_ERROR, "OAuth exchange failed").into_response()
}

async fn github_callback(
    Query(params): Query<CodeParams>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let client_id = env::var("GITHUB_CLIENT_ID").ok();
    let client_secret = env::var("GITHUB_CLIENT_SECRET").ok();
    let redirect_uri = env::var("GITHUB_REDIRECT_URI").unwrap_or_else(|_| "http://localhost:8080/auth/github/callback".to_string());

    if client_id.is_none() || client_secret.is_none() {
        return (StatusCode::INTERNAL_SERVER_ERROR, "Missing OAuth credentials").into_response();
    }

    let client = reqwest::Client::new();
    let token_response = match client
        .post("https://github.com/login/oauth/access_token")
        .form(&[
            ("client_id", client_id.as_ref().unwrap()),
            ("client_secret", client_secret.as_ref().unwrap()),
            ("code", &params.code),
            ("redirect_uri", &redirect_uri),
        ])
        .header("Accept", "application/json")
        .send()
        .await {
            Ok(resp) => match resp.json::<Value>().await {
                Ok(json) => json["access_token"].as_str().map(|t| t.to_string()),
                Err(_) => None,
            },
            Err(_) => None,
        };

    if let Some(access_token) = token_response {
        let user_info = match client
            .get("https://api.github.com/user")
            .header("Authorization", format!("Bearer {}", access_token))
            .header("User-Agent", "RustChatServer")
            .send()
            .await {
                Ok(resp) => resp.json::<Value>().await.ok(),
                Err(_) => None,
            };

        if let Some(info) = user_info {
            if let (Some(id), Some(login), Some(email)) = (
                info["id"].as_i64().map(|i| i.to_string()),
                info["login"].as_str(),
                info["email"].as_str().or(Some("unknown@example.com")),
            ) {
                let user = User {
                    id,
                    username: login.to_string(),
                    email: email.to_string(),
                    provider: "github".to_string(),
                };
                state.lock().unwrap().push(user);
                return Redirect::to("http://localhost:5173/?auth=success&provider=github").into_response();
            }
        }
    }

    (StatusCode::INTERNAL_SERVER_ERROR, "OAuth exchange failed").into_response()
}

async fn ws_handler(ws: WebSocketUpgrade) -> impl IntoResponse {
    ws.on_upgrade(handle_socket)
}

async fn handle_socket(mut socket: WebSocket) {
    let addr = "unknown";
    println!("✅ WebSocket connection established: {}", addr);

    let password = "rustchatserver2024_aes_secure";
    let key = generate_aes_key(password);

    while let Some(msg) = socket.recv().await {
        match msg {
            Ok(WsMessage::Text(text)) => {
                let encrypted_msg = encrypt_message_aes(&text, &key);
                println!("[AES] {}: {}", addr, encrypted_msg);
                
                match decrypt_message_aes(&encrypted_msg, &key) {
                    Ok(decrypted) => println!("[DECRYPTED] {}: {}", addr, decrypted),
                    Err(e) => eprintln!("Decryption error: {}", e),
                }
                
                let server_response = format!("Server received: {}", text);
                let encrypted_response = encrypt_message_aes(&server_response, &key);
                if let Err(e) = socket.send(WsMessage::Text(encrypted_response)).await {
                    eprintln!("Send error: {}", e);
                    break;
                }
            }
            Ok(WsMessage::Binary(data)) => {
                println!("{} sent binary data ({} bytes)", addr, data.len());
                if let Err(e) = socket.send(WsMessage::Binary(data)).await {
                    eprintln!("Send error: {}", e);
                    break;
                }
            }
            Ok(WsMessage::Ping(payload)) => {
                println!("Received ping from {}", addr);
                if let Err(e) = socket.send(WsMessage::Pong(payload)).await {
                    eprintln!("Pong send error: {}", e);
                    break;
                }
            }
            Ok(WsMessage::Pong(_)) => {
                println!("Received pong from {}", addr);
            }
            Ok(WsMessage::Close(close_frame)) => {
                println!("Received close frame from {}: {:?}", addr, close_frame);
                let _ = socket.send(WsMessage::Close(close_frame)).await;
                break;
            }
            Err(e) => {
                eprintln!("Recv error from {}: {}", addr, e);
                break;
            }
        }
    }

    println!("🔌 Connection closed: {}", addr);
}

#[tokio::main]
async fn main() {
    dotenv().ok();

    let state = Arc::new(Mutex::new(Vec::<User>::new()));

    let app = Router::new()
        .route("/auth/google/callback", get(google_callback))
        .route("/auth/github/callback", get(github_callback))
        .route("/", get(ws_handler))
        .with_state(state)
        .layer(CorsLayer::permissive());

    println!("WebSocket server running at ws://127.0.0.1:8080");

    if let Err(e) = axum::Server::bind(&"127.0.0.1:8080".parse().unwrap())
        .serve(app.into_make_service())
        .await {
        eprintln!("Server error: {}", e);
    }
}