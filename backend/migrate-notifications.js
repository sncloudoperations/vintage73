const { spawn } = require('child_process');

const pty = spawn('cmd.exe', ['/c', 'npx prisma migrate dev --name ticketing_notifications --skip-generate --skip-seed'], {
    cwd: 'c:/Users/Dell/Desktop/Inventory/inventory/backend',
    stdio: ['pipe', 'inherit', 'inherit'],
    shell: true
});

// If it asks for confirmation, we might need a way to send 'y'.
// But usually npx in cmd works directly if no reset is needed.
