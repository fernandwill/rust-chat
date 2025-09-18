import React from 'react';
import { Hash, Volume2, Mic, Headphones, Settings } from 'lucide-react';

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
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .filter(Boolean)
      .map(part => part[0]?.toUpperCase() || '')
      .join('')
      .slice(0, 2);
  };

  const currentUserName = 'RustDev';

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
            <span className="channel-icon">
              <Hash size={18} />
            </span>
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
            <span className="channel-icon">
              <Volume2 size={18} />
            </span>
            <span className="channel-name">{channel.name}</span>
          </div>
        ))}
      </div>

      <div className="user-info">
        <div className="user-avatar">{getInitials(currentUserName)}</div>
        <div className="user-details">
          <div className="username">{currentUserName}</div>
          <div className="user-status">Online</div>
        </div>
        <div className="user-controls">
          <button className="control-btn" aria-label="Toggle microphone">
            <Mic size={16} />
          </button>
          <button className="control-btn" aria-label="Toggle headphones">
            <Headphones size={16} />
          </button>
          <button className="control-btn" aria-label="Open settings">
            <Settings size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
