exports.handler = async (event, context, callback) => {
  console.log('Second async lambda event', event);
  event.history.push('secondAsyncLambda');
  await timeout(100);
  callback(event);
};

const timeout = ms => new Promise(res => setTimeout(res, ms));