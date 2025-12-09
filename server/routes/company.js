const express = require('express')
const router = express.Router()
const companyController = require('../controllers/companyController')
const { authenticateToken } = require('../middleware/auth')

// Company routes
router.get('/get-company', companyController.getCompanyByCompanyRole)
router.get('/user-companyId', companyController.getCompanyUsers)
router.get(
  '/user-companies',
  authenticateToken,
  companyController.getUserCompanies
)
router.put('/:id/toggle-enabled', companyController.toggleEnabled)
router.put(
  '/:id/toggle-auto-create-tasks',
  companyController.toggleAutoCreateTasks
)
router.put(
  '/:id/toggle-show-cost-estimates',
  companyController.toggleShowCostEstimates
)
router.get('/domain/:domain', companyController.getCompanyByDomain)

// More specific routes should come BEFORE generic :id routes

router.get('/stats/:id', companyController.getCompanyStats)
router.get('/bootstrap/:id', authenticateToken, companyController.getCompanyBootstrap)

// Generic routes should come last
router.get('/:id', companyController.getCompanyById)
router.put('/:id', companyController.updateCompany)
router.delete('/:id', companyController.deleteCompany)
router.get('/', companyController.getAllCompanies)

module.exports = router
