use tokio::net::TcpListener;
use tokio_tungstenite::accept_async;
use tokio_tungstenite::tungstenite::protocol::Message;
use futures_util::{StreamExt, SinkExt};
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

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let listener = TcpListener::bind("127.0.0.1:8080").await?;
    println!("WebSocket server running at ws://127.0.0.1:8080");

    loop {
        let (stream, addr) = listener.accept().await?;
        println!("New TCP connection: {}", addr);

        tokio::spawn(async move {
            match accept_async(stream).await {
                Ok(mut ws_stream) => {
                    println!("✅ WebSocket connection established: {}", addr);

                    while let Some(msg) = ws_stream.next().await {
                        match msg {
                            Ok(Message::Text(text)) => {
                                // Generate AES key from password
                                let password = "rustchatserver2024_aes_secure";
                                let key = generate_aes_key(password);
                                
                                // Log encrypted message to server console using AES
                                let encrypted_msg = encrypt_message_aes(&text, &key);
                                println!("[AES] {}: {}", addr, encrypted_msg);
                                
                                // Also show how to decrypt (for demonstration)
                                match decrypt_message_aes(&encrypted_msg, &key) {
                                    Ok(decrypted) => println!("[DECRYPTED] {}: {}", addr, decrypted),
                                    Err(e) => eprintln!("Decryption error: {}", e),
                                }
                                
                                // Send back encrypted response (hidden from client display)
                                let server_response = format!("Server received: {}", text);
                                let encrypted_response = encrypt_message_aes(&server_response, &key);
                                if let Err(e) = ws_stream.send(Message::Text(encrypted_response)).await {
                                    eprintln!("Send error: {}", e);
                                    break;
                                }
                            }
                            Ok(Message::Binary(data)) => {
                                println!("{} sent binary data ({} bytes)", addr, data.len());
                                // Echo binary data back
                                if let Err(e) = ws_stream.send(Message::Binary(data)).await {
                                    eprintln!("Send error: {}", e);
                                    break;
                                }
                            }
                            Ok(Message::Ping(payload)) => {
                                println!("Received ping from {}", addr);
                                // Respond to ping with pong
                                if let Err(e) = ws_stream.send(Message::Pong(payload)).await {
                                    eprintln!("Pong send error: {}", e);
                                    break;
                                }
                            }
                            Ok(Message::Pong(_)) => {
                                println!("Received pong from {}", addr);
                                // Pong received, connection is alive
                            }
                            Ok(Message::Close(close_frame)) => {
                                println!("Received close frame from {}: {:?}", addr, close_frame);
                                // Respond to close frame and break
                                let _ = ws_stream.send(Message::Close(close_frame)).await;
                                break;
                            }
                            Ok(Message::Frame(_)) => {
                                // Raw frames are handled internally by tungstenite
                            }
                            Err(e) => {
                                eprintln!("Recv error from {}: {}", addr, e);
                                break;
                            }
                        }
                    }

                    println!("🔌 Connection closed: {}", addr);
                }
                Err(e) => {
                    eprintln!("Handshake failed with {}: {}", addr, e);
                }
            }
        });
    }
}