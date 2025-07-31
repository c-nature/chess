# Unit Tests for Chess Evaluation Display System

## Test Setup and Configuration

### Test Environment Setup

```javascript
// test-setup.js
// Mock DOM environment for testing
class MockDOM {
    static setup() {
        // Create mock DOM elements
        document.body.innerHTML = `
            <div class="blackBar" style="height: 50%"></div>
            <div class="evalNum">0.00</div>
            <div id="eval">0.00</div>
            <div id="evalText">Equal</div>
            <div id="eval1">0.00</div>
            <div id="line1">e2e4</div>
            <div id="eval2">0.00</div>
            <div id="line2">d2d4</div>
            <div id="eval3">0.00</div>
            <div id="line3">g1f3</div>
        `;
    }

    static cleanup() {
        document.body.innerHTML = '';
    }

    static createElement(tag, attributes = {}) {
        const element = document.createElement(tag);
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'textContent') {
                element.textContent = value;
            } else {
                element.setAttribute(key, value);
            }
        });
        return element;
    }
}

// Mock global variables that the chess app uses
global.isWhiteTurn = true;

// Test utilities
class TestUtils {
    static createValidEvaluationData() {
        return {
            lines: ['e2e4 e7e5', 'd2d4 d7d5', 'g1f3 g8f6'],
            evaluations: [0.25, 0.15, 0.10],
            scoreString: '25'
        };
    }

    static createMateEvaluationData() {
        return {
            lines: ['Qh5+ Ke8', 'Qf7#'],
            evaluations: ['#2', '#1'],
            scoreString: '32000'
        };
    }

    static createInvalidEvaluationData() {
        return {
            lines: null,
            evaluations: [],
            scoreString: undefined
        };
    }
}
```

### Jest Configuration

```javascript
// jest.config.js
module.exports = {
    testEnvironment: 'jsdom',
    setupFilesAfterEnv: ['<rootDir>/test-setup.js'],
    collectCoverageFrom: [
        'main.js',
        '!**/node_modules/**',
        '!**/vendor/**'
    ],
    coverageThreshold: {
        global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80
        }
    }
};
```

## Unit Tests

### 1. EvaluationValidator Tests

```javascript
// tests/evaluation-validator.test.js
describe('EvaluationValidator', () => {
    describe('validateInputs', () => {
        it('should validate correct inputs', () => {
            const result = EvaluationValidator.validateInputs(
                ['e2e4'], 
                [0.25], 
                '25'
            );
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject non-array lines', () => {
            const result = EvaluationValidator.validateInputs(
                'not-array', 
                [0.25], 
                '25'
            );
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Lines parameter must be an array');
        });

        it('should reject non-array evaluations', () => {
            const result = EvaluationValidator.validateInputs(
                ['e2e4'], 
                'not-array', 
                '25'
            );
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Evaluations parameter must be an array');
        });

        it('should reject empty evaluations array', () => {
            const result = EvaluationValidator.validateInputs(
                ['e2e4'], 
                [], 
                '25'
            );
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Evaluations array cannot be empty');
        });

        it('should accept undefined scoreString', () => {
            const result = EvaluationValidator.validateInputs(
                ['e2e4'], 
                [0.25], 
                undefined
            );
            expect(result.isValid).toBe(true);
        });
    });

    describe('sanitizeEvaluation', () => {
        it('should return 0 for null/undefined', () => {
            expect(EvaluationValidator.sanitizeEvaluation(null)).toBe(0);
            expect(EvaluationValidator.sanitizeEvaluation(undefined)).toBe(0);
        });

        it('should return valid numbers unchanged', () => {
            expect(EvaluationValidator.sanitizeEvaluation(1.5)).toBe(1.5);
            expect(EvaluationValidator.sanitizeEvaluation(-2.3)).toBe(-2.3);
        });

        it('should return 0 for NaN', () => {
            expect(EvaluationValidator.sanitizeEvaluation(NaN)).toBe(0);
        });

        it('should preserve mate notations', () => {
            expect(EvaluationValidator.sanitizeEvaluation('#5')).toBe('#5');
            expect(EvaluationValidator.sanitizeEvaluation('#-3')).toBe('#-3');
        });

        it('should parse valid numeric strings', () => {
            expect(EvaluationValidator.sanitizeEvaluation('1.5')).toBe(1.5);
            expect(EvaluationValidator.sanitizeEvaluation('-2.3')).toBe(-2.3);
        });

        it('should return 0 for invalid strings', () => {
            expect(EvaluationValidator.sanitizeEvaluation('invalid')).toBe(0);
            expect(EvaluationValidator.sanitizeEvaluation('')).toBe(0);
        });
    });

    describe('sanitizeScoreString', () => {
        it('should return trimmed string', () => {
            expect(EvaluationValidator.sanitizeScoreString('  25  ')).toBe('25');
        });

        it('should return "0" for non-strings', () => {
            expect(EvaluationValidator.sanitizeScoreString(null)).toBe('0');
            expect(EvaluationValidator.sanitizeScoreString(undefined)).toBe('0');
            expect(EvaluationValidator.sanitizeScoreString(123)).toBe('0');
        });

        it('should return "0" for empty strings', () => {
            expect(EvaluationValidator.sanitizeScoreString('')).toBe('0');
            expect(EvaluationValidator.sanitizeScoreString('   ')).toBe('0');
        });
    });
});
```

