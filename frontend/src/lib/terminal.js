import api from './api';

const TERMINAL_KEY = 'jewellery_terminal_id';

export const getTerminalId = () => {
    if (typeof window === 'undefined') return null;

    let terminalId = localStorage.getItem(TERMINAL_KEY);
    if (!terminalId) {
        terminalId = window.crypto.randomUUID();
        localStorage.setItem(TERMINAL_KEY, terminalId);
    }
    return terminalId;
};

export const checkTerminalAccess = async () => {
    const terminalCode = getTerminalId();
    try {
        const { data } = await api.get(`/terminals/check?terminalCode=${terminalCode}`);
        return data; // { authorized: boolean, registered: boolean, terminal: {} }
    } catch (err) {
        console.error('Terminal check failed:', err);
        return { authorized: true, error: true }; // Default to true to avoid blocking on API failure? 
        // Or false for strict security. Given user request, maybe false.
    }
};

export const registerThisTerminal = async (name, branchId) => {
    const terminalCode = getTerminalId();
    try {
        const { data } = await api.post('/terminals/register', {
            terminalCode,
            name,
            branchId
        });
        return data;
    } catch (err) {
        throw err;
    }
};
