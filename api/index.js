const handleRequest = require('../server.js');
const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  if (req.url && req.url.includes('debug')) {
    const cwd = process.cwd();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      url: req.url,
      cwd: cwd,
      dirname: __dirname,
      filesCwd: fs.readdirSync(cwd),
      filesDir: fs.readdirSync(__dirname),
      adminHtmlInCwd: fs.existsSync(path.join(cwd, 'admin.html')),
      adminHtmlInDir: fs.existsSync(path.join(__dirname, 'admin.html')),
      adminHtmlInParent: fs.existsSync(path.join(__dirname, '..', 'admin.html'))
    }, null, 2));
  }
  return handleRequest(req, res);
};
