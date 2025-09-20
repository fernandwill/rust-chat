import React, { useEffect, useRef, useState } from 'react';
import { Hash, Volume2, Mic, MicOff, Headphones, Settings, Smile, LogOut } from 'lucide-react';

// Custom deafened headphones component with diagonal cross
const HeadphonesOff: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Headphones paths */}
    <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
    <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
    {/* Diagonal cross line - same as MicOff */}
    <path d="m2 2 20 20" />
  </svg>
);

interface Channel {
  id: string;
  name: string;
  type: 'text' | 'voice';
}

interface SidebarProps {
  channels: Channel[];
  activeChannel: string;
  activeVoiceChannel?: string | null;
  onChannelSelect: (channelId: string) => void;
  onVoiceChannelToggle?: (channelId: string) => void;
  currentUser?: { username: string; avatar?: string; provider?: string; email?: string } | null;
  onLogout?: () => void;
}

const statusColor = '#43b581';

const Sidebar: React.FC<SidebarProps> = ({
  channels,
  activeChannel,
  activeVoiceChannel,
  onChannelSelect,
  onVoiceChannelToggle,
  currentUser,
  onLogout
}) => {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .filter(Boolean)
      .map(part => part[0]?.toUpperCase() || '')
      .join('')
      .slice(0, 2);
  };

  const [showConfirm, setShowConfirm] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const confirmRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  const currentUserName = currentUser?.username || 'Guest';
  const displayAvatar = currentUser?.avatar;
  const displayInitials = getInitials(currentUserName);
  const connectedVoiceChannel = activeVoiceChannel
    ? channels.find(ch => ch.type === 'voice' && ch.id === activeVoiceChannel)
    : undefined;

  useEffect(() => {
    if (!showConfirm && !showSettingsMenu) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowConfirm(false);
        setShowSettingsMenu(false);
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (showConfirm && confirmRef.current && !confirmRef.current.contains(target)) {
        setShowConfirm(false);
      }
      if (showSettingsMenu && settingsRef.current && !settingsRef.current.contains(target)) {
        setShowSettingsMenu(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showConfirm, showSettingsMenu]);

  const handleStatusClick = () => {
    console.log('Set custom status');
  };

  const handleSettingsButtonClick = () => {
    setShowSettingsMenu(prev => !prev);
  };

  const handleOpenSettings = () => {
    console.log('Open user settings');
    setShowSettingsMenu(false);
  };

  const handleLogoutClick = () => {
    setShowSettingsMenu(false);
    setShowConfirm(true);
  };

  const handleConfirmLogout = () => {
    onLogout?.();
    setShowConfirm(false);
  };

  const handleCancelLogout = () => {
    setShowConfirm(false);
  };

  const handleMicToggle = () => {
    setIsMuted(!isMuted);
    console.log(isMuted ? 'Microphone unmuted' : 'Microphone muted');
  };

  const handleDeafenToggle = () => {
    setIsDeafened(!isDeafened);
    // If deafened, also mute the microphone
    if (!isDeafened) {
      setIsMuted(true);
    }
    console.log(isDeafened ? 'Audio undeafened' : 'Audio deafened');
  };

  const handleVoiceChannelClick = (channelId: string) => {
    onVoiceChannelToggle?.(channelId);
  };

  const handleVoiceKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, channelId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleVoiceChannelClick(channelId);
    }
  };

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
        
        {channels.filter(ch => ch.type === 'voice').map(channel => {
          const isConnected = activeVoiceChannel === channel.id;
          return (
            <div key={channel.id} className={`voice-channel ${isConnected ? 'connected' : ''}`}>
              <div
                className={`channel-item voice ${isConnected ? 'active' : ''}`}
                onClick={() => handleVoiceChannelClick(channel.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => handleVoiceKeyDown(event, channel.id)}
                aria-pressed={isConnected}
                aria-label={`${isConnected ? 'Leave' : 'Join'} voice channel ${channel.name}`}
              >
                <span className="channel-icon">
                  <Volume2 size={18} />
                </span>
                <span className="channel-name">{channel.name}</span>
                {isConnected && <span className="voice-connected-indicator" aria-hidden="true" />}
              </div>

              {isConnected && (
                <div className="voice-channel-users">
                  <div className="voice-user">
                    <div className="user-avatar-container tiny">
                      {displayAvatar ? (
                        <img src={displayAvatar} alt={currentUserName} className="user-avatar-image" />
                      ) : (
                        <div className="user-avatar tiny">{displayInitials}</div>
                      )}
                      <div
                        className="user-status-indicator"
                        style={{ backgroundColor: statusColor }}
                      />
                    </div>
                    <div className="voice-user-details">
                      <span className="voice-user-name">{currentUserName}</span>
                    </div>
                    <button
                      type="button"
                      className={`voice-user-control ${isMuted ? 'muted' : ''}`}
                      aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                      onClick={handleMicToggle}
                    >
                      {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="user-info">
        {connectedVoiceChannel && (
          <div className="user-connection-bar">
            <span className="user-connection-label">
              Connected to <span className="user-connection-channel">{connectedVoiceChannel.name}</span>
            </span>
            <button
              type="button"
              className="voice-leave-btn"
              aria-label={`Leave voice channel ${connectedVoiceChannel.name}`}
              onClick={() => handleVoiceChannelClick(connectedVoiceChannel.id)}
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
        <div className="sidebar-user-row">
          <div className="user-avatar-container">
            {displayAvatar ? (
              <img src={displayAvatar} alt={currentUserName} className="user-avatar-image" />
            ) : (
              <div className="user-avatar">{displayInitials}</div>
            )}
            <div
              className="user-status-indicator"
              style={{ backgroundColor: statusColor }}
            />
          </div>
          <div className="user-details">
            <div className="username">{currentUserName}</div>
            <div className="user-status">Online</div>
          </div>
        </div>
        <div className="user-controls">
          <button 
            className={`control-btn ${isMuted ? 'muted' : ''}`} 
            aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            onClick={handleMicToggle}
          >
            {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
          <button 
            className={`control-btn ${isDeafened ? 'muted' : ''}`} 
            aria-label={isDeafened ? 'Undeafen audio' : 'Deafen audio'}
            onClick={handleDeafenToggle}
          >
            {isDeafened ? <HeadphonesOff size={16} /> : <Headphones size={16} />}
          </button>
          <button
            className="control-btn"
            aria-label="Set custom status"
            onClick={handleStatusClick}
          >
            <Smile size={16} />
          </button>
          <div className="settings-menu-container" ref={settingsRef}>
            <button
              className={`control-btn settings-toggle ${showSettingsMenu ? 'is-open' : ''}`}
              aria-label="Open user menu"
              aria-expanded={showSettingsMenu}
              onClick={handleSettingsButtonClick}
            >
              <Settings size={16} />
            </button>
            {showSettingsMenu && (
              <div className="user-action-menu">
                <button type="button" className="menu-item" onClick={handleOpenSettings}>
                  <Settings size={14} />
                  <span>Settings</span>
                </button>
                <button type="button" className="menu-item danger" onClick={handleLogoutClick}>
                  <LogOut size={14} />
                  <span>Log Out</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {showConfirm && (
          <div className="logout-confirm-popover sidebar" ref={confirmRef}>
            <h4>Ready to log out?</h4>
            <p>You'll need to sign back in to rejoin Rustcord.</p>
            <div className="logout-confirm-actions">
              <button type="button" className="confirm-secondary" onClick={handleCancelLogout}>
                Cancel
              </button>
              <button type="button" className="confirm-primary" onClick={handleConfirmLogout}>
                Log Out
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
