var path = require('path');
var winston = require('winston');
var fs = require('fs');
var tests = require('./tests.js');
var hfc = require('fabric-client');
hfc.addConfigFile(path.join(__dirname, './ServiceCredentials.json'));
var config = hfc.getConfigSetting();
var utils = require('fabric-client/lib/utils.js');


var argv = require('yargs')
    .command('installcc', 'Install Example 2 Chaincode', function(yargs){
        yargs.options({
            chaincodeId: {
                demand: true,
                alias: 'i',
                description: 'Chaincode name',
                type: 'string'
            },
            chaincodeVersion: {
                demand: true,
                alias: 'v',
                description: 'Chaincode version',
                type: 'string'
            },
            peerId: {
                demand: true,
                alias: 'p',
                description: 'Peer ID to install chaincode',
                type: 'string'
            },
            ordererId: {
                demand: true,
                alias: 'o',
                description: 'Orderer ID to use to install chaincode',
                type: 'string'
            }
        }).help('help');
    })
    .command('installcc2', 'Install Example 2 Chaincode from upgrade path', function(yargs){
        yargs.options({
            chaincodeId: {
                demand: true,
                alias: 'i',
                description: 'Chaincode name',
                type: 'string'
            },
            chaincodeVersion: {
                demand: true,
                alias: 'v',
                description: 'Chaincode version',
                type: 'string'
            },
            peerId: {
                demand: true,
                alias: 'p',
                description: '2 character peer ID to install chaincode (ex. 1a)',
                type: 'string'
            }
        }).help('help');
    })
   /* .command('installmarbles', 'Install Marbles Chaincode', function(yargs){
        yargs.options({
            chaincodeId: {
                demand: true,
                alias: 'i',
                description: 'Chaincode name',
                type: 'string'
            },
            chaincodeVersion: {
                demand: true,
                alias: 'v',
                description: 'Chaincode version',
                type: 'string'
            },
            peerId: {
                demand: true,
                alias: 'p',
                description: 'Peer ID to install chaincode',
                type: 'string'
            },
            ordererId: {
                demand: true,
                alias: 'o',
                description: 'Orderer ID to install chaincode',
                type: 'string'
            }
        }).help('help');
    })*/
    .command('instantiatecc', 'Instantiate Example 2 Chaincode', function(yargs){
        yargs.options({
            channel: {
                demand: true,
                alias: 'c',
                description: 'Name of the channel to perform this instantiation',
                type: 'string'
            },
            chaincodeId: {
                demand: true,
                alias: 'i',
                description: 'Chaincode name',
                type: 'string'
            },
            chaincodeVersion: {
                demand: true,
                alias: 'v',
                description: 'Chaincode version',
                type: 'string'
            },
            aVal: {
                demand: false,
                alias: 'a',
                description: 'Value of \'A\' in instantiation request (Default is 200 if not specified)',
                type: 'string'
            },
            bVal: {
                demand: false,
                alias: 'b',
                description: 'Value of \'B\' in instantiation request (Default is 200 if not specified)',
                type: 'string'
            },
            peerId: {
                demand: true,
                alias: 'p',
                description: 'Peer ID to instantiate chaincode',
                type: 'string'
            },
            ordererId: {
                demand: true,
                alias: 'o',
                description: 'Orderer ID to use to instantiate chaincode',
                type: 'string'
            },
            endorsers: {
                demand: false,
                alias: 'e',
                description: 'Peer IDs (separated by commas) of peers to be used as endorsers (Example: peer1,peer2,peer3)',
                type: 'string'
            }
        }).help('help');
    })
  /*  .command('instantiatemarbles', 'Instantiate Marbles Chaincode', function(yargs){
        yargs.options({
            channel: {
                demand: true,
                alias: 'c',
                description: 'Name of the channel to perform this instantiation',
                type: 'string'
            },
            chaincodeId: {
                demand: true,
                alias: 'i',
                description: 'Chaincode name',
                type: 'string'
            },
            chaincodeVersion: {
                demand: true,
                alias: 'v',
                description: 'Chaincode version',
                type: 'string'
            },
            aVal: {
                demand: false,
                alias: 'a',
                description: 'Value of \'A\' in instantiation request (Default is 200 if not specified)',
                type: 'string'
            },
            bVal: {
                demand: false,
                alias: 'b',
                description: 'Value of \'B\' in instantiation request (Default is 200 if not specified)',
                type: 'string'
            },
            appName: {
                demand: true,
                alias: 'z',
                description: 'Name of Marbles app to be input in Manifest.yml file',
                type: 'string'
            },
            peerId: {
                demand: true,
                alias: 'p',
                description: 'Peer ID to instantiate chaincode',
                type: 'string'
            },
            ordererId: {
                demand: true,
                alias: 'o',
                description: 'Orderer ID to install chaincode',
                type: 'string'
            }
        }).help('help');
    })*/
    .command('invoke', 'Invoke transaction', function(yargs){
        yargs.options({
            channel: {
                demand: true,
                alias: 'c',
                description: 'Name of the channel to perform this invoke',
                type: 'string'
            },
            chaincodeId: {
                demand: true,
                alias: 'i',
                description: 'Chaincode name',
                type: 'string'
            },
            chaincodeVersion: {
                demand: true,
                alias: 'v',
                description: 'Chaincode version',
                type: 'string'
            },
            peerId: {
                demand: true,
                alias: 'p',
                description: 'Peer ID to perform invoke',
                type: 'string'
            },
            moveValue: {
                demand: false,
                alias: 'm',
                description: 'Value to moved from A to B (Default is 5 if nothing is specified)',
                type: 'string'
            },
            numInvokes: {
                demand: false,
                alias: 'n',
                description: 'Number of invokes you would like to perform (default is 1)',
                type: 'number'
            },
            ordererId: {
                demand: true,
                alias: 'o',
                description: 'Orderer ID to use to perform invoke',
                type: 'string'
            }
        }).help('help');
    })
  /*  .command('createmarblesowner', 'Create Marbles Owner', function(yargs){
        yargs.options({
            name: {
                demand: true,
                alias: 'n',
                description: 'Owner\s name',
                type: 'string'
            }
        }).help('help');
    })
    .command('createmarble', 'Create Marble', function(yargs){
        yargs.options({
            name: {
                demand: true,
                alias: 'n',
                description: 'Owner\'s name to be associated with marble',
                type: 'string'
            },
            color: {
                demand: false,
                alias: 'c',
                description: 'Choose a color for your marble. (Default is Random)',
                choices: ['white', 'green', 'blue', 'purple', 'red', 'pink', 'orange', 'black', 'yellow']
            },
            size: {
                demand: false,
                alias: 's',
                description: 'Choose a size for your marble. (Default is Random)',
                choices: ['large', 'small']
            }
        }).help('help');
    })
    .command('transfermarble', 'Transfer Marble', function(yargs){
        yargs.options({
            from: {
                demand: true,
                alias: 'f',
                description: 'Owner\'s name you want to transfer the marble from',
                type: 'string'
            },
            to: {
                demand: true,
                alias: 't',
                description: 'Owner\'s name you want to transfer the marble to',
                type: 'string'
            },
            color: {
                demand: true,
                alias: 'c',
                description: 'Choose the color of the marble to be transferred',
                choices: ['white', 'green', 'blue', 'purple', 'red', 'pink', 'orange', 'black', 'yellow']
            },
            size: {
                demand: true,
                alias: 's',
                description: 'Choose the size of the marble to be transferred',
                choices: ['large', 'small']
            }
        }).help('help');
    })
    .command('deletemarble', 'Transfer Marble', function(yargs){
        yargs.options({
            name: {
                demand: true,
                alias: 'n',
                description: 'Name of owner who own\'s marble to be removed',
                type: 'string'
            },
            color: {
                demand: true,
                alias: 'c',
                description: 'Choose the color of the marble to be transferred',
                choices: ['white', 'green', 'blue', 'purple', 'red', 'pink', 'orange', 'black', 'yellow']
            },
            size: {
                demand: true,
                alias: 's',
                description: 'Choose the size of the marble to be transferred',
                choices: ['large', 'small']
            }
        }).help('help');
    })*/
    .command('query', 'Query', function(yargs){
        yargs.options({
            channel: {
                demand: true,
                alias: 'c',
                description: 'Name of the channel',
                type: 'string'
            },
            chaincodeId: {
                demand: true,
                alias: 'i',
                description: 'Chaincode name',
                type: 'string'
            },
            chaincodeVersion: {
                demand: true,
                alias: 'v',
                description: 'Chaincode version',
                type: 'string'
            },
            peerId: {
                demand: true,
                alias: 'p',
                description: 'Peer ID to query',
                type: 'string'
            },
            ordererId: {
                demand: true,
                alias: 'o',
                description: 'Orderer ID to use for query',
                type: 'string'
            }
        }).help('help');
    })
    .command('createchannel', 'Create channel', function(yargs){
        yargs.options({
            channel: {
                demand: true,
                alias: 'c',
                description: 'Name of the channel to join',
                type: 'string'
            },
            peerId: {
                demand: true,
                alias: 'p',
                description: 'Peer ID to use to create channel',
                type: 'string'
            },
            ordererId: {
                demand: true,
                alias: 'o',
                description: 'Orderer ID to use to create channel',
                type: 'string'
            }
        }).help('help');
    })
    .command('joinchannel', 'Join channel', function(yargs){
        yargs.options({
            channel: {
                demand: true,
                alias: 'c',
                description: 'Name of the channel to join',
                type: 'string'
            },
            peerId: {
                demand: true,
                alias: 'p',
                description: 'Peer ID to use to join channel',
                type: 'string'
            },
            ordererId: {
                demand: true,
                alias: 'o',
                description: 'Orderer ID to use to join channel',
                type: 'string'
            }
        }).help('help');
    })
    .help('help')
    .argv;

