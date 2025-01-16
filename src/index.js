import React from 'react';
import { createRoot } from 'react-dom/client';
import TestCaseGenerator from './components/TestCaseGenerator';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';

const theme = createTheme();
const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <TestCaseGenerator />
    </ThemeProvider>
  </React.StrictMode>
);