const { Prisma } = require('@prisma/client');

console.log('Fields in User model according to Prisma Client:');
console.log(Object.keys(Prisma.UserScalarFieldEnum || {}));
