import React from 'react';

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
          <button className="header-btn">📌</button>
          <button className="header-btn">👥</button>
          <button className="header-btn">📞</button>
          <button className="header-btn">🔍</button>
          <button className="header-btn">📥</button>
          <button className="header-btn">❓</button>
        </div>
      </div>

      <div className="messages-container">
        {messages.map((message) => (
          <div key={message.id} className="message">
            <div className="message-avatar">
              {message.avatar || '👤'}
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
            <button className="input-btn">📎</button>
            <button className="input-btn">😊</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatArea;