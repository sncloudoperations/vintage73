const { spawn } = require('child_process');

// Trigger migration creation
const child = spawn('cmd.exe', ['/c', 'npx prisma migrate dev --name sync_ticketing_master --skip-generate --skip-seed'], {
  cwd: 'c:/Users/Dell/Desktop/Inventory/inventory/backend',
  stdio: ['pipe', 'inherit', 'inherit'],
  shell: true
});

// Since migrate dev is interactive, we might need to send 'y'
// but let's see if it runs directly first.
// If it fails with "non-interactive", we try to force it.