### 2. DOMElementCache Tests

```javascript
// tests/dom-element-cache.test.js
describe('DOMElementCache', () => {
    let cache;

    beforeEach(() => {
        MockDOM.setup();
        cache = new DOMElementCache();
    });

    afterEach(() => {
        MockDOM.cleanup();
    });

    describe('initialization', () => {
        it('should cache all required elements', () => {
            expect(cache.get('blackBar')).toBeTruthy();
            expect(cache.get('evalNum')).toBeTruthy();
            expect(cache.get('evalMain')).toBeTruthy();
            expect(cache.get('evalText')).toBeTruthy();
        });

        it('should cache evaluation line elements', () => {
            for (let i = 1; i <= 3; i++) {
                expect(cache.get(`eval${i}`)).toBeTruthy();
                expect(cache.get(`line${i}`)).toBeTruthy();
            }
        });
    });

    describe('isValid', () => {
        it('should return true for existing elements', () => {
            expect(cache.isValid('blackBar')).toBe(true);
            expect(cache.isValid('evalNum')).toBe(true);
        });

        it('should return false for non-existent elements', () => {
            expect(cache.isValid('nonExistent')).toBe(false);
        });

        it('should return false for removed elements', () => {
            const element = cache.get('blackBar');
            element.remove();
            expect(cache.isValid('blackBar')).toBe(false);
        });
    });

    describe('refresh', () => {
        it('should update cache after DOM changes', () => {
            // Remove an element
            cache.get('blackBar').remove();
            expect(cache.isValid('blackBar')).toBe(false);

            // Add it back
            const newElement = MockDOM.createElement('div', { class: 'blackBar' });
            document.body.appendChild(newElement);

            // Refresh cache
            cache.refresh();
            expect(cache.isValid('blackBar')).toBe(true);
        });
    });
});
```

### 3. EvaluationBar Tests

