var ArgumentParser = require('argparse').ArgumentParser;

var argsParser = new ArgumentParser({
  version: '1.0.0',
  addHelp:true,
  description: 'Mqtt echo node js script'
});

argsParser.addArgument(
  [ '-c', '--config' ],
  {
    help: 'Configuration file containing the mqtt broker details'
  }
);

// usage:
// var args = argsParser.parseArgs();

exports.parser = argsParser;