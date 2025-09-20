mod auth;
mod env_loader;
mod webserver;

use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::{
    RwLock,
    mpsc::{UnboundedSender, unbounded_channel},
};
use tokio_tungstenite::{accept_async, tungstenite::Message};

// AES encryption imports
use aes::Aes256;
use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;
use cbc::Decryptor;
use cbc::cipher::{BlockDecryptMut, KeyIvInit};
use pbkdf2::pbkdf2_hmac;
use sha2::Sha256;

type Aes256CbcDec = Decryptor<Aes256>;

// AES-256-CBC decryption
fn decrypt_message_aes(encrypted: &str, key: &[u8; 32]) -> Result<String, String> {
    let data = BASE64
        .decode(encrypted)
        .map_err(|e| format!("Base64 decode error: {}", e))?;

    if data.len() < 16 {
        return Err("Invalid encrypted data".to_string());
    }

    let (iv, ciphertext) = data.split_at(16);
    let mut buffer = ciphertext.to_vec();

    let iv_array: [u8; 16] = iv.try_into().map_err(|_| "Invalid IV length".to_string())?;
    let cipher = Aes256CbcDec::new(key.into(), &iv_array.into());
    cipher
        .decrypt_padded_mut::<cbc::cipher::block_padding::Pkcs7>(&mut buffer)
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum ClientMessage {
    PresenceUpdate {
        user: PresenceUser,
    },
    PresenceStatus {
        user_id: String,
        status: PresenceStatus,
    },
    ChatMessage {
        ciphertext: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum ServerMessage {
    PresenceSnapshot { users: Vec<PresenceUser> },
    PresenceUpdate { user: PresenceUser },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
enum PresenceStatus {
    Online,
    Idle,
    Dnd,
    Offline,
}

impl Default for PresenceStatus {
    fn default() -> Self {
        PresenceStatus::Online
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PresenceUser {
    id: String,
    username: String,
    #[serde(default)]
    status: PresenceStatus,
    avatar: Option<String>,
    email: Option<String>,
}

struct ClientHandle {
    sender: UnboundedSender<Message>,
    user_id: Option<String>,
}

type Clients = Arc<RwLock<HashMap<SocketAddr, ClientHandle>>>;
type PresenceState = Arc<RwLock<HashMap<String, PresenceUser>>>;
type PresenceConnections = Arc<RwLock<HashMap<String, usize>>>;

async fn broadcast(clients: &Clients, message: &ServerMessage) {
    match serde_json::to_string(message) {
        Ok(payload) => {
            let msg = Message::Text(payload);
            let clients_guard = clients.read().await;
            for (addr, client) in clients_guard.iter() {
                if client.sender.send(msg.clone()).is_err() {
                    eprintln!("Failed to deliver message to {}", addr);
                }
            }
        }
        Err(err) => {
            eprintln!("Failed to serialize server message: {}", err);
        }
    }
}

async fn send_snapshot_to_client(
    sender: &UnboundedSender<Message>,
    presence_state: &PresenceState,
) {
    let snapshot = {
        let state = presence_state.read().await;
        let users: Vec<PresenceUser> = state.values().cloned().collect();
        ServerMessage::PresenceSnapshot { users }
    };

    if let Ok(payload) = serde_json::to_string(&snapshot) {
        if sender.send(Message::Text(payload)).is_err() {
            eprintln!("Failed to send presence snapshot to client");
        }
    }
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

    // Start the WebSocket server that manages chat and user presence
    let chat_server_handle = tokio::spawn(async {
        let clients: Clients = Arc::new(RwLock::new(HashMap::new()));
        let presence_state: PresenceState = Arc::new(RwLock::new(HashMap::new()));
        let presence_connections: PresenceConnections = Arc::new(RwLock::new(HashMap::new()));

        let listener = TcpListener::bind("127.0.0.1:8081")
            .await
            .expect("Can't bind to port 8081");
        println!("WebSocket server on ws://127.0.0.1:8081");

        while let Ok((stream, addr)) = listener.accept().await {
            println!("New TCP connection: {}", addr);

            let clients = clients.clone();
            let presence_state = presence_state.clone();
            let presence_connections = presence_connections.clone();

            tokio::spawn(async move {
                // Accept WebSocket handshake
                let ws_stream = match accept_async(stream).await {
                    Ok(ws) => {
                        println!("WebSocket handshake successful: {}", addr);
                        ws
                    }
                    Err(e) => {
                        println!("Handshake failed with {}: {}", addr, e);
                        return;
                    }
                };

                let (mut ws_sender, mut ws_receiver) = ws_stream.split();

                // Prepare outbound channel for this client
                let (tx, mut rx) = unbounded_channel::<Message>();

                {
                    let mut clients_guard = clients.write().await;
                    clients_guard.insert(
                        addr,
                        ClientHandle {
                            sender: tx.clone(),
                            user_id: None,
                        },
                    );
                }

                send_snapshot_to_client(&tx, &presence_state).await;

                let writer_addr = addr;
                let writer = tokio::spawn(async move {
                    while let Some(message) = rx.recv().await {
                        if ws_sender.send(message).await.is_err() {
                            println!("Failed to send message to {}", writer_addr);
                            break;
                        }
                    }
                });

                // Generate AES-256 key for this connection using PBKDF2
                let password = "rustchatserver2024_aes_secure";
                let key = generate_aes_key(password);
                println!("Generated AES key for connection {}", addr);

                while let Some(msg) = ws_receiver.next().await {
                    match msg {
                        Ok(Message::Text(text)) => {
                            println!("[RECEIVED]: {}", text);

                            match serde_json::from_str::<ClientMessage>(&text) {
                                Ok(ClientMessage::PresenceUpdate { mut user }) => {
                                    if user.status == PresenceStatus::Offline {
                                        user.status = PresenceStatus::Online;
                                    }

                                    let mut registered = false;
                                    {
                                        let mut clients_guard = clients.write().await;
                                        if let Some(client) = clients_guard.get_mut(&addr) {
                                            if client.user_id.as_ref() != Some(&user.id) {
                                                client.user_id = Some(user.id.clone());
                                                registered = true;
                                            }
                                        }
                                    }

                                    if registered {
                                        let mut connections_guard =
                                            presence_connections.write().await;
                                        let counter =
                                            connections_guard.entry(user.id.clone()).or_insert(0);
                                        *counter += 1;
                                    }

                                    {
                                        let mut presence_guard = presence_state.write().await;
                                        presence_guard.insert(user.id.clone(), user.clone());
                                    }

                                    broadcast(&clients, &ServerMessage::PresenceUpdate { user })
                                        .await;
                                }
                                Ok(ClientMessage::PresenceStatus { user_id, status }) => {
                                    let updated_user = {
                                        let mut presence_guard = presence_state.write().await;
                                        if let Some(user) = presence_guard.get_mut(&user_id) {
                                            user.status = status.clone();
                                            Some(user.clone())
                                        } else {
                                            None
                                        }
                                    };

                                    if let Some(user) = updated_user {
                                        broadcast(
                                            &clients,
                                            &ServerMessage::PresenceUpdate { user },
                                        )
                                        .await;
                                    }
                                }
                                Ok(ClientMessage::ChatMessage { ciphertext }) => {
                                    match decrypt_message_aes(&ciphertext, &key) {
                                        Ok(decrypted) => {
                                            println!("[CHAT] {}", decrypted);
                                        }
                                        Err(err) => {
                                            println!("[CHAT DECRYPTION ERROR]: {}", err);
                                        }
                                    }
                                }
                                Err(_) => {
                                    // Try to decrypt raw payload for backward compatibility/logging
                                    match decrypt_message_aes(&text, &key) {
                                        Ok(decrypted) => {
                                            println!("[DECRYPTED]: {}", decrypted);
                                        }
                                        Err(e) => {
                                            println!(
                                                "[UNHANDLED MESSAGE]: {} (error: {})",
                                                text, e
                                            );
                                        }
                                    }
                                }
                            }
                        }
                        Ok(Message::Close(_)) => {
                            println!("WebSocket closed: {}", addr);
                            break;
                        }
                        Err(e) => {
                            println!("WebSocket error from {}: {}", addr, e);
                            break;
                        }
                        _ => {}
                    }
                }

                // Clean up writer task and drop sender
                drop(tx);
                let _ = writer.await;

                let disconnected_user = {
                    let mut clients_guard = clients.write().await;
                    clients_guard
                        .remove(&addr)
                        .and_then(|client| client.user_id)
                };

                if let Some(user_id) = disconnected_user {
                    let should_mark_offline = {
                        let mut connections_guard = presence_connections.write().await;
                        if let Some(count) = connections_guard.get_mut(&user_id) {
                            if *count > 1 {
                                *count -= 1;
                                false
                            } else {
                                connections_guard.remove(&user_id);
                                true
                            }
                        } else {
                            true
                        }
                    };

                    if should_mark_offline {
                        let offline_user = {
                            let mut presence_guard = presence_state.write().await;
                            if let Some(user) = presence_guard.get_mut(&user_id) {
                                user.status = PresenceStatus::Offline;
                                Some(user.clone())
                            } else {
                                None
                            }
                        };

                        if let Some(user) = offline_user {
                            broadcast(&clients, &ServerMessage::PresenceUpdate { user }).await;
                        }
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
