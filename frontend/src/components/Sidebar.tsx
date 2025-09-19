import React, { useEffect, useRef, useState } from 'react';
import { Hash, Volume2, Mic, Headphones, Settings, Smile, LogOut } from 'lucide-react';

interface Channel {
  id: string;
  name: string;
  type: 'text' | 'voice';
}

interface SidebarProps {
  channels: Channel[];
  activeChannel: string;
  onChannelSelect: (channelId: string) => void;
  currentUser?: { username: string; avatar?: string; provider?: string; email?: string } | null;
  onLogout?: () => void;
}

const statusColor = '#43b581';

const Sidebar: React.FC<SidebarProps> = ({ channels, activeChannel, onChannelSelect, currentUser, onLogout }) => {
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
  const confirmRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  const currentUserName = currentUser?.username || 'Guest';
  const displayAvatar = currentUser?.avatar;
  const displayInitials = getInitials(currentUserName);

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
          <button className="control-btn" aria-label="Toggle microphone">
            <Mic size={16} />
          </button>
          <button className="control-btn" aria-label="Toggle headphones">
            <Headphones size={16} />
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
