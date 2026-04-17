const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const clients = require('./admin/clients');
const departments = require('./admin/departments');
const directory = require('./admin/directory');
const hours = require('./admin/hours');
const holidays = require('./admin/holidays');
const routing = require('./admin/routing');
const intents = require('./admin/intents');
const kb = require('./admin/kb');
const deployments = require('./admin/deployments');
const imports = require('./admin/imports');
const publish = require('./admin/publish');
const preview = require('./admin/preview');
const audit = require('./admin/audit');

// All admin routes require auth
router.use(adminAuth);

// Clients
router.get('/clients', clients.list);
router.post('/clients', clients.create);
router.get('/clients/:id', clients.get);
router.put('/clients/:id', clients.update);
router.delete('/clients/:id', clients.remove);

// Departments
router.get('/clients/:clientId/departments', departments.list);
router.post('/clients/:clientId/departments', departments.create);
router.put('/clients/:clientId/departments/:id', departments.update);
router.delete('/clients/:clientId/departments/:id', departments.remove);

// Directory
router.get('/clients/:clientId/directory', directory.list);
router.post('/clients/:clientId/directory', directory.create);
router.put('/clients/:clientId/directory/:id', directory.update);
router.delete('/clients/:clientId/directory/:id', directory.remove);

// Hours
router.get('/clients/:clientId/hours', hours.list);
router.post('/clients/:clientId/hours', hours.upsert);
router.delete('/clients/:clientId/hours/:id', hours.remove);

// Holidays
router.get('/clients/:clientId/holidays', holidays.list);
router.post('/clients/:clientId/holidays', holidays.create);
router.put('/clients/:clientId/holidays/:id', holidays.update);
router.delete('/clients/:clientId/holidays/:id', holidays.remove);

// Routing Rules
router.get('/clients/:clientId/routing', routing.list);
router.post('/clients/:clientId/routing', routing.create);
router.put('/clients/:clientId/routing/:id', routing.update);
router.delete('/clients/:clientId/routing/:id', routing.remove);

// Intents
router.get('/clients/:clientId/intents', intents.list);
router.post('/clients/:clientId/intents', intents.create);
router.put('/clients/:clientId/intents/:id', intents.update);
router.delete('/clients/:clientId/intents/:id', intents.remove);

// Knowledge Base
router.get('/clients/:clientId/kb', kb.list);
router.post('/clients/:clientId/kb', kb.create);
router.put('/clients/:clientId/kb/:id', kb.update);
router.delete('/clients/:clientId/kb/:id', kb.remove);

// Deployment Bindings
router.get('/clients/:clientId/deployments', deployments.list);
router.post('/clients/:clientId/deployments', deployments.create);
router.put('/clients/:clientId/deployments/:id', deployments.update);
router.delete('/clients/:clientId/deployments/:id', deployments.remove);

// Import
router.post('/clients/:clientId/imports', imports.upload);
router.get('/clients/:clientId/imports', imports.list);
router.get('/clients/:clientId/imports/:id', imports.get);
router.post('/clients/:clientId/imports/:id/approve', imports.approve);

// Publish
router.post('/clients/:clientId/publish', publish.publishVersion);
router.get('/clients/:clientId/versions', publish.listVersions);

// Preview
router.post('/preview/simulate', preview.simulate);

// Audit
router.get('/clients/:clientId/audit', audit.list);

// Verticals
router.get('/verticals', clients.listVerticals);

module.exports = router;
