import React from 'react';

interface User {
  id: string;
  username: string;
  status: 'online' | 'idle' | 'dnd' | 'offline';
  avatar?: string;
  role?: string;
}

interface UserListProps {
  users: User[];
  onlineCount: number;
  currentUser?: { username: string; avatar: string; provider: string } | null;
  onLogout?: () => void;
}

const UserList: React.FC<UserListProps> = ({ users, onlineCount, currentUser, onLogout }) => {

  const getStatusColor = (status: User['status']) => {
    switch (status) {
      case 'online': return '#43b581';
      case 'idle': return '#faa61a';
      case 'dnd': return '#f04747';
      case 'offline': return '#747f8d';
      default: return '#747f8d';
    }
  };

  const onlineUsers = users.filter(user => user.status !== 'offline');
  const offlineUsers = users.filter(user => user.status === 'offline');

  return (
    <div className="user-list">
      {/* Current User Panel */}
      {currentUser && (
        <div className="current-user-panel">
          <div className="current-user-info">
            <div className="user-avatar-container">
              <div className="user-avatar">{currentUser.avatar}</div>
              <div 
                className="user-status-indicator"
                style={{ backgroundColor: '#43b581' }}
              />
            </div>
            <div className="user-info">
              <div className="user-name">{currentUser.username}</div>
              <div className="user-provider">via {currentUser.provider}</div>
            </div>
          </div>
          <button className="logout-button" onClick={onLogout} title="Logout">
            🚪
          </button>
        </div>
      )}

      <div className="user-list-header">
        <span>ONLINE — {onlineCount}</span>
      </div>

      <div className="users-section">
        {onlineUsers.map(user => (
          <div key={user.id} className="user-item">
            <div className="user-avatar-container">
              <div className="user-avatar">{user.avatar || '👤'}</div>
              <div 
                className="user-status-indicator"
                style={{ backgroundColor: getStatusColor(user.status) }}
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
            <span>OFFLINE — {offlineUsers.length}</span>
          </div>
          <div className="users-section">
            {offlineUsers.map(user => (
              <div key={user.id} className="user-item offline">
                <div className="user-avatar-container">
                  <div className="user-avatar">{user.avatar || '👤'}</div>
                  <div 
                    className="user-status-indicator"
                    style={{ backgroundColor: getStatusColor(user.status) }}
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