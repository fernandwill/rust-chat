import React from 'react';
import { Crown } from 'lucide-react';

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

const UserList: React.FC<UserListProps> = ({ users, onlineCount }) => {
  const onlineUsers = users.filter(user => user.status !== 'offline');
  const offlineUsers = users.filter(user => user.status === 'offline');

  return (
    <div className="user-list">
      <div className="user-list-header">
        <span>ONLINE - {onlineCount}</span>
      </div>

      <div className="users-section">
        {onlineUsers.map(user => (
          <div key={user.id} className="user-item">
            <div className="user-avatar-container">
              <div className="user-avatar">{user.avatar || getInitials(user.username)}</div>
              {user.username === 'RustDev' && (
                <Crown size={12} className="admin-crown" />
              )}
              <div
                className="user-status-indicator"
                style={{ backgroundColor: statusColorMap[user.status] }}
              />
            </div>
            <div className="user-name">{user.username}</div>
            {user.role && <div className="user-role">{user.role}</div>}
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
                <div className="user-name">{user.username}</div>
                {user.role && <div className="user-role">{user.role}</div>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default UserList;
