use tokio::net::TcpStream;
use tokio::io::{self, AsyncBufReadExt, AsyncWriteExt, BufReader};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let stream = TcpStream::connect("127.0.0.1:8080").await?;
    println!("Connected to server at 127.0.0.1:8080");

    let (reader, mut writer) = stream.into_split();

    let mut socket_reader = BufReader::new(reader).lines();
    let mut stdin_reader = BufReader::new(io::stdin()).lines();

    tokio::spawn(async move {
        while let Ok(Some(line)) = socket_reader.next_line().await {
            println!("{}", line);
        }
        println!("Disconnected from server");
    });

    while let Ok(Some(line)) = stdin_reader.next_line().await {
        if line.trim() == "/quit" {
            println!("Disconnecting...");
            break;
        }
        writer.write_all(line.as_bytes()).await?;
        writer.write_all(b"\n").await?;
    }

    Ok(())
}
