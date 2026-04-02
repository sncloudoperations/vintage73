const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);
const upload = require('../middleware/uploadMiddleware');

router.get('/admins', userController.getAdminsByBranch);
router.get('/staff', userController.getStaffByBranch);
router.get('/', userController.getUsers);
router.get('/:id', userController.getUserById);
router.post('/', upload.single('image'), userController.createUser);
router.put('/:id', upload.single('image'), userController.updateUser);
router.put('/:id/password', userController.updatePassword);
router.delete('/:id', userController.deleteUser);

module.exports = router;
