mod auth;
mod webserver;
mod env_loader;

use tokio::net::TcpListener;
use tokio_tungstenite::{accept_async, tungstenite::Message};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};

// AES encryption imports
use aes::Aes256;
use cbc::{Decryptor};
use cbc::cipher::{BlockDecryptMut, KeyIvInit};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use pbkdf2::pbkdf2_hmac;
use sha2::Sha256;

type Aes256CbcDec = Decryptor<Aes256>;

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

// Generate AES-256 key from password using PBKDF2 (matching frontend implementation)
fn generate_aes_key(password: &str) -> [u8; 32] {
    let salt = b"rustchatserver2024_aes_secure";
    let mut key = [0u8; 32];
    pbkdf2_hmac::<Sha256>(password.as_bytes(), salt, 100000, &mut key);
    key
}

// User struct for OAuth
#[derive(Debug, Clone, Serialize, Deserialize)]
struct User {
    id: String,
    username: String,
    email: String,
    provider: String,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Load environment variables from .env file
    if let Err(e) = env_loader::load_env_file() {
        eprintln!("Warning: Could not load .env file: {}", e);
    }
    
    // Start the web server for OAuth and serving the frontend
    let webserver_handle = tokio::spawn(async {
        if let Err(e) = webserver::run().await {
            eprintln!("Web server error: {}", e);
        }
    });

    // Start the WebSocket server that only logs messages without broadcasting
    let chat_server_handle = tokio::spawn(async {
        let listener = TcpListener::bind("127.0.0.1:8081").await.expect("Can't bind to port 8081");
        println!("WebSocket server on ws://127.0.0.1:8081");

        while let Ok((stream, addr)) = listener.accept().await {
            println!("New TCP connection: {}", addr);
            
            tokio::spawn(async move {
                // Accept WebSocket handshake
                let ws_stream = match accept_async(stream).await {
                    Ok(ws) => {
                        println!("WebSocket handshake successful: {}", addr);
                        ws
                    },
                    Err(e) => {
                        println!("Handshake failed with {}: {}", addr, e);
                        return;
                    }
                };

                let (_, mut ws_receiver) = ws_stream.split();
                
                // Generate AES-256 key for this connection using PBKDF2
                let password = "rustchatserver2024_aes_secure";
                let key = generate_aes_key(password);
                println!("Generated AES key for connection {}", addr);

                // Read messages from this client but don't broadcast them
                while let Some(msg) = ws_receiver.next().await {
                    match msg {
                        Ok(Message::Text(text)) => {
                            println!("[RECEIVED]: {}", text);
                            // Try to decrypt the message from client
                            match decrypt_message_aes(&text, &key) {
                                Ok(decrypted) => {
                                    println!("[ENCRYPTED]: {}", text);
                                    println!("[DECRYPTED]: {}", decrypted);
                                },
                                Err(e) => {
                                    // If decryption fails, show the error and treat as plain text
                                    println!("[DECRYPTION ERROR]: {}", e);
                                    println!("[PLAIN TEXT]: {}", text);
                                }
                            }
                        },
                        Ok(Message::Close(_)) => {
                            println!("WebSocket closed: {}", addr);
                            break;
                        },
                        Err(e) => {
                            println!("WebSocket error from {}: {}", addr, e);
                            break;
                        },
                        _ => {}
                    }
                }

                println!("Connection closed: {}", addr);
            });
        }
    });

    // Wait for both servers to finish (they won't in normal operation)
    tokio::select! {
        _ = webserver_handle => {},
        _ = chat_server_handle => {},
    }

    Ok(())
}