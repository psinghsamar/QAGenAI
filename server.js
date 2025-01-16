const express = require('express');
const cors = require('cors');
const path = require('path');
const testCaseRoutes = require('./src/api/routes/testCaseRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Increase payload size limits
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Enable CORS
app.use(cors());

// Serve static files
app.use(express.static(path.join(__dirname, 'dist')));
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api', testCaseRoutes);

// Handle React routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Frontend: http://localhost:3000`);
  console.log(`Backend: http://localhost:${PORT}`);
}); 