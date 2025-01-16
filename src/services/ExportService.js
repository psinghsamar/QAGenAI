const xlsx = require('xlsx');
const { Parser } = require('json2csv');

class ExportService {
  export(testCases, format) {
    try {
      console.log('ExportService: Starting export with format:', format);
      console.log('ExportService: Number of test cases:', testCases.length);

      if (!testCases || !Array.isArray(testCases)) {
        throw new Error('Invalid test cases data');
      }

      if (!format || typeof format !== 'string') {
        throw new Error('Invalid export format');
      }

      switch (format.toLowerCase()) {
        case 'json':
          return this.exportJSON(testCases);
        case 'csv':
          return this.exportCSV(testCases);
        case 'xlsx':
          return this.exportExcel(testCases);
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      console.error('ExportService error:', error);
      throw error;
    }
  }

  exportJSON(testCases) {
    try {
      return Buffer.from(JSON.stringify(testCases, null, 2));
    } catch (error) {
      throw new Error(`JSON export failed: ${error.message}`);
    }
  }

  exportCSV(testCases) {
    try {
      const flattenedData = testCases.map(tc => ({
        ID: tc.id,
        Name: tc.name,
        Type: tc.type,
        Priority: tc.priority,
        Steps: Array.isArray(tc.steps) ? tc.steps.map(step => 
          `${step.action}: ${step.description}`
        ).join('; ') : ''
      }));

      const parser = new Parser({
        fields: ['ID', 'Name', 'Type', 'Priority', 'Steps']
      });
      
      return Buffer.from(parser.parse(flattenedData));
    } catch (error) {
      throw new Error(`CSV export failed: ${error.message}`);
    }
  }

  exportExcel(testCases) {
    try {
      // Flatten test cases for Excel format
      const flattenedData = testCases.map(tc => ({
        ID: tc.id,
        Name: tc.name,
        Type: tc.type,
        Priority: tc.priority,
        Steps: Array.isArray(tc.steps) ? tc.steps.map(step => 
          `${step.action}: ${step.description}`
        ).join('\n') : ''
      }));

      // Create worksheet
      const worksheet = xlsx.utils.json_to_sheet(flattenedData);

      // Auto-size columns
      const colWidths = [
        { wch: 15 }, // ID
        { wch: 30 }, // Name
        { wch: 15 }, // Type
        { wch: 10 }, // Priority
        { wch: 50 }  // Steps
      ];
      worksheet['!cols'] = colWidths;

      // Create workbook
      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, 'Test Cases');

      // Generate buffer
      return xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    } catch (error) {
      throw new Error(`Excel export failed: ${error.message}`);
    }
  }

  getContentType(format) {
    const types = {
      json: 'application/json',
      csv: 'text/csv',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
    return types[format.toLowerCase()] || 'application/octet-stream';
  }

  getFileName(format) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `test-cases-${timestamp}.${format.toLowerCase()}`;
  }
}

module.exports = ExportService; 