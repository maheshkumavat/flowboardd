'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase, fetchWithAuth } from '../lib/supabase';
import RoleBadge from './RoleBadge';

export default function ProjectChat({ projectId, members = [], currentUser, onSelectUser, onClose, isFloating = false }) {
  const [messages, setMessages] = useState([]);
  const [inputContent, setInputContent] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showMembersList, setShowMembersList] = useState(true);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchMessages();

    // Clean up any stale pre-existing channels with same topic/name before subscribing
    const channelName = `project_messages_${projectId}`;
    try {
      const activeChannels = supabase.getChannels() || [];
      const staleChannel = activeChannels.find((c) => c.name === channelName || c.topic === `realtime:public:${channelName}`);
      if (staleChannel) {
        supabase.removeChannel(staleChannel);
      }
    } catch (e) {}

    // Subscribe to Supabase Realtime for instant multi-user messaging
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'project_messages', filter: `project_id=eq.${projectId}` },
        (payload) => {
          if (payload.new) {
            fetchMessages();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async () => {
    try {
      const res = await fetchWithAuth(`/api/projects/${projectId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Fetch messages error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (PNG, JPG, GIF, WebP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setSelectedImage(file);
      setImagePreview(uploadEvent.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!inputContent.trim() && !imagePreview) || sending) return;

    const contentToSend = inputContent.trim();
    const imageToSend = imagePreview;

    setInputContent('');
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setSending(true);

    const tempMsg = {
      id: `temp-${Date.now()}`,
      project_id: projectId,
      user_id: currentUser?.id,
      content: contentToSend,
      image_url: imageToSend,
      created_at: new Date().toISOString(),
      user: {
        id: currentUser?.id,
        name: currentUser?.name || currentUser?.email?.split('@')[0] || 'You',
        email: currentUser?.email || '',
      },
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const res = await fetchWithAuth(`/api/projects/${projectId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: contentToSend,
          imageUrl: imageToSend,
        }),
      });

      if (res.ok) {
        fetchMessages();
      }
    } catch (err) {
      console.error('Send message error:', err);
    } finally {
      setSending(false);
    }
  };

  const containerClasses = isFloating
    ? 'fixed bottom-6 right-6 w-80 md:w-96 h-[520px] rounded-[10px] border border-[#E4E4E7] overflow-hidden shadow-modal bg-white flex flex-col z-50'
    : 'w-full max-w-6xl mx-auto h-[calc(100vh-100px)] bg-white border border-[#E4E4E7] rounded-[8px] shadow-card overflow-hidden flex flex-col min-h-0';

  return (
    <div className={containerClasses}>
      
      {/* Header Bar */}
      <div className="px-5 py-3.5 border-b border-[#E4E4E7] bg-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[6px] bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center border border-[#4F46E5]/20">
            <span className="material-symbols-outlined text-[20px]">forum</span>
          </div>
          <div>
            <h3 className="text-[16px] font-semibold text-[#18181B]">Team Discussion</h3>
            <p className="text-[12px] text-[#71717A] font-normal">
              {members.length} active project member{members.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMembersList(!showMembersList)}
            className={`px-3 py-1.5 rounded-[6px] border transition-colors cursor-pointer text-[12px] font-medium flex items-center gap-1.5 ${
              showMembersList
                ? 'bg-[#EEF2FF] text-[#4F46E5] border-[#4F46E5]/30 font-semibold'
                : 'text-[#52525B] hover:bg-[#F4F4F5] border-[#E4E4E7]'
            }`}
            title="Toggle Members List"
          >
            <span className="material-symbols-outlined text-[16px]">group</span>
            Members ({members.length})
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-[6px] text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F4F5] cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Members Bar */}
      {showMembersList && (
        <div className="px-4 py-2.5 bg-[#F7F7F8] border-b border-[#E4E4E7] flex items-center gap-3 overflow-x-auto shrink-0">
          <span className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider shrink-0">
            Team Members:
          </span>
          <div className="flex items-center gap-2 overflow-x-auto py-0.5">
            {members.map((m) => {
              const u = m.user || m;
              const name = u.name || u.email?.split('@')[0] || 'Member';
              const role = m.role || 'MEMBER';
              return (
                <button
                  key={m.id || u.id}
                  onClick={() => onSelectUser && onSelectUser(m)}
                  className="flex items-center gap-2 bg-white px-3 py-1 rounded-[6px] border border-[#E4E4E7] hover:border-[#4F46E5] transition-colors text-left shrink-0 cursor-pointer shadow-card"
                  title={`View ${name}'s profile (${role})`}
                >
                  <div className="w-5 h-5 rounded-full bg-[#4F46E5] text-white font-semibold text-[10px] flex items-center justify-center">
                    {name.substring(0, 1).toUpperCase()}
                  </div>
                  <span className="text-[12px] text-[#18181B] font-medium">
                    {name}
                  </span>
                  <RoleBadge role={role} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-[#FAFAFA] min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-[#4F46E5] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-16 text-[#71717A] text-[14px] bg-white rounded-[8px] border border-[#E4E4E7] p-8 max-w-md mx-auto shadow-card">
            <span className="material-symbols-outlined text-[40px] text-[#71717A] mb-2">chat</span>
            <h4 className="text-[16px] font-semibold text-[#18181B] mb-1">No Messages Yet</h4>
            <p className="text-[13px] text-[#52525B]">
              Send a note or image attachment to kick off team discussion!
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const sender = msg.user || {};
            const isMe = currentUser && (msg.user_id === currentUser.id || sender.id === currentUser.id);
            const senderName = sender.name || sender.email?.split('@')[0] || 'Team Member';
            const memberEntry = members.find((m) => (m.user?.id || m.userId || m.user_id) === (sender.id || msg.user_id));
            const senderRole = memberEntry?.role || (isMe ? 'ADMIN' : 'MEMBER');
            const timeStr = msg.created_at
              ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : 'Just now';

            return (
              <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                {/* Avatar */}
                <button
                  type="button"
                  onClick={() => onSelectUser && onSelectUser(sender)}
                  className="shrink-0 w-8 h-8 rounded-full bg-[#4F46E5] text-white font-semibold text-xs flex items-center justify-center border border-[#E4E4E7] transition-transform cursor-pointer mt-1 overflow-hidden"
                  title={`View ${senderName}'s profile (${senderRole})`}
                >
                  {sender.avatarUrl || sender.avatar_url ? (
                    <img src={sender.avatarUrl || sender.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    senderName.substring(0, 1).toUpperCase()
                  )}
                </button>

                {/* Message Bubble */}
                <div className={`max-w-[70%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-1.5 mb-1 px-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() => onSelectUser && onSelectUser(sender)}
                      className="text-[12px] font-semibold text-[#18181B] hover:underline cursor-pointer"
                    >
                      {isMe ? 'You' : senderName}
                    </button>
                    <RoleBadge role={senderRole} />
                    <span className="text-[11px] text-[#71717A]">{timeStr}</span>
                  </div>

                  <div
                    className={`p-3 rounded-[8px] text-[13px] shadow-card ${
                      isMe
                        ? 'bg-[#4F46E5] text-white'
                        : 'bg-white text-[#18181B] border border-[#E4E4E7]'
                    }`}
                  >
                    {/* Inline Image Attachment */}
                    {(msg.image_url || msg.imageUrl) && (
                      <div className="mb-2 overflow-hidden rounded-[6px] border border-black/10">
                        <img
                          src={msg.image_url || msg.imageUrl}
                          alt="Attachment"
                          className="max-h-72 w-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
                          onClick={() => window.open(msg.image_url || msg.imageUrl, '_blank')}
                        />
                      </div>
                    )}

                    {/* Text Message */}
                    {msg.content && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Image Attachment Preview Bar */}
      {imagePreview && (
        <div className="p-2 px-4 bg-[#F7F7F8] border-t border-[#E4E4E7] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <img src={imagePreview} alt="Preview" className="w-10 h-10 object-cover rounded-[6px] border border-[#4F46E5]" />
            <span className="text-[12px] text-[#18181B] font-medium truncate max-w-[260px]">
              {selectedImage ? selectedImage.name : 'Attached Image'}
            </span>
          </div>
          <button
            type="button"
            onClick={handleRemoveImage}
            className="p-1 text-[#DC2626] hover:bg-[#FEE2E2] rounded-[6px] cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* Input Box */}
      <form onSubmit={handleSendMessage} className="p-3 border-t border-[#E4E4E7] bg-white flex gap-2.5 items-center shrink-0">
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="image/*"
          className="hidden"
        />

        {/* Media Upload Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2 rounded-[6px] text-[#71717A] hover:bg-[#F4F4F5] hover:text-[#4F46E5] transition-colors cursor-pointer"
          title="Attach Image"
        >
          <span className="material-symbols-outlined text-[20px]">image</span>
        </button>

        <input
          type="text"
          value={inputContent}
          onChange={(e) => setInputContent(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 bg-[#F7F7F8] border border-[#E4E4E7] rounded-[6px] px-3.5 py-2 text-[13px] text-[#18181B] placeholder-[#71717A] focus:outline-none focus:border-[#4F46E5] focus:bg-white transition-colors"
        />
        <button
          type="submit"
          disabled={(!inputContent.trim() && !imagePreview) || sending}
          className="bg-[#4F46E5] text-white px-4 py-2 rounded-[6px] text-[13px] font-medium hover:bg-[#4338CA] transition-colors disabled:opacity-50 flex items-center justify-center cursor-pointer gap-1.5"
        >
          <span className="material-symbols-outlined text-[16px]">send</span>
          <span>Send</span>
        </button>
      </form>

    </div>
  );
}