```javascript
// tests/evaluation-bar.test.js
describe('EvaluationBar', () => {
    let cache, evaluationBar;

    beforeEach(() => {
        MockDOM.setup();
        cache = new DOMElementCache();
        evaluationBar = new EvaluationBar(cache);
    });

    afterEach(() => {
        MockDOM.cleanup();
    });

    describe('numeric evaluation updates', () => {
        it('should update bar height and number for positive evaluation', () => {
            const result = evaluationBar.update(1.5, '150');
            
            expect(result).toBe(true);
            expect(cache.get('evalNum').textContent).toBe('1.50');
            
            const blackBar = cache.get('blackBar');
            const height = parseFloat(blackBar.style.height);
            expect(height).toBeLessThan(50); // Positive eval should reduce black bar
        });

        it('should update bar height and number for negative evaluation', () => {
            const result = evaluationBar.update(-1.5, '-150');
            
            expect(result).toBe(true);
            expect(cache.get('evalNum').textContent).toBe('-1.50');
            
            const blackBar = cache.get('blackBar');
            const height = parseFloat(blackBar.style.height);
            expect(height).toBeGreaterThan(50); // Negative eval should increase black bar
        });

        it('should clamp extreme evaluations', () => {
            const result = evaluationBar.update(100, '10000');
            
            expect(result).toBe(true);
            expect(cache.get('evalNum').textContent).toBe('15.00'); // Clamped to max
        });

        it('should handle zero evaluation', () => {
            const result = evaluationBar.update(0, '0');
            
            expect(result).toBe(true);
            expect(cache.get('evalNum').textContent).toBe('0.00');
            expect(cache.get('blackBar').style.height).toBe('50%');
        });
    });

    describe('mate evaluation updates', () => {
        beforeEach(() => {
            global.isWhiteTurn = true;
        });

        it('should handle white mate in X', () => {
            const result = evaluationBar.update('#3', '32000');
            
            expect(result).toBe(true);
            expect(cache.get('evalNum').textContent).toBe('#3');
            expect(cache.get('blackBar').style.height).toBe('0%'); // White winning
        });

        it('should handle black mate in X', () => {
            const result = evaluationBar.update('#3', '-32000');
            
            expect(result).toBe(true);
            expect(cache.get('evalNum').textContent).toBe('#3');
            expect(cache.get('blackBar').style.height).toBe('100%'); // Black winning
        });
    });

    describe('error handling', () => {
        it('should return false when DOM elements are missing', () => {
            cache.get('blackBar').remove();
            
            const result = evaluationBar.update(1.5, '150');
            expect(result).toBe(false);
        });

        it('should handle invalid evaluation gracefully', () => {
            const result = evaluationBar.update(null, '0');
            expect(result).toBe(true); // Should still work with sanitized value
        });
    });
});
```

### 4. EvaluationLines Tests

```javascript
// tests/evaluation-lines.test.js
describe('EvaluationLines', () => {
    let cache, evaluationLines;

    beforeEach(() => {
        MockDOM.setup();
        cache = new DOMElementCache();
        evaluationLines = new EvaluationLines(cache);
    });

    afterEach(() => {
        MockDOM.cleanup();
    });

    describe('line updates', () => {
        it('should update all lines with valid data', () => {
            const lines = ['e2e4 e7e5', 'd2d4 d7d5', 'g1f3 g8f6'];
            const evaluations = [0.25, 0.15, 0.10];
            
            const result = evaluationLines.update(lines, evaluations);
            
            expect(result).toBe(3); // All 3 lines updated
            expect(cache.get('eval1').textContent).toBe('0.25');
            expect(cache.get('line1').textContent).toBe('e2e4 e7e5');
            expect(cache.get('eval2').textContent).toBe('0.15');
            expect(cache.get('line2').textContent).toBe('d2d4 d7d5');
        });

        it('should handle fewer lines than available slots', () => {
            const lines = ['e2e4 e7e5'];
            const evaluations = [0.25];
            
            const result = evaluationLines.update(lines, evaluations);
            
            expect(result).toBe(1);
            expect(cache.get('eval1').textContent).toBe('0.25');
            expect(cache.get('line1').textContent).toBe('e2e4 e7e5');
            expect(cache.get('eval2').textContent).toBe(''); // Empty
            expect(cache.get('line2').textContent).toBe(''); // Empty
        });

        it('should trim whitespace from lines', () => {
            const lines = ['  e2e4 e7e5  '];
            const evaluations = [0.25];
            
            evaluationLines.update(lines, evaluations);
            
            expect(cache.get('line1').textContent).toBe('e2e4 e7e5');
        });

        it('should handle mate evaluations in lines', () => {
            const lines = ['Qh5+ Ke8'];
            const evaluations = ['#2'];
            
            const result = evaluationLines.update(lines, evaluations);
            
            expect(result).toBe(1);
            expect(cache.get('eval1').textContent).toBe('#2');
        });
    });

    describe('error handling', () => {
        it('should continue updating other lines when one fails', () => {
            // Remove one element
            cache.get('eval2').remove();
            
            const lines = ['e2e4 e7e5', 'd2d4 d7d5', 'g1f3 g8f6'];
            const evaluations = [0.25, 0.15, 0.10];
            
            const result = evaluationLines.update(lines, evaluations);
            
            expect(result).toBe(2); // 2 out of 3 updated
            expect(cache.get('eval1').textContent).toBe('0.25');
            expect(cache.get('eval3').textContent).toBe('0.10');
        });

        it('should handle null/undefined lines gracefully', () => {
            const result = evaluationLines.update(null, [0.25]);
            expect(result).toBe(0);
        });
    });
});
```

