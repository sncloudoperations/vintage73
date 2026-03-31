const { spawn } = require('child_process');

// Run prisma migrate dev with --create-only to avoid interactive prompt
const pty = spawn('cmd.exe', ['/c', 'npx prisma migrate dev --name add_ticket_id_to_notification'], {
    cwd: 'c:/Users/Dell/Desktop/Inventory/inventory/backend',
    stdio: ['pipe', 'inherit', 'inherit'],
    shell: true
});

// Since migrate dev is interactive, we might still fail. 
// If it fails, we will try `db push` as a last resort IF explicitly allowed, 
// but for now we follow "make migration dont db push".
