mod auth;
mod webserver;
mod env_loader;

use tokio::net::TcpListener;
use tokio::sync::broadcast;
use tokio_tungstenite::{accept_async, tungstenite::Message};
use futures_util::{SinkExt, StreamExt};

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

    // Start the WebSocket chat server
    let chat_server_handle = tokio::spawn(async {
        let listener = TcpListener::bind("127.0.0.1:8081").await.unwrap();
        println!("WebSocket server on ws://127.0.0.1:8081");

        // Broadcast channel for messages
        let (tx, _rx) = broadcast::channel::<String>(100);

        while let Ok((stream, addr)) = listener.accept().await {
            println!("New TCP connection: {}", addr);
            
            let tx = tx.clone();
            let mut rx = tx.subscribe();

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

                let (mut ws_sender, mut ws_receiver) = ws_stream.split();

                // Task for receiving broadcast messages and sending them to this client
                let tx_clone = tx.clone();
                tokio::spawn(async move {
                    while let Ok(msg) = rx.recv().await {
                        if ws_sender.send(Message::Text(msg)).await.is_err() {
                            break;
                        }
                    }
                });

                // Read messages from this client and broadcast to all
                while let Some(msg) = ws_receiver.next().await {
                    match msg {
                        Ok(Message::Text(text)) => {
                            let broadcast_msg = format!("{}: {}", addr, text);
                            println!("Received: {}", broadcast_msg);
                            let _ = tx_clone.send(broadcast_msg);
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