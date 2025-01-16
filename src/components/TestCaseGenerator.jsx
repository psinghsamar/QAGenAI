import React, { useState } from 'react';
import axios from 'axios';
import {
  Box,
  Button,
  Card,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Tab,
  Tabs,
  TextField,
  Typography,
  CircularProgress,
  Alert,
  Snackbar
} from '@mui/material';

const TestCaseGenerator = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [exportFormat, setExportFormat] = useState('json');
  const [loading, setLoading] = useState(false);
  const [testCases, setTestCases] = useState(null);
  const [error, setError] = useState(null);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    setTestCases(null);
  };

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null); // Clear previous errors
    const formData = new FormData();

    try {
      let response;
      if (activeTab === 0) { // File upload
        if (!file) {
          throw new Error('Please select a file first');
        }
        formData.append('file', file);
        response = await axios.post('/api/generate-tests/file', formData);
      } else { // URL based
        if (!url) {
          throw new Error('Please enter a URL');
        }
        response = await axios.post('/api/generate-tests/url', {
          url,
          username,
          password
        });
      }

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      setTestCases(response.data);
    } catch (error) {
      console.error('Error details:', error);
      setError(error.response?.data?.message || error.message || 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setLoading(true);
      console.log('Starting export with format:', exportFormat);
      console.log('Test cases to export:', testCases);

      if (!testCases || testCases.length === 0) {
        throw new Error('No test cases available to export');
      }

      const response = await axios.post('/api/export-tests', {
        testCases,
        format: exportFormat
      }, {
        responseType: 'blob',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('Export response received:', response);

      // Create download link
      const blob = new Blob([response.data], { 
        type: response.headers['content-type'] || 'application/octet-stream'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const fileName = `test-cases.${exportFormat.toLowerCase()}`;

      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setError(null); // Clear any existing errors
    } catch (error) {
      console.error('Detailed export error:', error);
      console.error('Error response:', error.response);
      
      let errorMessage = 'Error exporting test cases. ';
      
      if (error.response?.data instanceof Blob) {
        // Try to read the error message from the blob
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const errorData = JSON.parse(reader.result);
            setError(errorData.message || 'Unknown error occurred');
          } catch (e) {
            setError('Error exporting test cases. Please try again.');
          }
        };
        reader.readAsText(error.response.data);
      } else {
        errorMessage += error.response?.data?.message || error.message || 'Please try again.';
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const validateInput = () => {
    if (activeTab === 0 && !file) {
      setError('Please select a file first');
      return false;
    }
    if (activeTab === 1 && !url) {
      setError('Please enter a URL');
      return false;
    }
    return true;
  };

  return (
    <Box sx={{ maxWidth: 800, margin: 'auto', padding: 3 }}>
      <Typography variant="h4" gutterBottom>
        Test Case Generator
      </Typography>

      <Card sx={{ marginBottom: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab label="Upload User Stories" />
          <Tab label="URL Based" />
        </Tabs>

        <Box sx={{ padding: 3 }}>
          {activeTab === 0 ? (
            <Box>
              <input
                accept=".xlsx,.xls,.csv,.json,.yaml,.yml,.docx,.doc"
                style={{ display: 'none' }}
                id="file-input"
                type="file"
                onChange={handleFileChange}
              />
              <label htmlFor="file-input">
                <Button variant="contained" component="span">
                  Choose File
                </Button>
              </label>
              {file && (
                <Typography sx={{ mt: 2 }}>
                  Selected file: {file.name}
                </Typography>
              )}
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="URL"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                fullWidth
              />
              <TextField
                label="Username (optional)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                fullWidth
              />
              <TextField
                label="Password (optional)"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                fullWidth
              />
            </Box>
          )}

          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={loading || (activeTab === 0 && !file) || (activeTab === 1 && !url)}
            sx={{ mt: 3 }}
          >
            {loading ? <CircularProgress size={24} /> : 'Generate Test Cases'}
          </Button>
        </Box>
      </Card>

      {testCases && (
        <Card sx={{ padding: 3 }}>
          <Typography variant="h6" gutterBottom>
            Generated Test Cases
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
            <FormControl sx={{ minWidth: 120 }}>
              <InputLabel>Export Format</InputLabel>
              <Select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value)}
                label="Export Format"
              >
                <MenuItem value="json">JSON</MenuItem>
                <MenuItem value="csv">CSV</MenuItem>
                <MenuItem value="xlsx">Excel</MenuItem>
              </Select>
            </FormControl>
            <Button variant="contained" onClick={handleExport}>
              Export
            </Button>
          </Box>

          <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
            <pre>{JSON.stringify(testCases, null, 2)}</pre>
          </Box>
        </Card>
      )}

      <Snackbar 
        open={!!error} 
        autoHideDuration={6000} 
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setError(null)} 
          severity="error" 
          sx={{ width: '100%' }}
        >
          {error}
        </Alert>
      </Snackbar>

      {activeTab === 0 && file && (
        <Typography 
          variant="caption" 
          color={isValidFileType(file) ? 'success.main' : 'error.main'}
          sx={{ mt: 1, display: 'block' }}
        >
          {isValidFileType(file) 
            ? 'File type is supported' 
            : 'Unsupported file type. Please use .xlsx, .csv, .json, .yaml, or .docx'}
        </Typography>
      )}
    </Box>
  );
};

export default TestCaseGenerator; 