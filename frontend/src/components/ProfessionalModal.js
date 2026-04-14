import React from 'react';
import { FiAlertCircle, FiCheckCircle, FiInfo, FiX, FiPrinter, FiSave } from 'react-icons/fi';

const ProfessionalModal = ({ 
    isOpen, 
    onClose, 
    onConfirm, 
    title, 
    message, 
    type = 'info', 
    confirmText = 'Confirm', 
    cancelText = 'Cancel',
    details = []
}) => {
    if (!isOpen) return null;

    const themes = {
        success: {
            icon: <FiCheckCircle className="text-emerald-500" size={24} />,
            bg: 'bg-emerald-50',
            button: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200',
            ring: 'ring-emerald-500/20',
            accent: 'border-emerald-500'
        },
        danger: {
            icon: <FiAlertCircle className="text-red-500" size={24} />,
            bg: 'bg-red-50',
            button: 'bg-red-600 hover:bg-red-700 shadow-red-200',
            ring: 'ring-red-500/20',
            accent: 'border-red-500'
        },
        info: {
            icon: <FiInfo className="text-blue-500" size={24} />,
            bg: 'bg-blue-50',
            button: 'bg-blue-600 hover:bg-blue-700 shadow-blue-200',
            ring: 'ring-blue-500/20',
            accent: 'border-blue-500'
        }
    };

    const theme = themes[type] || themes.info;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100 opacity-100 border border-slate-100">
                {/* Header Accent */}
                <div className={`h-1.5 w-full ${theme.button}`} />
                
                <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                        <div className={`w-12 h-12 rounded-xl ${theme.bg} flex items-center justify-center shadow-inner ring-1 ${theme.ring}`}>
                            {theme.icon}
                        </div>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all">
                            <FiX size={20} />
                        </button>
                    </div>

                    <h3 className="text-xl font-semibold text-slate-800 mb-2">{title}</h3>
                    <p className="text-sm font-medium text-slate-500 mb-6">{message}</p>

                    {/* Transaction Details Summary */}
                    {details.length > 0 && (
                        <div className="bg-slate-50 rounded-xl p-4 mb-6 border border-slate-100 space-y-3">
                            {details.map((detail, idx) => (
                                <div key={idx} className="flex justify-between items-center text-xs">
                                    <span className="text-slate-400 font-medium uppercase tracking-wider">{detail.label}</span>
                                    <span className="text-slate-700 font-medium tabular-nums">{detail.value}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    <div className="flex gap-3">
                        <button 
                            onClick={onClose}
                            className="flex-1 px-5 py-3 rounded-xl border border-slate-200 text-slate-600 font-medium text-xs uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95"
                        >
                            {cancelText}
                        </button>
                        <button 
                            onClick={onConfirm}
                            className={`flex-1 px-5 py-3 rounded-xl text-white font-medium text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 ${theme.button}`}
                        >
                            {type === 'success' ? <FiSave /> : null}
                            {confirmText}
                        </button>
                    </div>
                </div>

                {/* Footer Tip */}
                <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Secure cloud transaction</span>
                </div>
            </div>
        </div>
    );
};

export default ProfessionalModal;
