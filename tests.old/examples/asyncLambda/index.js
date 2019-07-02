exports.handler = async event => {
    console.log('Async lambda event', event);
    event.history = event.history || [];
    event.history.push('asyncLambda');
    await timeout(100);
    return event;
};

const timeout = ms => new Promise(res => setTimeout(res, ms));