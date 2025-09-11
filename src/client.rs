use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};
use futures_util::{StreamExt, SinkExt};
use tokio::io::{self, AsyncBufReadExt, BufReader};
use url::Url;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let url = Url::parse("ws://127.0.0.1:8080")?;
    println!("Connecting to WebSocket server at {}", url);

    let (ws_stream, _) = connect_async(url).await?;
    println!("✅ Connected to WebSocket server");

    let (mut write, mut read) = ws_stream.split();

    // Spawn task to handle incoming messages
    let read_task = tokio::spawn(async move {
        while let Some(msg) = read.next().await {
            match msg {
                Ok(Message::Text(text)) => {
                    println!("Server: {}", text);
                }
                Ok(Message::Binary(data)) => {
                    println!("Server sent binary data ({} bytes)", data.len());
                }
                Ok(Message::Ping(_)) => {
                    println!("Received ping from server");
                }
                Ok(Message::Pong(_)) => {
                    println!("Received pong from server");
                }
                Ok(Message::Close(close_frame)) => {
                    println!("Server closed connection: {:?}", close_frame);
                    break;
                }
                Ok(Message::Frame(_)) => {
                    // Raw frames are handled internally
                }
                Err(e) => {
                    eprintln!("Error receiving message: {}", e);
                    break;
                }
            }
        }
        println!("🔌 Disconnected from server");
    });

    // Handle user input
    let stdin = io::stdin();
    let mut reader = BufReader::new(stdin).lines();

    println!("Type messages to send (type '/quit' to exit):");

    while let Ok(Some(line)) = reader.next_line().await {
        let trimmed = line.trim();
        
        if trimmed == "/quit" {
            println!("Disconnecting...");
            let _ = write.send(Message::Close(None)).await;
            break;
        }
        
        if !trimmed.is_empty() {
            if let Err(e) = write.send(Message::Text(trimmed.to_string())).await {
                eprintln!("Error sending message: {}", e);
                break;
            }
        }
    }

    // Wait for read task to finish
    let _ = read_task.await;
    
    Ok(())
}