import { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import ChatArea from "./components/ChatArea";
import UserList from "./components/UserList";
import LoginPage from "./components/LoginPage";
import OAuthCallback from "./components/OAuthCallback";
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

interface CurrentUser {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  provider: string;
}

function App() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [activeChannel, setActiveChannel] = useState('general');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

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

  const handleLoginSuccess = (user: CurrentUser) => {
    console.log("✅ OAuth login successful", user);
    setCurrentUser(user);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    if (ws) {
      ws.close();
      setWs(null);
    }
    setMessages([]);
    setConnectionStatus('disconnected');
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    // Connect to WebSocket server (now on port 8081)
    setConnectionStatus('connecting');
    const socket = new WebSocket("ws://127.0.0.1:8081");

    socket.onopen = () => {
      console.log("✅ Connected to WebSocket");
      setConnectionStatus('connected');
      
      // Add welcome message
      const welcomeMessage: Message = {
        id: Date.now().toString(),
        author: 'Rustcord',
        content: 'Welcome to Rustcord! Connected to WebSocket server.',
        timestamp: new Date(),
        avatar: '🦀'
      };
      setMessages([welcomeMessage]);
    };

    socket.onmessage = (event) => {
      // Server responses are now hidden from client display
      // Only server logs will show the encrypted messages
      console.log("Server response received (hidden from chat):", event.data);
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
  }, [isAuthenticated]);

  const sendMessage = () => {
    if (ws && input.trim() !== "") {
      // Send to server
      ws.send(input);
      
      // Add to local messages
      const userMessage: Message = {
        id: Date.now().toString(),
        author: currentUser?.username || 'User',
        content: input,
        timestamp: new Date(),
        avatar: currentUser?.avatar || '👤'
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
    <Router>
      <Routes>
        <Route path="/login" element={
          !isAuthenticated ? <LoginPage onLoginSuccess={handleLoginSuccess} /> : <Navigate to="/" />
        } />
        <Route path="/oauth/callback" element={
          <OAuthCallback onLoginSuccess={handleLoginSuccess} />
        } />
        <Route path="/" element={
          isAuthenticated ? (
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
                currentUser={currentUser ? {
                  ...currentUser,
                  avatar: currentUser.avatar || '👤'
                } : null}
                onLogout={handleLogout}
              />
            </div>
          ) : (
            <Navigate to="/login" />
          )
        } />
      </Routes>
    </Router>
  );
}

export default App;