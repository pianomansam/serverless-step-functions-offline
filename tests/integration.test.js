/* eslint-disable no-console */
// eslint-disable-next-line prefer-destructuring
const spawnSync = require('child_process').spawnSync;
const path = require('path');
const expect = require('chai').expect;
// const should = require('chai').should;

const integrationPath = path.resolve('./tests');

describe('test local invoke', () => {
  before(async () => {
    await spawnSync('yarn', [], {
      cwd: integrationPath,
      timeout: 30000,
    });
  });

  it('sls step-functions-offline has no errors', async () => {
    console.log('Running sls step-functions-offline');

    const result = spawnSync(
      'yarn',
      ['sls', 'step-functions-offline', '--stateMachine', 'foo'],
      {
        cwd: integrationPath,
        timeout: 6000,
      },
    );

    console.log(result.stdout.toString());
    console.log(result.stderr.toString());

    expect(result.status).to.equal(0);
  });
});