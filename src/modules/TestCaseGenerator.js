const puppeteer = require('puppeteer');
const FileReader = require('../services/FileReader');
const { NlpManager } = require('node-nlp');

class TestCaseGenerator {
  constructor() {
    this.nlpManager = new NlpManager({ languages: ['en'] });
    this.initialized = false;
    this.isRecording = false;
    this.browser = null;
    this.page = null;
    this.interactions = [];
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

  async startRecording(url, options = {}) {
    try {
      console.log('Starting recording session:', url);
      const { username, password } = options;

      this.browser = await puppeteer.launch({
        headless: false,
        defaultViewport: { width: 1366, height: 768 },
        args: ['--start-maximized', '--no-sandbox'],
        ignoreHTTPSErrors: true
      });

      this.page = await this.browser.newPage();
      this.interactions = [];
      this.isRecording = true;

      // Enable necessary permissions
      const context = this.browser.defaultBrowserContext();
      await context.overridePermissions(url, ['geolocation', 'notifications']);

      // Enable interaction tracking
      await this.page.setRequestInterception(true);
      await this.setupPageListeners();

      // Navigate to URL
      await this.page.goto(url, { waitUntil: 'networkidle0' });

      if (username && password) {
        await this.handleLogin(username, password);
      }

      // Add recording indicator
      await this.addRecordingIndicator();

      // Handle browser close
      this.browser.on('disconnected', () => {
        if (this.isRecording) {
          const testCases = this.generateTestCasesFromInteractions(this.interactions, url);
          if (options.onComplete) {
            options.onComplete(testCases);
          }
          this.isRecording = false;
        }
      });

      return true;
    } catch (error) {
      console.error('Error starting recording:', error);
      throw error;
    }
  }

  async setupPageListeners() {
    // Handle navigation events
    this.page.on('framenavigated', frame => {
      if (frame === this.page.mainFrame()) {
        this.interactions.push({
          type: 'navigation',
          url: frame.url(),
          timestamp: Date.now()
        });
      }
    });

    // Handle network requests
    this.page.on('request', request => {
      request.continue();
      if (request.resourceType() === 'xhr' || request.resourceType() === 'fetch') {
        this.interactions.push({
          type: 'api',
          method: request.method(),
          url: request.url(),
          timestamp: Date.now()
        });
      }
    });

    // Inject client-side listeners
    await this.page.evaluateOnNewDocument(() => {
      window.addEventListener('click', event => {
        const target = event.target;
        window.postMessage({
          type: 'RECORD_INTERACTION',
          interaction: {
            type: 'click',
            element: {
              tag: target.tagName,
              id: target.id,
              class: target.className,
              text: target.textContent?.trim(),
              href: target.href
            },
            timestamp: Date.now()
          }
        }, '*');
      }, true);

      window.addEventListener('submit', event => {
        const form = event.target;
        window.postMessage({
          type: 'RECORD_INTERACTION',
          interaction: {
            type: 'form_submit',
            formId: form.id,
            formAction: form.action,
            timestamp: Date.now()
          }
        }, '*');
      }, true);
    });

    // Listen for client-side messages
    this.page.on('console', msg => {
      if (msg.type() === 'log' && msg.text().includes('RECORD_INTERACTION')) {
        try {
          const data = JSON.parse(msg.text());
          this.interactions.push(data.interaction);
        } catch (e) {
          // Ignore parsing errors
        }
      }
    });
  }

  async addRecordingIndicator() {
    await this.page.evaluate(() => {
      const indicator = document.createElement('div');
      indicator.id = 'recording-indicator';
      indicator.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: red;
        color: white;
        padding: 10px;
        border-radius: 5px;
        z-index: 999999;
        font-family: Arial;
        font-size: 14px;
      `;
      indicator.textContent = '🔴 Recording...';
      document.body.appendChild(indicator);
    });
  }

  async stopRecording() {
    if (!this.isRecording) return null;

    this.isRecording = false;
    const testCases = this.generateTestCasesFromInteractions(this.interactions, this.page.url());
    
    if (this.browser) {
      await this.browser.close();
    }
    
    this.browser = null;
    this.page = null;
    
    return testCases;
  }

  async handleLogin(username, password) {
    try {
      // Common login selectors
      const selectors = [
        { user: '#username', pass: '#password' },
        { user: '#email', pass: '#password' },
        { user: 'input[type="email"]', pass: 'input[type="password"]' },
        { user: 'input[name="username"]', pass: 'input[name="password"]' }
      ];

      for (const selector of selectors) {
        try {
          await this.page.waitForSelector(selector.user, { timeout: 5000 });
          await this.page.type(selector.user, username);
          await this.page.type(selector.pass, password);
          
          // Find and click submit button
          const submitButton = await this.page.$('button[type="submit"], input[type="submit"]');
          if (submitButton) {
            await submitButton.click();
            await this.page.waitForNavigation({ waitUntil: 'networkidle0' });
          }
          
          console.log('Login successful');
          break;
        } catch (e) {
          continue;
        }
      }
    } catch (error) {
      console.warn('Login attempt failed:', error.message);
    }
  }

  generateTestCasesFromInteractions(interactions, baseUrl) {
    const testCases = [];
    let currentTestCase = null;

    interactions.forEach((interaction, index) => {
      if (!currentTestCase || this.shouldStartNewTestCase(interaction, interactions[index - 1])) {
        if (currentTestCase) {
          testCases.push(currentTestCase);
        }
        currentTestCase = {
          id: `TC${Date.now()}_${testCases.length}`,
          name: `Test Case: ${interaction.type} ${interaction.text || ''}`,
          type: this.getTestTypeFromInteraction(interaction),
          steps: []
        };
      }

      currentTestCase.steps.push(this.createTestStep(interaction, baseUrl));
    });

    if (currentTestCase) {
      testCases.push(currentTestCase);
    }

    return testCases;
  }

  shouldStartNewTestCase(current, previous) {
    if (!previous) return true;
    return current.type !== previous.type || 
           (current.timestamp - previous.timestamp) > 5000; // 5 second gap
  }

  getTestTypeFromInteraction(interaction) {
    switch (interaction.type) {
      case 'form':
        return 'integration';
      case 'click':
        return 'ui';
      default:
        return 'functional';
    }
  }

  createTestStep(interaction, baseUrl) {
    const step = {
      id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      action: interaction.type,
      selector: interaction.selector
    };

    switch (interaction.type) {
      case 'click':
        step.description = `Click on element "${interaction.text || interaction.selector}"`;
        break;
      case 'form':
        step.description = `Submit form with data: ${JSON.stringify(interaction.inputs)}`;
        break;
      default:
        step.description = `Perform ${interaction.type} action`;
    }

    return step;
  }
}

module.exports = TestCaseGenerator;

