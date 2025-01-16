const xlsx = require('xlsx');
const csv = require('csv-parse');
const yaml = require('js-yaml');
const mammoth = require('mammoth');

class FileReader {
  static async readFile(fileBuffer, fileType) {
    try {
      switch (fileType) {
        case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        case 'application/vnd.ms-excel':
          return this.readExcelBuffer(fileBuffer);
        case 'text/csv':
          return this.readCSVBuffer(fileBuffer);
        case 'application/json':
          return this.readJSONBuffer(fileBuffer);
        case 'application/x-yaml':
        case 'text/yaml':
          return this.readYAMLBuffer(fileBuffer);
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          return this.readWordBuffer(fileBuffer);
        default:
          throw new Error(`Unsupported file type: ${fileType}`);
      }
    } catch (error) {
      console.error('Error reading file:', error);
      throw error;
    }
  }

  static async readExcelBuffer(buffer) {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(worksheet, { defval: '' });
    return this.normalizeData(data);
  }

  static async readCSVBuffer(buffer) {
    return new Promise((resolve, reject) => {
      const results = [];
      const parser = csv({ columns: true, trim: true });
      
      parser.on('data', (data) => results.push(data));
      parser.on('end', () => resolve(this.normalizeData(results)));
      parser.on('error', reject);
      
      parser.write(buffer);
      parser.end();
    });
  }

  static async readJSONBuffer(buffer) {
    const data = JSON.parse(buffer.toString());
    return this.normalizeData(Array.isArray(data) ? data : [data]);
  }

  static async readYAMLBuffer(buffer) {
    const data = yaml.load(buffer.toString());
    return this.normalizeData(Array.isArray(data) ? data : [data]);
  }

  static async readWordBuffer(buffer) {
    const result = await mammoth.extractRawText({ buffer });
    const stories = result.value.split('\n\n').filter(story => story.trim());
    return this.parseWordContent(stories);
  }

  static normalizeData(data) {
    return data.map(item => ({
      id: item.ID || item.id || item.storyId || `US${Date.now()}`,
      title: item.Title || item.title || item.name || item.summary || '',
      description: item.Description || item.description || item.desc || '',
      acceptanceCriteria: item['Acceptance Criteria'] || item.acceptanceCriteria || item.criteria || '',
      priority: item.Priority || item.priority || this.extractPriority(item.description || '') || 'medium'
    }));
  }

  static parseWordContent(stories) {
    return stories.map((story, index) => {
      const lines = story.split('\n').filter(line => line.trim());
      return {
        id: `US${index + 1}`,
        title: lines[0] || '',
        description: lines[1] || '',
        acceptanceCriteria: lines[2] || '',
        priority: this.extractPriority(story)
      };
    });
  }

  static extractPriority(text) {
    const lowercaseText = text.toLowerCase();
    if (lowercaseText.includes('high priority') || lowercaseText.includes('critical')) {
      return 'high';
    } else if (lowercaseText.includes('medium') || lowercaseText.includes('moderate')) {
      return 'medium';
    } else if (lowercaseText.includes('low priority')) {
      return 'low';
    }
    return 'medium';
  }
}

module.exports = FileReader; 