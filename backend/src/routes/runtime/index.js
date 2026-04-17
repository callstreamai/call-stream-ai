const express = require('express');
const router = express.Router();
const { runtimeAuth } = require('../middleware/auth');
const deploymentResolve = require('./runtime/deploymentResolve');
const clientEndpoints = require('./runtime/clientEndpoints');

// All runtime routes require API token
router.use(runtimeAuth);

// Primary endpoint - deployment resolution
router.post('/deployment-resolve', deploymentResolve.resolve);

// Supporting endpoints
router.get('/:clientId/directory', clientEndpoints.getDirectory);
router.get('/:clientId/hours', clientEndpoints.getHours);
router.get('/:clientId/routing', clientEndpoints.getRouting);
router.get('/:clientId/context', clientEndpoints.getContext);
router.get('/:clientId/faq', clientEndpoints.getFaq);

module.exports = router;
