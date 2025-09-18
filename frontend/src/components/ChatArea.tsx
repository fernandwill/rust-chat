import React from 'react';
import {
  Bell,
  Pin,
  UserPlus,
  MessageSquare,
  Inbox,
  Search,
  HelpCircle,
  Plus,
  Smile
} from 'lucide-react';

interface Message {
  id: string;
  author: string;
  content: string;
  timestamp: Date;
  avatar?: string;
}

interface ChatAreaProps {
  channelName: string;
  messages: Message[];
  input: string;
  onInputChange: (value: string) => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
}

const getInitials = (name: string) => {
  return name
    .split(' ')
    .filter(Boolean)
    .map(part => part[0]?.toUpperCase() || '')
    .join('')
    .slice(0, 2);
};

const ChatArea: React.FC<ChatAreaProps> = ({
  channelName,
  messages,
  input,
  onInputChange,
  onKeyPress
}) => {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="chat-area">
      <div className="chat-header">
        <div className="channel-info">
          <span className="channel-icon">#</span>
          <span className="channel-name">{channelName}</span>
        </div>
        <div className="header-controls">
          <button className="header-btn" aria-label="Channel notifications">
            <Bell size={18} />
          </button>
          <button className="header-btn" aria-label="Pin message">
            <Pin size={18} />
          </button>
          <button className="header-btn" aria-label="Invite users">
            <UserPlus size={18} />
          </button>
          <button className="header-btn" aria-label="Open channel activity">
            <MessageSquare size={18} />
          </button>
          <button className="header-btn" aria-label="Open inbox">
            <Inbox size={18} />
          </button>
          <button className="header-btn" aria-label="Search">
            <Search size={18} />
          </button>
          <button className="header-btn" aria-label="Help">
            <HelpCircle size={18} />
          </button>
        </div>
      </div>

      <div className="messages-container">
        {messages.map((message) => (
          <div key={message.id} className="message">
            <div className="message-avatar">
              {message.avatar || getInitials(message.author)}
            </div>
            <div className="message-content">
              <div className="message-header">
                <span className="message-author">{message.author}</span>
                <span className="message-timestamp">{formatTime(message.timestamp)}</span>
              </div>
              <div className="message-text">{message.content}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="message-input-container">
        <div className="message-input-wrapper">
          <input
            type="text"
            className="message-input"
            placeholder={`Message #${channelName}`}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyPress={onKeyPress}
          />
          <div className="input-controls">
            <button className="input-btn" aria-label="Add attachment">
              <Plus size={18} />
            </button>
            <button className="input-btn" aria-label="Add reaction">
              <Smile size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatArea;
