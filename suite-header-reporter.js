// suite-header-reporter.js
const chalk = require('chalk');

class SuiteHeaderReporter {
  suites = new Map();

  onTestCaseResult(_, testCase) {
    const [suite, sub] = testCase.ancestorTitles;
    const passed = testCase.status === 'passed';

    if (!this.suites.has(suite)) {
      this.suites.set(suite, { total: 0, passed: 0, subs: new Map() });
    }
    const suiteData = this.suites.get(suite);
    suiteData.total += 1;
    if (passed) suiteData.passed += 1;

    if (sub) {
      if (!suiteData.subs.has(sub)) {
        suiteData.subs.set(sub, { total: 0, passed: 0 });
      }
      const subData = suiteData.subs.get(sub);
      subData.total += 1;
      if (passed) subData.passed += 1;
    }
  }

  onRunComplete() {
    for (const [suiteName, suiteData] of this.suites) {
      const suiteTick =
        suiteData.passed === suiteData.total
          ? chalk.green('✓')
          : chalk.red('✗');
      console.log(
        `${suiteTick} ${suiteName} (${suiteData.passed}/${suiteData.total})`
      );

      for (const [subName, subData] of suiteData.subs) {
        const subTick =
          subData.passed === subData.total
            ? chalk.green('✓')
            : chalk.red('✗');
        console.log(
          `   ${subTick} ${subName} (${subData.passed}/${subData.total})`
        );
      }
      console.log(); // blank line between top-level suites
    }
  }
}

module.exports = SuiteHeaderReporter;
