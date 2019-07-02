const path = require('path');
const jp = require('jsonpath');
const _ = require('lodash');

const enumList = require('./enum');

let args;

const log = (arg1, arg2) => {
  if (typeof arg1 === 'string') {
    args.log(arg1, arg2);
  } else {
    console.log(arg2, arg1);
  }
};

const processInputPath = ({ step, input }) => {
  return step.InputPath ? jp.value(input, step.InputPath) : input;
};

const processOutputPath = ({ step, output }) => {
  return step.OutputPath ? jp.value(output, step.OutputPath) : output;
};

const processResultPath = ({ step, result, input }) => {
  if (!step.ResultPath) {
    return result;
  }

  const resultPath = step.ResultPath.split('$.')[1];
  // eslint-disable-next-line no-param-reassign
  input[resultPath] = result;
  return input;
};

const outputStep = ({ step, result, input }) => {
  return processOutputPath({
    step,
    output: processResultPath({ step, result, input }),
  });
};

const findFunctionPathAndHandler = functionHandler => {
  const dir = path.dirname(functionHandler);
  const handler = path.basename(functionHandler);
  const splitHandler = handler.split('.');
  const filePath = `${dir}/${splitHandler[0]}.js`;
  const handlerName = `${splitHandler[1]}`;

  return { handler: handlerName, filePath };
};

const executeTask = async ({ stepName, input }) => {
  const { handler, filePath } = findFunctionPathAndHandler(
    args.functions[args.variables[stepName]].handler,
  );

  // eslint-disable-next-line import/no-dynamic-require
  const func = require(path.join(process.cwd(), filePath))[handler];

  // eslint-disable-next-line no-unused-vars
  return new Promise(async (resolve, reject) => {
    const cb = (err, result) => {
      if (err) {
        throw new Error(
          `Error in function "${stepName}": ${JSON.stringify(err)}`,
        );
      }
      resolve(result);
    };

    const context = {
      cb,
      done: cb,
      succeed: result => cb(null, result),
      fail: err => cb(err),
    };

    const funcResult = await func(input, context);

    if (funcResult) {
      resolve(funcResult);
    }
  });
};

const executeStep = async ({ stepName, step, event, branch }) => {
  let result;
  log(`~~~~~~~~~~~~~~~~~~~~~ Start step: ${stepName} ~~~~~~~~~~~~~~~~~~~~~`);
  const input = processInputPath({ step, input: event });
  log(input, 'input');

  switch (step.Type) {
    case 'Succeed':
    case 'Pass':
      log('Pass Type');
      result = input;
      break;

    case 'Task':
      log('Task Type');
      result = await executeTask({ stepName, step, input });
      break;

    case 'Parallel':
      log('Parallel Type');
      result = await Promise.all(
        step.Branches.map(b => {
          const firstStepName = b.StartAt;
          const firstStep = b.States[firstStepName];

          return executeStep({
            stepName: firstStepName,
            step: firstStep,
            event: input,
            branch: b,
          });
        }),
      );
      break;

    case 'Choice':
      log('Choice Type');

      // eslint-disable-next-line no-case-declarations
      const choices = step.Choices.filter(choice => {
        const condition = _.pick(choice, enumList.supportedComparisonOperator);
        if (!condition) {
          throw new Error(`Unsupported operator!`);
        }

        const operator = Object.keys(condition)[0];
        const checkFunction = enumList.convertOperator[operator];
        const compareWithValue = condition[operator];

        return checkFunction(
          jp.value(input, choice.Variable),
          compareWithValue,
        );
      });

      log(choices, 'choices');

      // eslint-disable-next-line no-param-reassign
      step.Next = choices.length ? choices[0].Next : step.Default;
      log(`Going to ${step.Next}`);

      result = input;
      break;

    default:
      throw new Error(`Unsupported type: ${step.Type}`);
  }

  log(result, 'result');

  let output = outputStep({ step, result, input });

  log(output, 'output');

  log(`~~~~~~~~~~~~~~~~~~~~~ Finish step: ${stepName} ~~~~~~~~~~~~~~~~~~~~~`);

  if (step.Next) {
    output = executeStep({
      stepName: step.Next,
      step: branch.States[step.Next],
      event: output,
      branch,
    });
  }

  return output;
};

const run = async runArgs => {
  args = runArgs;
  const { event, stateDefinition } = runArgs;
  const firstStepName = stateDefinition.StartAt;
  const firstStep = stateDefinition.States[firstStepName];

  const result = await executeStep({
    stepName: firstStepName,
    step: firstStep,
    branch: stateDefinition,
    event,
  });

  console.log(result);
};

module.exports = {
  run,
};
