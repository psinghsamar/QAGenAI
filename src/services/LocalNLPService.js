const { NlpManager } = require('node-nlp');
const FileReader = require('./FileReader');

class LocalNLPService {
  constructor() {
    this.manager = new NlpManager({ languages: ['en'] });
    this.initialized = false;
  }

  async initialize() {
    if (!this.initialized) {
      // Train the NLP manager with test-related patterns
      await this.trainManager();
      this.initialized = true;
    }
  }

  async trainManager() {
    // Add test-related patterns
    this.manager.addDocument('en', 'verify login functionality', 'test.login');
    this.manager.addDocument('en', 'check search feature', 'test.search');
    this.manager.addDocument('en', 'validate navigation', 'test.navigation');
    this.manager.addDocument('en', 'test cart operations', 'test.cart');

    // Train the manager
    await this.manager.train();
    console.log('NLP Manager trained successfully');
  }

  async generateTestCases(pageElements) {
    try {
      await this.initialize();

      const testCases = [];
      
      // Generate test cases based on page elements
      for (const button of pageElements.buttons || []) {
        const response = await this.manager.process('en', button.text);
        testCases.push(this.createTestCase(button, response.intent));
      }

      for (const form of pageElements.forms || []) {
        testCases.push(this.createFormTestCase(form));
      }

      // Add default navigation test
      testCases.push(this.createNavigationTest());

      return testCases;
    } catch (error) {
      console.error('Error generating test cases:', error);
      return this.getFallbackTestCases();
    }
  }

  createTestCase(element, intent) {
    return {
      id: `TC${Date.now()}`,
      name: `Test ${element.text} functionality`,
      type: 'ui',
      steps: [
        {
          action: 'navigate',
          value: 'https://www.bestbuy.com'
        },
        {
          action: 'click',
          selector: element.selector,
          value: element.text
        },
        {
          action: 'verify',
          selector: element.selector,
          expectedResult: `${element.text} action successful`
        }
      ]
    };
  }

  createFormTestCase(form) {
    return {
      id: `TC${Date.now()}`,
      name: `Test ${form.id} submission`,
      type: 'ui',
      steps: form.inputs.map(input => ({
        action: 'type',
        selector: `#${input.name}`,
        value: this.getDefaultValue(input.type)
      }))
    };
  }

  createNavigationTest() {
    return {
      id: `TC${Date.now()}`,
      name: 'Basic Navigation Test',
      type: 'ui',
      steps: [
        {
          action: 'navigate',
          value: 'https://www.bestbuy.com'
        },
        {
          action: 'verify',
          selector: '.logo',
          expectedResult: 'Logo is visible'
        }
      ]
    };
  }

  getDefaultValue(inputType) {
    const defaults = {
      text: 'test input',
      email: 'test@example.com',
      password: 'TestPassword123',
      number: '123'
    };
    return defaults[inputType] || 'test';
  }

  getFallbackTestCases() {
    return [this.createNavigationTest()];
  }

  async processUserStoriesFile(filePath) {
    try {
      const userStories = await FileReader.readFile(filePath);
      const testCases = [];
      
      for (const story of userStories) {
        const testCase = await this.processUserStory(story);
        if (testCase) testCases.push(testCase);
      }
      
      return testCases;
    } catch (error) {
      console.error('Error processing user stories file:', error);
      return [];
    }
  }
}

module.exports = LocalNLPService; 