### 5. EvaluationText Tests

```javascript
// tests/evaluation-text.test.js
describe('EvaluationText', () => {
    let cache, evaluationText;

    beforeEach(() => {
        MockDOM.setup();
        cache = new DOMElementCache();
        evaluationText = new EvaluationText(cache);
        global.isWhiteTurn = true;
    });

    afterEach(() => {
        MockDOM.cleanup();
    });

    describe('numeric evaluation text', () => {
        const testCases = [
            { eval: 0.2, expected: 'Equal' },
            { eval: 0.7, expected: 'White is slightly better' },
            { eval: -0.7, expected: 'Black is slightly better' },
            { eval: 1.5, expected: 'White is significantly better' },
            { eval: -1.5, expected: 'Black is significantly better' },
            { eval: 3.0, expected: 'White is winning!' },
            { eval: -3.0, expected: 'Black is winning!' }
        ];

        testCases.forEach(({ eval: evaluation, expected }) => {
            it(`should display "${expected}" for evaluation ${evaluation}`, () => {
                const result = evaluationText.update(evaluation, '0');
                
                expect(result).toBe(true);
                expect(cache.get('evalMain').textContent).toBe(evaluation.toString());
                expect(cache.get('evalText').textContent).toBe(expected);
            });
        });
    });

    describe('mate evaluation text', () => {
        it('should display white mate correctly', () => {
            const result = evaluationText.update('#3', '32000');
            
            expect(result).toBe(true);
            expect(cache.get('evalMain').textContent).toBe('#3');
            expect(cache.get('evalText').textContent).toBe('White can mate in 3 moves');
        });

        it('should display black mate correctly', () => {
            const result = evaluationText.update('#2', '-32000');
            
            expect(result).toBe(true);
            expect(cache.get('evalMain').textContent).toBe('#2');
            expect(cache.get('evalText').textContent).toBe('Black can mate in 2 moves');
        });

        it('should handle mate with turn consideration', () => {
            global.isWhiteTurn = false;
            
            const result = evaluationText.update('#1', '32000');
            
            expect(result).toBe(true);
            expect(cache.get('evalText').textContent).toBe('Black can mate in 1 moves');
        });
    });

    describe('error handling', () => {
        it('should return false when DOM elements are missing', () => {
            cache.get('evalMain').remove();
            
            const result = evaluationText.update(1.5, '150');
            expect(result).toBe(false);
        });

        it('should handle unknown evaluation types', () => {
            const result = evaluationText.update({}, '0');
            
            expect(result).toBe(true);
            expect(cache.get('evalText').textContent).toBe('Unknown');
        });
    });
});
```

### 6. EvaluationDisplayController Tests

```javascript
// tests/evaluation-display-controller.test.js
describe('EvaluationDisplayController', () => {
    let controller;

    beforeEach(() => {
        MockDOM.setup();
        controller = new EvaluationDisplayController();
    });

    afterEach(() => {
        controller.destroy();
        MockDOM.cleanup();
    });

    describe('initialization', () => {
        it('should initialize all components', () => {
            expect(controller.domCache).toBeDefined();
            expect(controller.evaluationBar).toBeDefined();
            expect(controller.evaluationLines).toBeDefined();
            expect(controller.evaluationText).toBeDefined();
        });
    });

    describe('display method', () => {
        it('should successfully display valid evaluation data', () => {
            const { lines, evaluations, scoreString } = TestUtils.createValidEvaluationData();
            
            const result = controller.display(lines, evaluations, scoreString);
            
            expect(result).toBe(true);
        });

        it('should reject invalid input data', () => {
            const { lines, evaluations, scoreString } = TestUtils.createInvalidEvaluationData();
            
            const result = controller.display(lines, evaluations, scoreString);
            
            expect(result).toBe(false);
        });

        it('should handle mate evaluation data', () => {
            const { lines, evaluations, scoreString } = TestUtils.createMateEvaluationData();
            
            const result = controller.display(lines, evaluations, scoreString);
            
            expect(result).toBe(true);
        });
    });

    describe('throttling', () => {
        it('should throttle rapid updates', (done) => {
            const { lines, evaluations, scoreString } = TestUtils.createValidEvaluationData();
            
            // First update should succeed
            const result1 = controller.display(lines, evaluations, scoreString);
            expect(result1).toBe(true);
            
            // Immediate second update should be throttled
            const result2 = controller.display(lines, evaluations, scoreString);
            expect(result2).toBe(false);
            
            // After throttle period, update should succeed
            setTimeout(() => {
                const result3 = controller.display(lines, evaluations, scoreString);
                expect(result3).toBe(true);
                done();
            }, 150); // Wait longer than throttle period
        });
    });

    describe('DOM cache refresh', () => {
        it('should refresh DOM cache when requested', () => {
            const spy = jest.spyOn(controller.domCache, 'refresh');
            
            controller.refreshDOMCache();
            
            expect(spy).toHaveBeenCalled();
        });
    });

    describe('cleanup', () => {
        it('should properly cleanup resources', () => {
            controller.destroy();
            
            expect(controller.evaluationBar).toBeNull();
            expect(controller.evaluationLines).toBeNull();
            expect(controller.evaluationText).toBeNull();
        });
    });
});
```

