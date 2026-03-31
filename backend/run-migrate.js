const { spawn } = require('child_process');

const pty = spawn('npx.cmd', ['prisma', 'migrate', 'dev', '--name', 'add_customer_auth_access'], {
   shell: true
});

pty.stdout.on('data', data => {
   const str = data.toString();
   process.stdout.write(str);
   // Prisma prompts: "We need to reset the PostgreSQL database ... Do you want to continue? All data will be lost. (y/N)"
   // OR "A unique constraint covering the columns `[username]` on the table `Customer` will be added. If there are existing duplicate values, this will fail."
   // Wait, does Prisma PROMPT "yes/no"? YES! "Do you want to continue? All data will be lost. (y/N)" or similar.
   // Wait, the warning says: "[username] will be added... If there are existing duplicate values, this will fail. -> Do you want to continue?"
   
   if (str.toLowerCase().includes('y/n') || str.toLowerCase().includes('yes/no')) {
       pty.stdin.write('y\n');
   }
});

pty.stderr.on('data', data => {
   process.stderr.write(data.toString());
});

pty.on('close', code => {
   console.log(`Exited with code ${code}`);
   process.exit(code);
});
