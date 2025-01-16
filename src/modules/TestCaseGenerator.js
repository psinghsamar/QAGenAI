const puppeteer = require('puppeteer');
const FileReader = require('../services/FileReader');
const { NlpManager } = require('node-nlp');

class TestCaseGenerator {
  constructor() {
    this.nlpManager = new NlpManager({ languages: ['en'] });
    this.initialized = false;
  }

  async initialize() {
    if (!this.initialized) {
      await this.trainNLP();
      this.initialized = true;
    }
  }

  async trainNLP() {
    // Train for test types
    this.nlpManager.addDocument('en', 'verify system performance under load', 'test.performance');
    this.nlpManager.addDocument('en', 'check response time', 'test.performance');
    this.nlpManager.addDocument('en', 'load testing', 'test.performance');

    this.nlpManager.addDocument('en', 'verify user interface', 'test.ui');
    this.nlpManager.addDocument('en', 'check display', 'test.ui');
    this.nlpManager.addDocument('en', 'validate layout', 'test.ui');

    this.nlpManager.addDocument('en', 'test integration', 'test.integration');
    this.nlpManager.addDocument('en', 'verify API connection', 'test.integration');
    this.nlpManager.addDocument('en', 'check third-party integration', 'test.integration');

    this.nlpManager.addDocument('en', 'verify security', 'test.security');
    this.nlpManager.addDocument('en', 'check authentication', 'test.security');
    this.nlpManager.addDocument('en', 'validate authorization', 'test.security');

    this.nlpManager.addDocument('en', 'smoke test', 'test.smoke');
    this.nlpManager.addDocument('en', 'basic functionality', 'test.smoke');

    this.nlpManager.addDocument('en', 'regression testing', 'test.regression');
    this.nlpManager.addDocument('en', 'verify existing functionality', 'test.regression');

    await this.nlpManager.train();
  }

  async generateFromFile(fileBuffer, fileType) {
    try {
      await this.initialize();
      const userStories = await FileReader.readFile(fileBuffer, fileType);
      return this.processUserStories(userStories);
    } catch (error) {
      console.error('Error generating test cases:', error);
      throw error;
    }
  }

  async processUserStories(userStories) {
    return Promise.all(userStories.map(async story => ({
      id: `TC${Date.now()}`,
      name: `Test: ${story.title}`,
      type: await this.determineTestType(story.description),
      priority: story.priority || 'medium',
      steps: this.generateTestSteps(story)
    })));
  }

  async determineTestType(description) {
    try {
      const result = await this.nlpManager.process('en', description);
      const intent = result.intent;
      
      const typeMap = {
        'test.performance': 'performance',
        'test.ui': 'ui',
        'test.integration': 'integration',
        'test.security': 'security',
        'test.smoke': 'smoke',
        'test.regression': 'regression'
      };

      return typeMap[intent] || 'functional';
    } catch (error) {
      console.error('Error determining test type:', error);
      return 'functional'; // default type
    }
  }

  generateTestSteps(story) {
    const steps = [];

    // Add basic steps based on description
    steps.push({
      id: `step1_${Date.now()}`,
      action: 'setup',
      description: 'Initialize test environment'
    });

    // Add steps based on acceptance criteria if available
    if (story.acceptanceCriteria) {
      const criteria = story.acceptanceCriteria.split('\n');
      criteria.forEach((criterion, index) => {
        steps.push({
          id: `step${index + 2}_${Date.now()}`,
          action: 'verify',
          description: criterion.trim()
        });
      });
    }

    // Add cleanup step
    steps.push({
      id: `step${steps.length + 1}_${Date.now()}`,
      action: 'cleanup',
      description: 'Cleanup test environment'
    });

    return steps;
  }

  async generateFromURL(url, options = {}) {
    // Implementation for URL-based test generation
    // This will be implemented when needed
    throw new Error('URL-based test generation not implemented yet');
  }
}

module.exports = TestCaseGenerator;
