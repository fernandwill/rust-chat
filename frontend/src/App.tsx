import { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import ChatArea from "./components/ChatArea";
import UserList from "./components/UserList";
import LoginPage from "./components/LoginPage";
import OAuthCallback from "./components/OAuthCallback";
import "./styles/Rustcord.css";
import { generateAesKey, encryptMessageAes, decryptMessageAes } from "./utils/aes";

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

const getInitials = (name: string) => {
  return name
    .split(' ')
    .filter(Boolean)
    .map(part => part[0]?.toUpperCase() || '')
    .join('')
    .slice(0, 2);
};

function App() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [activeChannel, setActiveChannel] = useState('general');
  const [activeVoiceChannel, setActiveVoiceChannel] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [aesKey, setAesKey] = useState<CryptoKey | null>(null);

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
    { id: '1', username: 'RustDev', status: 'online', avatar: 'RD' },
    { id: '2', username: 'CodeMaster', status: 'online', avatar: 'CM' },
    { id: '3', username: 'ChatBot', status: 'idle', avatar: 'CB' },
    { id: '4', username: 'WebDev', status: 'dnd', avatar: 'WD' },
    { id: '5', username: 'Sleepy', status: 'offline', avatar: 'SL' },
  ];

  const onlineCount = users.filter(user => user.status !== 'offline').length;

  const handleLoginSuccess = (user: CurrentUser) => {
    console.log("OAuth login successful", user);
    // Clear any existing data first
    localStorage.removeItem("currentUser");
    localStorage.removeItem("isAuthenticated");
    // Set new user data
    localStorage.setItem("currentUser", JSON.stringify(user));
    localStorage.setItem("isAuthenticated", "true");
    setCurrentUser(user);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    localStorage.removeItem("isAuthenticated");
    setIsAuthenticated(false);
    setCurrentUser(null);
    if (ws) {
      ws.close();
      setWs(null);
    }
    setMessages([]);
    setActiveVoiceChannel(null);
  };

  useEffect(() => {
    const storedUser = localStorage.getItem("currentUser");
    const storedAuth = localStorage.getItem("isAuthenticated");

    if (storedUser && storedAuth) {
      setCurrentUser(JSON.parse(storedUser));
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    // Generate AES key for encryption
    const initEncryption = async () => {
      try {
        const key = await generateAesKey("rustchatserver2024_aes_secure");
        setAesKey(key);
      } catch (error) {
        console.error("Failed to generate AES key:", error);
      }
    };
    
    initEncryption();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !aesKey) return;
    
    // Connect to WebSocket server (now on port 8081)
    const socket = new WebSocket("ws://127.0.0.1:8081");

    socket.onopen = () => {
      console.log("Connected to WebSocket");
      
      // Add welcome message
      const welcomeMessage: Message = {
        id: Date.now().toString(),
        author: 'Rustcord',
        content: 'Welcome to Rustcord! Start chatting securely.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, welcomeMessage]);
    };

    socket.onmessage = async (event) => {
      try {
        // Try to decrypt the message
        const decryptedContent = await decryptMessageAes(event.data, aesKey);
        console.log("Server response (decrypted):", decryptedContent);
        
        // Parse the decrypted message (format: "addr: content")
        const match = decryptedContent.match(/^([^:]+): (.*)$/);
        if (match) {
          const [, addr, content] = match;
          const message: Message = {
            id: Date.now().toString(),
            author: addr,
            content: content,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, message]);
        }
      } catch (error) {
        // If decryption fails, treat as plain text
        console.log("Server response (plain):", event.data);
        const message: Message = {
          id: Date.now().toString(),
          author: 'Server',
          content: event.data,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, message]);
      }
    };

    socket.onclose = () => {
      console.log("Disconnected from WebSocket");
    };

    socket.onerror = () => {
      console.log("WebSocket error");
    };

    setWs(socket);

    return () => socket.close();
  }, [isAuthenticated, aesKey]);

  const sendMessage = async () => {
    if (ws && input.trim() !== "" && aesKey) {
      try {
        // Encrypt the message before sending
        const encryptedMessage = await encryptMessageAes(input, aesKey);
        ws.send(encryptedMessage);
        
        // Add to local messages
        const userMessage: Message = {
          id: Date.now().toString(),
          author: currentUser?.username || 'User',
          content: input,
          timestamp: new Date(),
          avatar: currentUser ? currentUser.avatar || getInitials(currentUser.username) : undefined
        };
        setMessages((prev) => [...prev, userMessage]);
        setInput("");
      } catch (error) {
        console.error("Failed to encrypt message:", error);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleVoiceChannelToggle = (channelId: string) => {
    setActiveVoiceChannel(prev => (prev === channelId ? null : channelId));
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
          !isAuthenticated ? <LoginPage /> : <Navigate to="/" />
        } />
        <Route path="/oauth/callback" element={
          <OAuthCallback onLoginSuccess={handleLoginSuccess} />
        } />
        <Route path="/" element={
          isAuthenticated ? (
            <div className="rustcord-app">
              <Sidebar
                channels={channels}
                activeChannel={activeChannel}
                activeVoiceChannel={activeVoiceChannel}
                onChannelSelect={handleChannelSelect}
                onVoiceChannelToggle={handleVoiceChannelToggle}
                currentUser={currentUser}
                onLogout={handleLogout}
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
          ) : (
            <Navigate to="/login" />
          )
        } />
      </Routes>
    </Router>
  );
}

export default App;
