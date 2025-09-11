use tokio::net::TcpListener;
use tokio_tungstenite::accept_async;
use futures_util::{StreamExt, SinkExt};
use std::net::SocketAddr;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let addr = "127.0.0.1:8080";
    let listener = TcpListener::bind(addr).await?;
    println!("WebSocket server running on ws://{addr}");

    while let Ok((stream, peer)) = listener.accept().await {
        tokio::spawn(handle_connection(stream, peer));
    }

    Ok(())
}

async fn handle_connection(stream: tokio::net::TcpStream, peer: SocketAddr) {
    println!("New connection: {peer}");

    let ws_stream = match accept_async(stream).await {
        Ok(ws) => ws,
        Err(e) => {
            eprintln!("WebSocket handshake failed with {peer}: {e}");
            return;
        }
    };

    let (mut write, mut read) = ws_stream.split();

    // Echo loop
    while let Some(msg) = read.next().await {
        match msg {
            Ok(msg) => {
                println!("{peer}: {msg}");

                if let Err(e) = write.send(msg).await {
                    eprintln!("Error sending to {peer}: {e}");
                    break;
                }
            }
            Err(e) => {
                eprintln!("Error receiving from {peer}: {e}");
                break;
            }
        }
    }

    println!("Connection closed: {peer}");
}