var command = argv._[0];

var logger = new (winston.Logger)({
    transports: [
        new winston.transports.Console({
            level: 'debug',
            handleExceptions: true,
            prettyPrint: true,
            colorize: true
        })
    ],
    exitOnError: false
});


// ================================================
// Install Example 2 Chaincode
// ================================================
if (command === 'installcc') {
    tests.install_chaincode(argv.chaincodeId, argv.chaincodeVersion, argv.peerId, argv.ordererId);
}
else if (command === 'installcc2'){
    tests.install_chaincode(argv.chaincodeId, argv.chaincodeVersion, argv.peerId, tls_cert, 'example_cc1');
}

// ================================================
// Install Marbles Chaincode
// ================================================
else if (command === 'installmarbles') {
    tests.install_marbles_chaincode(argv.chaincodeId, argv.chaincodeVersion, argv.peerId, argv.ordererId);
}

// ================================================
// Instantiate Example 2 Chaincode
// ================================================
else if (command === 'instantiatecc') {
    var aVal = '200';
    var bVal = '200';
    if (argv.aVal !== undefined){
        aVal = argv.aVal;
    }
    if (argv.bVal !== undefined){
        bVal = argv.bVal;
    }

    tests.instantiate_chaincode(argv.channel, argv.chaincodeId, argv.chaincodeVersion, aVal, bVal, argv.peerId, argv.ordererId, argv.endorsers, false);
}

