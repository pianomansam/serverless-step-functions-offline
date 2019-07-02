const path = require('path');
const _ = require('lodash');
const parse = require('./parse');
// const build = require('./build');
const workflow = require('./workflow');

class StepFunctionsOfflinePlugin {
  constructor(serverless, options) {
    this.location = process.cwd();
    this.serverless = serverless;
    this.options = options;
    this.stateMachine = this.options.stateMachine;
    this.detailedLog = this.options.detailedLog || this.options.l;
    this.eventFile = this.options.event || this.options.e;
    this.data = this.options.data || this.options.d;
    this.functions = this.serverless.service.functions;
    this.variables = this.serverless.service.custom.stepFunctionsOffline;
    this.cliLog = this.serverless.cli.log.bind(this.serverless.cli);
    Object.assign(
      this,
      parse,
      // build
    );
    this.commands = {
      'step-functions-offline': {
        usage: 'Will run your step function locally',
        lifecycleEvents: [
          'checkVariableInYML',
          'start',
          'isInstalledPluginSLSStepFunctions',
          'findFunctionsPathAndHandler',
          'findState',
          'loadEventFile',
          'loadData',
          'loadEnvVariables',
          'runStepWorkflow',
        ],
        options: {
          stateMachine: {
            usage: 'The stage used to execute.',
            required: true,
          },
          event: {
            usage: 'File where is values for execution in JSON format',
            shortcut: 'e',
          },
          detailedLog: {
            usage: 'Option which enables detailed logs',
            shortcut: 'l',
          },
        },
      },
    };

    this.hooks = {
      'step-functions-offline:start': this.start.bind(this),
      'step-functions-offline:isInstalledPluginSLSStepFunctions': this.isInstalledPluginSLSStepFunctions.bind(
        this,
      ),
      'step-functions-offline:findState': this.findState.bind(this),
      'step-functions-offline:loadEventFile': this.loadEventFile.bind(this),
      'step-functions-offline:loadData': this.loadData.bind(this),
      'step-functions-offline:loadEnvVariables': this.loadEnvVariables.bind(
        this,
      ),
      'step-functions-offline:runStepWorkflow': this.runStepWorkflow.bind(this),
    };
  }

  // Entry point for the plugin (sls step offline)
  start() {
    this.cliLog('Preparing....');

    this.sfoGetLocation();
    this.sfoCheckVersion();
    this.sfoCheckVariableInYML();
  }

  sfoGetLocation() {
    if (this.options.location) {
      this.location = path.join(process.cwd(), this.options.location);
    }
    if (this.variables && this.variables.location) {
      this.location = path.join(process.cwd(), this.variables.location);
    }
  }

  sfoCheckVersion() {
    const { version } = this.serverless;
    if (!version.startsWith('1.')) {
      throw new this.serverless.classes.Error(
        `Serverless step offline requires Serverless v1.x.x but found ${version}`,
      );
    }
  }

  sfoCheckVariableInYML() {
    if (!_.has(this.serverless.service, 'custom.stepFunctionsOffline')) {
      throw new this.serverless.classes.Error(
        'Please add ENV_VARIABLES to section "custom"',
      );
    }
  }

  isInstalledPluginSLSStepFunctions() {
    const { plugins } = this.serverless.service;
    if (plugins.indexOf('serverless-step-functions') < 0) {
      const error =
        'Error: Please install plugin "serverless-step-functions". Package does not work without it';
      throw new this.serverless.classes.Error(error);
    }
  }

  loadEventFile() {
    if (!this.eventFile) {
      this.eventFile = {};
    } else {
      try {
        this.eventFile = path.isAbsolute(this.eventFile)
          ? // eslint-disable-next-line import/no-dynamic-require
            require(this.eventFile)
          : // eslint-disable-next-line import/no-dynamic-require
            require(path.join(process.cwd(), this.eventFile));
      } catch (err) {
        throw err;
      }
    }
    return this.eventFile;
  }

  loadData() {
    if (!this.data) {
      this.data = {};
    } else {
      try {
        this.data = JSON.parse(this.data);
      } catch (err) {
        throw err;
      }
    }
    return this.data;
  }

  loadEnvVariables() {
    this.environment = this.serverless.service.provider.environment;
    process.env.STEP_IS_OFFLINE = true;
    process.env = _.extend(process.env, this.environment);
    this.environmentVariables = Object.assign({}, process.env); // store global env variables;
  }

  findState() {
    this.cliLog(
      `Trying to find state "${this.stateMachine}" in serverless manifest`,
    );
    return this.parseConfig()
      .then(() => {
        this.stateDefinition = this.getStateMachine(
          this.stateMachine,
        ).definition;
      })
      .catch(err => {
        throw new this.serverless.classes.Error(err);
      });
  }

  async runStepWorkflow() {
    const event = Object.keys(this.eventFile).length
      ? this.eventFile
      : this.data;

    const {
      functions,
      stateDefinition,
      variables,
      serverless,
      cliLog: log,
    } = this;

    await workflow.run({
      event,
      functions,
      stateDefinition,
      variables,
      log,
      serverless,
    });
  }
}

module.exports = StepFunctionsOfflinePlugin;
