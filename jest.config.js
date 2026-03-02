/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
  preset: 'ts-jest/presets/js-with-babel',
  testEnvironment: 'jsdom',
  testMatch: ['**/__tests__/**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // transform: {
  //   "^.+\\.tsx?$": ["ts-jest", {}],
  // },
  transformIgnorePatterns: [
    // '/node_modules/(?!(bpmn-js|dmn-js|diagram-js|min-dash|min-dom|inherits-browser|tiny-svg|didi)/)',
    // '/node_modules/(?!(bpmn-js|dmn-js|diagram-js|min-dash|min-dom|tiny-svg|inherits-browser|didi|path-intersection)/)',
  ],
  

  // moduleNameMapper: {
  //   '^path-intersection$':
  //     '<rootDir>/node_modules/path-intersection/intersect.js',
  //   '^@bpmn-io/diagram-js-ui$':
  //     '<rootDir>/node_modules/@bpmn-io/diagram-js-ui/lib/index.js',


  // },

  reporters: [
    '<rootDir>/suite-header-reporter.js', // our custom one
    'summary'                             // one-line totals at the end
  ],
  silent: true,  
};