// ================================================
// Instantiate Marbles Chaincode
// ================================================
else if (command === 'instantiatemarbles') {
    tests.instantiate_marbles_chaincode(argv.channel, argv.chaincodeId, argv.chaincodeVersion, argv.peerId, argv.appName, argv.ordererId, argv.endorsers, false);
}

// ================================================
// Invoke Example 2 Chaincode
// ================================================
else if (command === 'invoke') {
    var numInvokes = 1;
    var moveValue = '5';
    if (argv.numInvokes !== undefined){
        numInvokes = argv.numInvokes;
    }

    if (argv.moveValue !== undefined){
        moveValue = argv.moveValue;
    }
    for (var i=0; i < numInvokes; i++){
        tests.invoke_transaction(argv.channel, argv.chaincodeId, argv.chaincodeVersion, moveValue, argv.peerId, argv.ordererId, false);
    }
}

// ================================================
// Query Example 2 Chaincode
// ================================================
else if (command === 'query') {
    tests.query(argv.channel, argv.chaincodeId, argv.chaincodeVersion, argv.peerId, argv.ordererId, false);
}

// ================================================
// Create Channel
// ================================================
else if (command === 'createchannel') {
    tests.create_channel(argv.channel, argv.peerId, argv.ordererId);
}

// ================================================
// Join Channel
// ================================================
else if (command === 'joinchannel'){
    tests.join_channel(argv.channel, argv.peerId, argv.ordererId);
}

// ================================================
// Create Marble's Owner
// ================================================
else if (command === 'createmarblesowner'){
    tests.create_marbles_owner(argv.name, function (err, res){
        if (err){
            logger.error('Error creating owner', err);
            process.exit();
        }
        else {
            logger.info('Create owner was successful');
            process.exit();
        }
    });
}

// ================================================
// Create Marble
// ================================================
else if (command === 'createmarble'){

    var size = 'random';
    var color = 'random';
    if (argv.size !== undefined){
        if (argv.size == 'large'){
            size = '35'
        } else if (argv.size == 'small'){
            size = '16'
        }
    }

    if (argv.color !== undefined){
        color = argv.color;
    }


    tests.create_marbles(argv.name, color, size, function (err, res){
        if (err){
            logger.error('Error creating marble', err);
            process.exit();
        }
        else {
            logger.info('Create marble was successful');
            process.exit();
        }
    });
}

// ================================================
// Transfer Marble
// ================================================
else if (command === 'transfermarble'){
    var size;
    if (argv.size === 'large'){
        size = '35'
    } else if (argv.size === 'small'){
        size = '16'
    }

    tests.transfer_marbles(argv.from, argv.to, argv.color, size, function (err, res){
        if (err){
            logger.error('Error transferring marble', err);
            process.exit();
        }
        else {
            logger.info('Transfer marble was successful', res);
            process.exit();
        }
    });
}

// ================================================
// Delete Marble
// ================================================
else if (command === 'deletemarble'){
    var size;
    if (argv.size === 'large'){
        size = '35'
    } else if (argv.size === 'small'){
        size = '16'
    }

    tests.delete_marbles(argv.name, argv.color, size, function (err, res){
        if (err){
            logger.error('Error deleting marble', err);
            process.exit();
        }
        else {
            logger.info('Delete marble was successful', res);
            process.exit();
        }
    });
}