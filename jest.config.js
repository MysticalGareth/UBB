module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
  moduleFileExtensions: ['ts', 'js', 'json'],
  // Run regtest tests serially to avoid chain state conflicts
  maxConcurrency: 1,
  maxWorkers: 1,
  // Silent mode unless TEST_VERBOSE=true
  silent: process.env.TEST_VERBOSE !== 'true',
};
