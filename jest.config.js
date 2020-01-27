tsConfig = require('./tsconfig.json').compilerOptions;
tsConfig.types.push('jest')

module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    globals: {
        'ts-jest': {
            tsConfig
        }
    }
};
