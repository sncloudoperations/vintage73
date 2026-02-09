import React, { useState, useEffect, useRef } from 'react';
import { IoNotificationsOutline } from 'react-icons/io5';
import axios from 'axios';
import { getSocket } from '@/utils/socket';
import { useRouter } from 'next/router';

const NotificationBell = ({ variant = 'default' }) => {
    const [notifications, setNotifications] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef(null);
    const router = useRouter();

    useEffect(() => {
        fetchNotifications();

        // Listen for new notifications via socket
        const socket = getSocket();
        if (socket) {
            socket.on('new_notification', (notification) => {
                setNotifications(prev => [notification, ...prev]);
            });
        }

        // Close dropdown when clicking outside
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            if (socket) socket.off('new_notification');
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const fetchNotifications = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/notifications`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setNotifications(res.data);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    };

    const markAsRead = async (id) => {
        try {
            const token = localStorage.getItem('token');
            await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/api/notifications/${id}/read`, {}, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    const handleNotificationClick = (notification) => {
        markAsRead(notification.id);
        if (notification.type === 'MESSAGE') {
            router.push('/chat');
        } else if (notification.link) {
            router.push(notification.link);
        }
        setShowDropdown(false);
    };

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setShowDropdown(!showDropdown)}
                className={`p-2 rounded-full transition-colors relative ${variant === 'white' ? 'hover:bg-white/10' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            >
                <IoNotificationsOutline className={`text-2xl ${variant === 'white' ? 'text-white' : 'text-gray-600 dark:text-gray-300'}`} />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold border-2 border-white dark:border-gray-800">
                        {unreadCount}
                    </span>
                )}
            </button>

            {showDropdown && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 max-h-96 flex flex-col">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 rounded-t-xl">
                        <h3 className="font-bold dark:text-white">Notifications</h3>
                        <span className="text-xs text-blue-500 font-medium">{unreadCount} New</span>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {notifications.length > 0 ? (
                            notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    onClick={() => handleNotificationClick(notification)}
                                    className={`p-4 border-b border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${!notification.isRead ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                                >
                                    <h4 className={`text-sm font-semibold mb-1 ${!notification.isRead ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-200'}`}>
                                        {notification.title}
                                    </h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{notification.message}</p>
                                    <span className="text-[10px] text-gray-400 mt-2 block">
                                        {new Date(notification.createdAt).toLocaleString()}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <div className="p-8 text-center text-gray-400">
                                <p className="text-sm">No notifications yet</p>
                            </div>
                        )}
                    </div>

                    <button
                        className="p-3 text-center text-xs text-blue-500 font-semibold border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-b-xl"
                        onClick={() => router.push('/notifications')}
                    >
                        View All Notifications
                    </button>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
