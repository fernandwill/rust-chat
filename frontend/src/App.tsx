import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import ChatArea from "./components/ChatArea";
import UserList from "./components/UserList";
import "./styles/Rustcord.css";

interface Message {
  id: string;
  author: string;
  content: string;
  timestamp: Date;
  avatar?: string;
}

interface Channel {
  id: string;
  name: string;
  type: 'text' | 'voice';
}

interface User {
  id: string;
  username: string;
  status: 'online' | 'idle' | 'dnd' | 'offline';
  avatar?: string;
  role?: string;
}

function App() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [activeChannel, setActiveChannel] = useState('general');

  // Mock data for demonstration
  const channels: Channel[] = [
    { id: 'general', name: 'general', type: 'text' },
    { id: 'random', name: 'random', type: 'text' },
    { id: 'rust-help', name: 'rust-help', type: 'text' },
    { id: 'announcements', name: 'announcements', type: 'text' },
    { id: 'general-voice', name: 'General', type: 'voice' },
    { id: 'coding-voice', name: 'Coding Session', type: 'voice' },
  ];

  const users: User[] = [
    { id: '1', username: 'RustDev', status: 'online', avatar: '🦀', role: 'Admin' },
    { id: '2', username: 'CodeMaster', status: 'online', avatar: '👨‍💻' },
    { id: '3', username: 'ChatBot', status: 'idle', avatar: '🤖' },
    { id: '4', username: 'WebDev', status: 'dnd', avatar: '🌐' },
    { id: '5', username: 'Sleepy', status: 'offline', avatar: '😴' },
  ];

  const onlineCount = users.filter(user => user.status !== 'offline').length;

  useEffect(() => {
    // Connect to WebSocket server
    setConnectionStatus('connecting');
    const socket = new WebSocket("ws://127.0.0.1:8080");

    socket.onopen = () => {
      console.log("✅ Connected to WebSocket");
      setConnectionStatus('connected');
      
      // Add welcome message
      const welcomeMessage: Message = {
        id: Date.now().toString(),
        author: 'Rustcord',
        content: 'Welcome to Rustcord! 🦀 Connected to WebSocket server.',
        timestamp: new Date(),
        avatar: '🦀'
      };
      setMessages([welcomeMessage]);
    };

    socket.onmessage = (event) => {
      const newMessage: Message = {
        id: Date.now().toString(),
        author: 'Server',
        content: event.data,
        timestamp: new Date(),
        avatar: '🖥️'
      };
      setMessages((prev) => [...prev, newMessage]);
    };

    socket.onclose = () => {
      console.log("❌ Disconnected from WebSocket");
      setConnectionStatus('disconnected');
    };

    socket.onerror = () => {
      setConnectionStatus('disconnected');
    };

    setWs(socket);

    return () => socket.close();
  }, []);

  const sendMessage = () => {
    if (ws && input.trim() !== "") {
      // Send to server
      ws.send(input);
      
      // Add to local messages
      const userMessage: Message = {
        id: Date.now().toString(),
        author: 'RustDev',
        content: input,
        timestamp: new Date(),
        avatar: '🦀'
      };
      setMessages((prev) => [...prev, userMessage]);
      setInput("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleChannelSelect = (channelId: string) => {
    setActiveChannel(channelId);
    // In a real app, you'd load messages for this channel
  };

  const activeChannelName = channels.find(ch => ch.id === activeChannel)?.name || 'general';

  return (
    <div className="rustcord-app">
      <div className={`connection-status ${connectionStatus}`}>
        {connectionStatus === 'connected' && '🟢 Connected'}
        {connectionStatus === 'connecting' && '🟡 Connecting...'}
        {connectionStatus === 'disconnected' && '🔴 Disconnected'}
      </div>

      <Sidebar
        channels={channels}
        activeChannel={activeChannel}
        onChannelSelect={handleChannelSelect}
      />

      <ChatArea
        channelName={activeChannelName}
        messages={messages}
        input={input}
        onInputChange={setInput}
        onKeyPress={handleKeyPress}
      />

      <UserList
        users={users}
        onlineCount={onlineCount}
      />
    </div>
  );
}

export default App;
