use tokio::net::TcpListener;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::sync::{broadcast, Mutex};
use std::sync::Arc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let listener = TcpListener::bind("127.0.0.1:8080").await?;
    println!("Server on http://127.0.0.1:8080");

    // Broadcast channel for chat messages
    let (tx, _rx) = broadcast::channel::<String>(100);

    loop {
        let (socket, addr) = listener.accept().await?;
        println!("New connection: {}", addr);

        let tx = tx.clone();
        let mut rx = tx.subscribe();

        tokio::spawn(async move {
            let (reader, writer) = socket.into_split();
            let mut buf_reader = BufReader::new(reader).lines();
            let writer = Arc::new(Mutex::new(writer));

            // Task for receiving broadcast messages and sending them to this client
            let writer_clone = Arc::clone(&writer);
            tokio::spawn(async move {
                while let Ok(msg) = rx.recv().await {
                    let mut w = writer_clone.lock().await;
                    if w.write_all(msg.as_bytes()).await.is_err() {
                        break;
                    }
                }
            });

            // Read input from this client and broadcast to all
            while let Ok(Some(line)) = buf_reader.next_line().await {
                let msg = format!("{}: {}\n", addr, line);
                println!("{}", msg.trim_end());
                let _ = tx.send(msg);
            }

            println!("Connection closed: {}", addr);
        });
    }
}