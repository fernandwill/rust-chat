import React, { useEffect, useRef, useState } from 'react';
import { LogOut, Mic, Headphones, Settings, Smile } from 'lucide-react';

type UserStatus = 'online' | 'idle' | 'dnd' | 'offline';

interface User {
  id: string;
  username: string;
  status: UserStatus;
  avatar?: string;
  role?: string;
}

interface UserListProps {
  users: User[];
  onlineCount: number;
  currentUser?: { username: string; avatar?: string; provider: string; email?: string } | null;
  onLogout?: () => void;
}

const getInitials = (name: string) => {
  return name
    .split(' ')
    .filter(Boolean)
    .map(part => part[0]?.toUpperCase() || '')
    .join('')
    .slice(0, 2);
};

const statusColorMap: Record<UserStatus, string> = {
  online: '#43b581',
  idle: '#faa61a',
  dnd: '#f04747',
  offline: '#747f8d'
};

const UserList: React.FC<UserListProps> = ({ users, onlineCount, currentUser, onLogout }) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const confirmRef = useRef<HTMLDivElement>(null);

  const displayName = currentUser?.username ?? 'RustDev';
  const displayAvatar = currentUser?.avatar || getInitials(displayName);

  const onlineUsers = users.filter(user => user.status !== 'offline');
  const offlineUsers = users.filter(user => user.status === 'offline');

  const handleSettingsClick = () => {
    console.log('Open user settings');
  };

  const handleStatusClick = () => {
    console.log('Set custom status');
  };

  const handleLogoutClick = () => {
    setShowConfirm(true);
  };

  const handleConfirmLogout = () => {
    onLogout?.();
    setShowConfirm(false);
  };

  const handleCancelLogout = () => {
    setShowConfirm(false);
  };

  useEffect(() => {
    if (!showConfirm) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowConfirm(false);
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (confirmRef.current && !confirmRef.current.contains(event.target as Node)) {
        setShowConfirm(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showConfirm]);

  return (
    <div className="user-list">
      <div className="current-user-panel">
        <div className="current-user-info">
          <div className="user-avatar-container">
            <div className="user-avatar">{displayAvatar}</div>
            <div
              className="user-status-indicator"
              style={{ backgroundColor: statusColorMap.online }}
            />
          </div>
          <div className="user-name">{displayName}</div>
        </div>

        <div className="current-user-controls">
          <button type="button" className="user-control-btn" aria-label="Toggle microphone">
            <Mic size={16} />
          </button>
          <button type="button" className="user-control-btn" aria-label="Toggle headphones">
            <Headphones size={16} />
          </button>
          <button
            type="button"
            className="user-control-btn"
            aria-label="Set custom status"
            onClick={handleStatusClick}
          >
            <Smile size={16} />
          </button>
          <button
            type="button"
            className="user-control-btn"
            aria-label="Open user settings"
            onClick={handleSettingsClick}
          >
            <Settings size={16} />
          </button>
          <button
            type="button"
            className="user-control-btn danger"
            aria-label="Log out"
            onClick={handleLogoutClick}
          >
            <LogOut size={16} />
          </button>
        </div>

        {showConfirm && (
          <div className="logout-confirm-popover" ref={confirmRef}>
            <h4>Ready to log out?</h4>
            <p>You’ll need to sign back in to rejoin Rustcord.</p>
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

      <div className="user-list-header">
        <span>ONLINE - {onlineCount}</span>
      </div>

      <div className="users-section">
        {onlineUsers.map(user => (
          <div key={user.id} className="user-item">
            <div className="user-avatar-container">
              <div className="user-avatar">{user.avatar || getInitials(user.username)}</div>
              <div
                className="user-status-indicator"
                style={{ backgroundColor: statusColorMap[user.status] }}
              />
            </div>
            <div className="user-info">
              <div className="user-name">{user.username}</div>
              {user.role && <div className="user-role">{user.role}</div>}
            </div>
          </div>
        ))}
      </div>

      {offlineUsers.length > 0 && (
        <>
          <div className="user-list-header">
            <span>OFFLINE - {offlineUsers.length}</span>
          </div>
          <div className="users-section">
            {offlineUsers.map(user => (
              <div key={user.id} className="user-item offline">
                <div className="user-avatar-container">
                  <div className="user-avatar">{user.avatar || getInitials(user.username)}</div>
                  <div
                    className="user-status-indicator"
                    style={{ backgroundColor: statusColorMap[user.status] }}
                  />
                </div>
                <div className="user-info">
                  <div className="user-name">{user.username}</div>
                  {user.role && <div className="user-role">{user.role}</div>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default UserList;
