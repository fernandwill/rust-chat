import { useEffect, useState } from "react";

function App() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    // Connect to WebSocket server
    const socket = new WebSocket("ws://127.0.0.1:8080");

    socket.onopen = () => {
      console.log("✅ Connected to WebSocket");
    };

    socket.onmessage = (event) => {
      setMessages((prev) => [...prev, `Server: ${event.data}`]);
    };

    socket.onclose = () => {
      console.log("❌ Disconnected from WebSocket");
    };

    setWs(socket);

    return () => socket.close();
  }, []);

  const sendMessage = () => {
    if (ws && input.trim() !== "") {
      ws.send(input);
      setMessages((prev) => [...prev, `You: ${input}`]);
      setInput("");
    }
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>React WebSocket Chat</h1>
      <div
        style={{
          border: "1px solid #ccc",
          height: "300px",
          overflowY: "auto",
          marginBottom: "1rem",
          padding: "0.5rem",
        }}
      >
        {messages.map((msg, i) => (
          <p key={i}>{msg}</p>
        ))}
      </div>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Type a message..."
        style={{ padding: "0.5rem", width: "70%" }}
      />
      <button
        onClick={sendMessage}
        style={{ padding: "0.5rem", marginLeft: "0.5rem" }}
      >
        Send
      </button>
    </div>
  );
}

export default App;
