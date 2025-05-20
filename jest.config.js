/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig-lib.json',
      },
    ],
  },
  moduleNameMapper: {
    '^index$': '<rootDir>/index.ts',
  },
};

module.exports = config;