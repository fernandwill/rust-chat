import React from 'react';

interface Channel {
  id: string;
  name: string;
  type: 'text' | 'voice';
}

interface SidebarProps {
  channels: Channel[];
  activeChannel: string;
  onChannelSelect: (channelId: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ channels, activeChannel, onChannelSelect }) => {
  return (
    <div className="sidebar">
      <div className="server-header">
        <h2>Rustcord</h2>
      </div>
      
      <div className="channels-section">
        <div className="section-header">
          <span>TEXT CHANNELS</span>
        </div>
        
        {channels.filter(ch => ch.type === 'text').map(channel => (
          <div
            key={channel.id}
            className={`channel-item ${activeChannel === channel.id ? 'active' : ''}`}
            onClick={() => onChannelSelect(channel.id)}
          >
            <span className="channel-icon">#</span>
            <span className="channel-name">{channel.name}</span>
          </div>
        ))}
      </div>

      <div className="channels-section">
        <div className="section-header">
          <span>VOICE CHANNELS</span>
        </div>
        
        {channels.filter(ch => ch.type === 'voice').map(channel => (
          <div
            key={channel.id}
            className={`channel-item ${activeChannel === channel.id ? 'active' : ''}`}
            onClick={() => onChannelSelect(channel.id)}
          >
            <span className="channel-icon">🔊</span>
            <span className="channel-name">{channel.name}</span>
          </div>
        ))}
      </div>

      <div className="user-info">
        <div className="user-avatar">👤</div>
        <div className="user-details">
          <div className="username">RustDev</div>
          <div className="user-status">Online</div>
        </div>
        <div className="user-controls">
          <button className="control-btn">🎤</button>
          <button className="control-btn">🎧</button>
          <button className="control-btn">⚙️</button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;