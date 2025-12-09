const express = require('express');
const router = express.Router();
const { authenticateToken, isAdmin } = require('../middleware/auth');
const productController = require('../controllers/productController');

// Get all products
router.get('/', authenticateToken, productController.getAllProducts);

// Get a product by ID
router.get('/:id', authenticateToken, productController.getProductById);

// Create a new product (admin only)
router.post('/', authenticateToken, isAdmin, productController.createProduct);

// Update a product (admin only)
router.put('/:id', authenticateToken, isAdmin, productController.updateProduct);

// Delete a product (admin only)
router.delete('/:id', authenticateToken, isAdmin, productController.deleteProduct);

// Toggle product status (admin only)
router.patch('/:id/toggle', authenticateToken, isAdmin, productController.toggleProductStatus);

module.exports = router;
