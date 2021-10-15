const fs = require('fs');

let rawdata = fs.readFileSync('/configuration/configuration.json');
let configuration = JSON.parse(rawdata);
console.log(configuration);


var singleton = require('./socket-listener.js');
const listener = singleton.getInstance();
listener.Listen(3000, configuration);

process.stdin.resume();//so the program will not close instantly

function exitHandler(options, exitCode) {
  if (options.cleanup) console.log('clean');
  if (exitCode || exitCode === 0) console.log(exitCode);
  if (options.exit) process.exit();
}

//do something when app is closing
process.on('exit', exitHandler.bind(null,{cleanup:true}));

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {exit:true}));

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, {exit:true}));
process.on('SIGUSR2', exitHandler.bind(null, {exit:true}));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {exit:true}));