### 7. Integration Tests

```javascript
// tests/integration.test.js
describe('Evaluation Display Integration', () => {
    beforeEach(() => {
        MockDOM.setup();
        global.isWhiteTurn = true;
    });

    afterEach(() => {
        MockDOM.cleanup();
        if (global.evaluationDisplayController) {
            global.evaluationDisplayController.destroy();
            global.evaluationDisplayController = null;
        }
    });

    describe('displayEvaluation function', () => {
        it('should initialize controller on first call', () => {
            expect(global.evaluationDisplayController).toBeFalsy();
            
            displayEvaluation(['e2e4'], [0.25], '25');
            
            expect(global.evaluationDisplayController).toBeTruthy();
        });

        it('should handle complete evaluation workflow', () => {
            const lines = ['e2e4 e7e5', 'd2d4 d7d5', 'g1f3 g8f6'];
            const evaluations = [0.25, 0.15, 0.10];
            const scoreString = '25';
            
            const result = displayEvaluation(lines, evaluations, scoreString);
            
            expect(result).toBe(true);
            
            // Verify DOM updates
            expect(document.querySelector('.evalNum').textContent).toBe('0.25');
            expect(document.getElementById('eval1').textContent).toBe('0.25');
            expect(document.getElementById('line1').textContent).toBe('e2e4 e7e5');
            expect(document.getElementById('evalText').textContent).toBe('Equal');
        });

        it('should handle errors gracefully', () => {
            // Remove required DOM element
            document.querySelector('.blackBar').remove();
            
            const result = displayEvaluation(['e2e4'], [0.25], '25');
            
            // Should not crash, but may return false due to missing elements
            expect(typeof result).toBe('boolean');
        });
    });

    describe('cleanup integration', () => {
        it('should cleanup on window beforeunload', () => {
            // Initialize controller
            displayEvaluation(['e2e4'], [0.25], '25');
            expect(global.evaluationDisplayController).toBeTruthy();
            
            // Simulate page unload
            window.dispatchEvent(new Event('beforeunload'));
            
            expect(global.evaluationDisplayController).toBeNull();
        });
    });
});
```

## Test Coverage Goals

### Coverage Targets
- **Lines**: 90%+
- **Functions**: 95%+
- **Branches**: 85%+
- **Statements**: 90%+

### Running Tests

```bash
# Install dependencies
npm install --save-dev jest jsdom

# Run tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test -- evaluation-validator.test.js
```

### Continuous Integration

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '16'
      - run: npm install
      - run: npm test -- --coverage
      - uses: codecov/codecov-action@v1
```

## Test Maintenance

### Adding New Tests
1. Follow the existing naming convention
2. Use descriptive test names
3. Include both positive and negative test cases
4. Test error conditions and edge cases
5. Update coverage thresholds if needed

### Debugging Failed Tests
1. Use `console.log` in tests for debugging
2. Check DOM state with `document.body.innerHTML`
3. Verify mock data matches expected format
4. Use Jest's `--verbose` flag for detailed output

This comprehensive test suite ensures the improved evaluation display system is robust, reliable, and maintainable.