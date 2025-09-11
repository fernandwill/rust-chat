use tokio::net::TcpListener;
use tokio_tungstenite::accept_async;
use tokio_tungstenite::tungstenite::protocol::Message;
use futures_util::{StreamExt, SinkExt};

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
                                println!("{} says: {}", addr, text);
                                // Echo the message back
                                if let Err(e) = ws_stream.send(Message::Text(text)).await {
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