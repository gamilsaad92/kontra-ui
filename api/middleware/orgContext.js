const requireOrg = require('../middlewares/requireOrg');

const orgContext = (req, res, next) => requireOrg(req, res, next);

module.exports = { orgContext };
