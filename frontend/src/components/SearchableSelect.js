import React, { useState, useRef, useEffect } from 'react';
import { FiSearch, FiChevronDown, FiX } from 'react-icons/fi';
import { useTheme } from '@/context/ThemeContext';

const SearchableSelect = ({ options, value, onChange, placeholder = "Select option", className = "" }) => {
    const { theme } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef(null);
    const inputRef = useRef(null);

    const selectedOption = (options || []).find(opt => opt.value == value);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const filteredOptions = (options || []).filter(opt =>
        (opt.label || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSelect = (val) => {
        onChange(val);
        setIsOpen(false);
        setSearchTerm('');
    };

    return (
        <div className={`relative ${className}`} ref={wrapperRef}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full min-h-[48px] bg-white border rounded-lg px-4 flex items-center justify-between cursor-pointer transition-all group shadow-sm ${isOpen ? 'border-primary ring-2 ring-primary/20' : 'border-slate-200 hover:border-slate-300'}`}
                style={isOpen ? { borderColor: theme.primaryColor, boxShadow: `0 0 0 2px ${theme.primaryColor}33` } : {}}
            >
                <span className={`text-sm truncate ${selectedOption ? 'text-slate-800 font-semibold' : 'text-slate-400 font-medium'}`}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <FiChevronDown className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} size={16} />
            </div>

            {isOpen && (
                <div className="absolute z-[100] top-full left-0 min-w-full mt-1 bg-white border border-slate-200 shadow-2xl rounded-lg overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    <div className="p-2 border-b border-slate-100 bg-slate-50">
                        <div className="relative">
                            <FiSearch className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input
                                ref={inputRef}
                                type="text"
                                className="w-full pl-8 pr-2 py-1.5 text-xs bg-white border border-slate-200 rounded focus:outline-none transition-all"
                                style={searchTerm ? { borderColor: theme.primaryColor, boxShadow: `0 0 0 1px ${theme.primaryColor}33` } : {}}
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto py-1">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((opt) => (
                                <div
                                    key={opt.value}
                                    onClick={() => handleSelect(opt.value)}
                                    className={`px-3 py-2 text-[12px] cursor-pointer transition-colors ${value === opt.value ? 'bg-slate-100 font-bold' : 'hover:bg-slate-50 text-slate-700'}`}
                                    style={value === opt.value ? { color: theme.primaryColor } : {}}
                                >
                                    {opt.label}
                                </div>
                            ))
                        ) : (
                            <div className="px-3 py-4 text-center text-xs text-slate-400 italic">
                                No results found
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
