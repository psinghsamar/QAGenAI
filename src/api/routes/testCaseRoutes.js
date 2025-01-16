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
      throw new Error('URL is required');
    }

    const generator = new TestCaseGenerator();
    req.app.locals.generator = generator; // Store generator instance

    await generator.initialize();
    await generator.startRecording(url, { 
      username, 
      password,
      onComplete: (testCases) => {
        // Store test cases for later retrieval
        req.app.locals.lastGeneratedTests = testCases;
      }
    });

    res.json({ status: 'recording' });
  } catch (error) {
    console.error('URL test generation error:', error);
    res.status(500).json({
      error: true,
      message: error.message || 'Failed to generate tests from URL'
    });
  }
});

// Add a new route to handle recording stop
router.post('/stop-recording', async (req, res) => {
  try {
    const generator = req.app.locals.generator;
    if (!generator) {
      throw new Error('No active recording session found');
    }

    const testCases = await generator.stopRecording();
    
    // Validate generated test cases
    if (!testCases || !Array.isArray(testCases) || testCases.length === 0) {
      throw new Error('No valid test cases were generated');
    }

    // Store valid test cases
    req.app.locals.lastGeneratedTests = testCases;
    req.app.locals.generator = null;

    res.json(testCases);
  } catch (error) {
    console.error('Stop recording error:', error);
    res.status(500).json({
      error: true,
      message: error.message || 'Failed to stop recording'
    });
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
    console.log('Export request received:', req.body);
    const { testCases, format } = req.body;
    
    // Validate test cases
    if (!testCases || !Array.isArray(testCases) || testCases.length === 0) {
      console.error('Invalid test cases:', testCases);
      throw new Error('Invalid or empty test cases data');
    }

    // Validate format
    if (!format || !['json', 'csv', 'xlsx'].includes(format.toLowerCase())) {
      throw new Error('Invalid export format. Supported formats: json, csv, xlsx');
    }

    const exportService = new ExportService();
    const buffer = await exportService.export(testCases, format);
    
    // Log successful export
    console.log(`Successfully exported ${testCases.length} test cases to ${format}`);

    // Set appropriate headers
    const contentType = exportService.getContentType(format);
    const fileName = exportService.getFileName(format);
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.send(buffer);
  } catch (error) {
    console.error('Export error details:', {
      message: error.message,
      stack: error.stack,
      body: req.body
    });

    res.status(400).json({
      error: true,
      message: `Export failed: ${error.message}`
    });
  }
});

module.exports = router; 