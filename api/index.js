const handleRequest = require('../server.js');

module.exports = (req, res) => {
  if (req.url && (req.url.includes('debug') || req.headers['x-matched-path']?.includes('debug'))) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      url: req.url,
      headers: req.headers
    }, null, 2));
  }
  return handleRequest(req, res);
};
