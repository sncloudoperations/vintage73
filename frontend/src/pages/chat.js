import React, { useState, useEffect, useRef } from 'react';
import Layout from '@/components/Layout';
import axios from 'axios';
import { initSocket, getSocket } from '@/utils/socket';
import { IoSend, IoPersonCircleOutline, IoSearch, IoAttach, IoDocumentTextOutline, IoSearchOutline } from 'react-icons/io5';
import moment from 'moment';
import { useTheme } from '@/context/ThemeContext';
import { getServerUrl } from '@/lib/api';

const ChatPage = () => {
    const [conversations, setConversations] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [user, setUser] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchMsg, setSearchMsg] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const fileInputRef = useRef(null);
    const messagesEndRef = useRef(null);
    const { theme } = useTheme();

    useEffect(() => {
        const storedUser = JSON.parse(localStorage.getItem('user'));
        setUser(storedUser);
        if (storedUser) {
            initSocket(storedUser.id);
            fetchConversations();
        }

        const socket = getSocket();
        if (socket) {
            socket.on('receive_message', (data) => {
                // If it's from the currently selected user, add it to messages
                if (selectedUser && selectedUser.id === data.senderId) {
                    setMessages(prev => [...prev, data]);
                }
                // Update conversation list
                fetchConversations();
            });
        }

        return () => {
            if (socket) socket.off('receive_message');
        };
    }, [selectedUser]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const fetchConversations = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/chat/conversations`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setConversations(res.data);
        } catch (error) {
            console.error('Error fetching conversations:', error);
        }
    };

    const fetchMessages = async (userId) => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/chat/messages/${userId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setMessages(res.data);
        } catch (error) {
            console.error('Error fetching messages:', error);
        }
    };

    const handleSelectUser = (user) => {
        setSelectedUser(user);
        fetchMessages(user.id);
        markAsRead(user.id);
    };

    const markAsRead = async (senderId) => {
        try {
            const token = localStorage.getItem('token');
            await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/api/chat/messages/read/${senderId}`, {}, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            fetchConversations();
        } catch (error) {
            console.error('Error marking messages as read:', error);
        }
    };

    const handleSendMessage = async (e, file = null) => {
        if (e) e.preventDefault();
        if (!newMessage.trim() && !file) return;

        const formData = new FormData();
        formData.append('receiverId', selectedUser.id);
        if (newMessage.trim()) formData.append('message', newMessage);
        if (file) formData.append('attachment', file);

        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/chat/messages`, formData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            const socket = getSocket();
            if (socket) {
                socket.emit('send_message', res.data);
            }

            setMessages(prev => [...prev, res.data]);
            setNewMessage('');
            fetchConversations();
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            handleSendMessage(null, file);
        }
    };

    const handleSearchMessages = async (query) => {
        setSearchMsg(query);
        if (!query.trim()) {
            setIsSearching(false);
            return;
        }
        setIsSearching(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/chat/messages/${selectedUser.id}/search?query=${query}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setSearchResults(res.data);
        } catch (error) {
            console.error('Error searching messages:', error);
        }
    };

    const filteredConversations = conversations.filter(c =>
        (c.name || c.username).toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <Layout>
            <div className="flex bg-white rounded-xl shadow-lg border border-gray-200 h-[calc(100vh-140px)] overflow-hidden">
                {/* Sidebar */}
                <div className="w-80 border-r border-gray-200 flex flex-col bg-white">
                    <div className="p-4 border-b border-gray-200">
                        <h2 className="text-xl font-bold mb-4 text-gray-800">Internal Chat</h2>
                        <div className="relative">
                            <IoSearch className="absolute left-3 top-3 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search users..."
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {filteredConversations.map((convUser) => (
                            <div
                                key={convUser.id}
                                className={`p-4 flex items-center cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-50 ${selectedUser?.id === convUser.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}
                                onClick={() => handleSelectUser(convUser)}
                            >
                                <div className="relative">
                                    <IoPersonCircleOutline className="text-4xl text-gray-400" />
                                    {convUser.unreadCount > 0 && (
                                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-bold">
                                            {convUser.unreadCount}
                                        </span>
                                    )}
                                </div>
                                <div className="ml-3 flex-1 overflow-hidden">
                                    <h3 className="font-semibold text-sm text-gray-800 truncate">{convUser.name || convUser.username}</h3>
                                    <p className="text-xs text-gray-500 truncate">{convUser.role} • {convUser.branch?.name || 'Main Office'}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Main View */}
                <div className="flex-1 flex flex-col bg-white">
                    {selectedUser ? (
                        <>
                            {/* Chat Header */}
                            <div
                                className="p-4 shadow-sm flex items-center justify-between"
                                style={{ backgroundColor: theme.primaryColor || '#2563eb' }}
                            >
                                <div className="flex items-center">
                                    <IoPersonCircleOutline className="text-4xl text-white/80" />
                                    <div className="ml-3">
                                        <h3 className="font-bold text-white">{selectedUser.name || selectedUser.username}</h3>
                                        <p className="text-xs text-white/80">Active now</p>
                                    </div>
                                </div>

                                {/* Message Search */}
                                <div className="relative">
                                    <IoSearchOutline className="absolute left-3 top-3 text-white/60" />
                                    <input
                                        type="text"
                                        placeholder="Search messages..."
                                        className="pl-10 pr-4 py-2 bg-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-white/20 text-white placeholder:text-white/60"
                                        value={searchMsg}
                                        onChange={(e) => handleSearchMessages(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Messages Area */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                {(isSearching ? searchResults : messages).map((msg, idx) => (
                                    <div
                                        key={idx}
                                        className={`flex ${msg.senderId === user?.id ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div className={`max-w-[70%] p-3 rounded-2xl shadow-sm relative ${msg.senderId === user?.id
                                            ? 'text-white rounded-br-none'
                                            : 'bg-gray-100 text-gray-800 rounded-bl-none'
                                            }`}
                                            style={msg.senderId === user?.id ? { backgroundColor: theme.primaryColor || '#2563eb' } : {}}
                                        >
                                            {msg.attachmentUrl && (
                                                <div className="mb-2">
                                                    {msg.attachmentType === 'IMAGE' ? (
                                                        <img
                                                            src={`${getServerUrl()}${msg.attachmentUrl}`}
                                                            alt="attachment"
                                                            className="rounded-lg max-w-full h-auto cursor-pointer"
                                                            onClick={() => window.open(`${getServerUrl()}${msg.attachmentUrl}`, '_blank')}
                                                        />
                                                    ) : (
                                                        <a
                                                            href={`${getServerUrl()}${msg.attachmentUrl}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className={`flex items-center p-3 rounded-lg ${msg.senderId === user?.id ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-700'}`}
                                                        >
                                                            <IoDocumentTextOutline className="text-2xl mr-3" />
                                                            <div className="overflow-hidden">
                                                                <p className="text-xs font-medium truncate">{msg.attachmentName || 'Document'}</p>
                                                                <p className="text-[10px] opacity-70">Click to view</p>
                                                            </div>
                                                        </a>
                                                    )}
                                                </div>
                                            )}
                                            {msg.message && <p className="text-sm">{msg.message}</p>}
                                            <p className={`text-[10px] mt-1 ${msg.senderId === user?.id ? 'text-blue-100' : 'text-gray-400'}`}>
                                                {moment(msg.createdAt).format('HH:mm')}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input Area */}
                            <form className="p-4 bg-white border-t border-gray-100" onSubmit={(e) => handleSendMessage(e)}>
                                <div className="flex items-center space-x-3">
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current.click()}
                                        className="p-2 text-gray-400 hover:text-blue-500 transition-colors"
                                    >
                                        <IoAttach className="text-2xl" />
                                    </button>
                                    <input
                                        type="file"
                                        className="hidden"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Type a message..."
                                        className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                    />
                                    <button
                                        type="submit"
                                        className="p-3 text-white rounded-full transition-colors disabled:opacity-50 shadow-lg"
                                        disabled={!newMessage.trim() && !fileInputRef.current?.files[0]} // Disable if no message and no file
                                        style={{ backgroundColor: theme.primaryColor || '#2563eb' }}
                                    >
                                        <IoSend className="text-xl" />
                                    </button>
                                </div>
                            </form>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                            <div className="w-20 h-20 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                                <IoPersonCircleOutline className="text-6xl" />
                            </div>
                            <h3 className="text-lg font-medium">Your Messages</h3>
                            <p className="text-sm">Select a colleague to start chatting</p>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
};

export default ChatPage;
