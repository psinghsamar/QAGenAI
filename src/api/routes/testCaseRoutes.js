const express = require('express');
const router = express.Router();
const multer = require('multer');
const TestCaseGenerator = require('../../modules/TestCaseGenerator');
const ExportService = require('../../services/ExportService');

// Configure multer with file type validation
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
      'application/vnd.ms-excel', // xls
      'text/csv',
      'application/json',
      'application/x-yaml',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // docx
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Error handling middleware
const handleError = (err, res) => {
  console.error('Detailed error:', err);
  
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: true,
        message: 'File size too large. Maximum size is 5MB'
      });
    }
  }
  
  if (err.message.includes('Unsupported file type')) {
    return res.status(400).json({
      error: true,
      message: err.message
    });
  }

  return res.status(500).json({
    error: true,
    message: err.message || 'An unexpected error occurred'
  });
};

// Generate test cases from file
router.post('/generate-tests/file', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      return handleError(err, res);
    }

    try {
      if (!req.file) {
        throw new Error('No file uploaded');
      }

      const generator = new TestCaseGenerator();
      const fileContent = req.file.buffer;
      const fileType = req.file.mimetype;

      // Validate file content
      try {
        await validateFileContent(fileContent, fileType);
      } catch (validationError) {
        return res.status(400).json({
          error: true,
          message: `Invalid file content: ${validationError.message}`
        });
      }

      const testCases = await generator.generateFromFile(fileContent, fileType);
      res.json(testCases);
    } catch (error) {
      handleError(error, res);
    }
  });
});

// Generate test cases from URL
router.post('/generate-tests/url', async (req, res) => {
  try {
    const { url, username, password } = req.body;

    if (!url) {
      return res.status(400).json({
        error: true,
        message: 'URL is required'
      });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (e) {
      return res.status(400).json({
        error: true,
        message: 'Invalid URL format'
      });
    }

    const generator = new TestCaseGenerator();
    const testCases = await generator.generateFromURL(url, { username, password });
    res.json(testCases);
  } catch (error) {
    handleError(error, res);
  }
});

// Helper function to validate file content
async function validateFileContent(content, type) {
  try {
    // Add specific validation logic based on file type
    switch (type) {
      case 'application/json':
        JSON.parse(content.toString());
        break;
      case 'text/csv':
        // Check if CSV has required headers
        const firstLine = content.toString().split('\n')[0];
        if (!firstLine.includes('ID') && !firstLine.includes('Description')) {
          throw new Error('CSV must contain required headers (ID, Description)');
        }
        break;
      // Add more validations for other file types
    }
  } catch (error) {
    throw new Error(`File content validation failed: ${error.message}`);
  }
}

// Export test cases
router.post('/export-tests', async (req, res) => {
  try {
    console.log('Received export request:', {
      format: req.body.format,
      testCasesCount: req.body.testCases?.length
    });

    const { testCases, format } = req.body;
    
    if (!testCases || !Array.isArray(testCases)) {
      throw new Error('Invalid test cases data');
    }

    if (!format) {
      throw new Error('Export format not specified');
    }

    console.log('Attempting to export with format:', format);
    
    const exportService = new ExportService();
    const buffer = await exportService.export(testCases, format);
    
    console.log('Export successful, buffer size:', buffer.length);

    const contentType = exportService.getContentType(format);
    const fileName = exportService.getFileName(format);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.send(buffer);
  } catch (error) {
    console.error('Detailed export error:', error);
    
    // Send error response in JSON format
    res.status(500).json({
      error: true,
      message: `Export failed: ${error.message || 'Unknown error'}`,
      details: error.stack
    });
  }
});

module.exports = router; 