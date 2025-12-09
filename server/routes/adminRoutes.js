// Add these routes to your admin routes file
router.post('/subscriptions', authMiddleware, adminController.getUserSubscriptions);
router.post('/cancel-subscription', authMiddleware, adminController.cancelUserSubscription);