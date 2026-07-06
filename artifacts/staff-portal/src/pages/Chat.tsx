import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { getSocket } from '@/lib/socket';
import { MessageCircle, Send, Circle } from 'lucide-react';

const ku: React.CSSProperties = { fontFamily: "'Noto Kufi Arabic', sans-serif" };

interface ChatUser {
  id: number;
  username: string;
  full_name: string;
  lastMessage: { content: string; created_at: string; sender_id: number } | null;
  unreadCount: number;
}

interface Message {
  id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  is_read: boolean;
  created_at: string;
}

export default function Chat() {
  const { user } = useAuth();
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [onlineIds, setOnlineIds] = useState<number[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchUsers = useCallback(async () => {
    const res = await fetch(`${window.location.origin}/api/chat/users`, { credentials: 'include' });
    if (res.ok) setUsers(await res.json());
  }, []);

  const fetchMessages = useCallback(async (userId: number) => {
    const res = await fetch(`${window.location.origin}/api/chat/messages/${userId}`, { credentials: 'include' });
    if (res.ok) setMessages(await res.json());
  }, []);

  // Mark messages read
  const markRead = useCallback(async (senderId: number) => {
    await fetch(`${window.location.origin}/api/chat/messages/${senderId}/read`, {
      method: 'POST', credentials: 'include',
    });
    getSocket().emit('mark_read', { senderId });
    setUsers(prev => prev.map(u => u.id === senderId ? { ...u, unreadCount: 0 } : u));
  }, []);

  useEffect(() => {
    fetchUsers();
    const socket = getSocket();

    socket.on('online_users', (ids: number[]) => setOnlineIds(ids));

    socket.on('new_message', (msg: Message) => {
      setMessages(prev => {
        const exists = prev.some(m => m.id === msg.id);
        return exists ? prev : [...prev, msg];
      });
      // update sidebar last message
      setUsers(prev => prev.map(u => {
        if (u.id === msg.sender_id || u.id === msg.receiver_id) {
          const isFromOther = msg.sender_id !== user?.id;
          return {
            ...u,
            lastMessage: msg,
            unreadCount: isFromOther && msg.sender_id === u.id ? u.unreadCount + 1 : u.unreadCount,
          };
        }
        return u;
      }));
    });

    socket.on('messages_read', () => {
      setMessages(prev => prev.map(m => ({ ...m, is_read: true })));
    });

    return () => {
      socket.off('online_users');
      socket.off('new_message');
      socket.off('messages_read');
    };
  }, [fetchUsers, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const openConversation = async (u: ChatUser) => {
    setSelectedUser(u);
    await fetchMessages(u.id);
    if (u.unreadCount > 0) markRead(u.id);
  };

  const sendMessage = () => {
    if (!input.trim() || !selectedUser) return;
    getSocket().emit('send_message', { receiverId: selectedUser.id, content: input.trim() });
    setInput('');
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString('ku', { hour: '2-digit', minute: '2-digit' });

  return (
    <div dir="rtl" style={{ ...ku, background: '#0f172a' }} className="h-[calc(100vh-6rem)] flex rounded-2xl overflow-hidden border border-white/5 shadow-xl">

      {/* Sidebar — user list */}
      <div className="w-72 shrink-0 flex flex-col border-l border-white/5" style={{ background: '#1e293b' }}>
        <div className="px-4 py-4 border-b border-white/5">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-blue-400" />
            چات
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {users.length === 0 && (
            <p className="text-slate-500 text-xs text-center mt-8">هیچ فەرمانبەرێک نییە</p>
          )}
          {users.map(u => (
            <button
              key={u.id}
              onClick={() => openConversation(u)}
              className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-right border-b border-white/5 ${
                selectedUser?.id === u.id ? 'bg-blue-600/20' : 'hover:bg-white/5'
              }`}
            >
              {/* Avatar */}
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold">
                  {u.full_name?.[0] ?? u.username[0]}
                </div>
                <Circle
                  className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${onlineIds.includes(u.id) ? 'text-emerald-400 fill-emerald-400' : 'text-slate-600 fill-slate-600'}`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white truncate">{u.full_name || u.username}</span>
                  {u.unreadCount > 0 && (
                    <span className="text-[10px] bg-blue-500 text-white rounded-full px-1.5 py-0.5 font-bold shrink-0">
                      {u.unreadCount}
                    </span>
                  )}
                </div>
                {u.lastMessage && (
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    {u.lastMessage.sender_id === user?.id ? 'تۆ: ' : ''}{u.lastMessage.content}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedUser ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <MessageCircle className="w-12 h-12 text-slate-700" />
            <p className="text-slate-500 text-sm">کەسێک هەڵبژێرە بۆ دەستپێکردنی چات</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-white/5" style={{ background: '#1e293b' }}>
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold">
                  {selectedUser.full_name?.[0] ?? selectedUser.username[0]}
                </div>
                <Circle className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${onlineIds.includes(selectedUser.id) ? 'text-emerald-400 fill-emerald-400' : 'text-slate-600 fill-slate-600'}`} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{selectedUser.full_name || selectedUser.username}</p>
                <p className="text-[11px] text-slate-500">{onlineIds.includes(selectedUser.id) ? 'ئۆنلاینە' : 'ئۆفلاینە'}</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
              {messages.map(msg => {
                const isMe = msg.sender_id === user?.id;
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-start' : 'justify-end'}`}>
                    <div
                      className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm leading-relaxed ${
                        isMe
                          ? 'bg-blue-600 text-white rounded-tr-sm'
                          : 'text-slate-200 rounded-tl-sm'
                      }`}
                      style={!isMe ? { background: '#1e293b', border: '1px solid rgba(255,255,255,0.06)' } : {}}
                    >
                      <p>{msg.content}</p>
                      <p className={`text-[10px] mt-1 ${isMe ? 'text-blue-200' : 'text-slate-500'}`}>
                        {fmt(msg.created_at)}
                        {isMe && <span className="mr-1">{msg.is_read ? ' ✓✓' : ' ✓'}</span>}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-white/5" style={{ background: '#1e293b' }}>
              <div className="flex items-center gap-2">
                <button
                  onClick={sendMessage}
                  disabled={!input.trim()}
                  className="w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 flex items-center justify-center transition-colors shrink-0"
                >
                  <Send className="w-4 h-4 text-white" style={{ transform: 'scaleX(-1)' }} />
                </button>
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="پەیامت بنووسە..."
                  className="flex-1 bg-white/5 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-600 outline-none focus:ring-1 focus:ring-blue-500"
                  style={ku}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
