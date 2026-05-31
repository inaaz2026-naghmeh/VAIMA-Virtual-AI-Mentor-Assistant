const express = require('express');
const safetyMiddleware = require('./safetyMiddleware');
const { askExpert } = require('./aiController');

const app = express();
app.use(express.json());

// Main tested high-compliance API endpoint
app.post('/api/expert/ask', safetyMiddleware, askExpert);

// Only listen if run directly, not when required by supertest
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Test Express server running inline on port ${PORT}`);
  });
}

module.exports = app;
