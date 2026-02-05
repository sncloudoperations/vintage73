const prisma = require('./utils/prismaClient');

async function checkUsers() {
  try {
    console.log('Fetching users...');
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        role: true,
        name: true,
        branchId: true,
        password: true 
      }
    });

    if (users.length === 0) {
      console.log('No users found in the database.');
    } else {
      console.log('Found users:');
      users.forEach(u => {
        console.log(`ID: ${u.id}, Username: ${u.username}, Role: ${u.role}, Name: ${u.name}, Branch: ${u.branchId}`);
        // We won't print the password hash, but knowing it exists is good.
      });
    }
  } catch (error) {
    console.error('Error fetching users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();
