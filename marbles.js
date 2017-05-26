'use strict';
/* global process */
/* global __dirname */
/*******************************************************************************
 * Copyright (c) 2015 IBM Corp.
 *
 * All rights reserved.
 *
 *******************************************************************************/
var compression = require('compression');
var path = require('path');
var http = require('http');
var cors = require('cors');
var async = require('async');
var fs = require('fs');
var os = require('os');
var ws = require('ws');											//websocket module 
var winston = require('winston');								//logginer module

// --- Set Our Things --- //
var logger = new (winston.Logger)({
    level: 'debug',
    transports: [
        new (winston.transports.Console)({ colorize: true }),
    ]
});
var more_entropy = randStr(32);
var helper = require(__dirname + '/marbles/utils/helper.js')('marbles1.json', logger);
var fcw = require('./marbles/utils/fc_wrangler/index.js')({ block_delay: helper.getBlockDelay() }, logger);
var ws_server = require('./marbles/utils/websocket_server_side.js')({ block_delay: helper.getBlockDelay() }, fcw, logger);
var host = 'localhost';
var port = helper.getMarblesPort();
var wss = {};
var enrollObj = null;
var marbles_lib = null;
process.env.marble_company = helper.getCompanyName();

// ------------- Bluemix Detection ------------- //
if (process.env.VCAP_APPLICATION) {
    host = '0.0.0.0';							//overwrite defaults
    port = process.env.PORT;
}



// ------------------------------------------------------------------------------------------------------------------------------
// Life Starts Here!
// ------------------------------------------------------------------------------------------------------------------------------
module.exports.init_marbles = function() {
    process.env.app_state = 'starting';
    process.env.app_first_setup = 'yes';
    helper.checkConfig();

    var hash = helper.getMarbleStartUpHash();
    if (hash === helper.getHash()) {
        logger.debug('Detected that we have launched successfully before');
        logger.debug('Welcome back - Initiating start up\n\n');
        process.env.app_first_setup = 'no';
        enroll_admin(1, function (e) {
            if (e == null) {
                setup_marbles_lib();
            }
        });
    }
    else {
        try {
            rmdir(makeKVSpath());							//delete old kvs folder
        } catch (e) {
            logger.error('could not delete old kvs', e);
        }

        process.env.app_state = 'start_waiting';
        process.env.app_first_setup = 'yes';
    }
}
// ------------------------------------------------------------------------------------------------------------------------------

//setup marbles library and check if cc is deployed
module.exports.setup_marbles_lib = function () {
    logger.debug('Setup Marbles Lib...');

    var opts = helper.makeMarblesLibOptions();
    marbles_lib = require('./marbles/utils/marbles_cc_lib.js')(enrollObj, opts, fcw, logger);
    ws_server.setup(wss.broadcast);

    logger.debug('Checking if chaincode is already deployed or not');
    var options = {
        peer_urls: [helper.getPeersUrl(0)]
    };
    marbles_lib.check_if_already_deployed(options, function (not_deployed, enrollUser) {
        if (not_deployed) {										//if this is truthy we have not yet deployed.... error
            logger.debug('Chaincode ID was not detected: "' + helper.getChaincodeId() + '", all stop');
            process.env.app_first_setup = 'yes';				//overwrite state, bad startup
            broadcast_state('no_chaincode');
        }
        else {													//else we already deployed
            console.log('\n----------------------------- Chaincode Found on Channel ' + helper.getChannelId() + ' -----------------------------\n');

            // --- Check Chaincode Compatibility  --- //
            marbles_lib.check_version(options, function (err, resp) {
                if (helper.errorWithVersions(resp)) {
                    broadcast_state('no_chaincode');
                } else {
                    broadcast_state('found_chaincode');
                    var user_base = null;
                    if (process.env.app_first_setup === 'yes') user_base = helper.getMarbleUsernames();
                    create_assets(user_base); 					//builds marbles, then starts webapp
                }
            });
        }
    });
}

//enroll an admin with the CA for this peer/channel
module.exports.enroll_admin = function (attempt, cb) {
    fcw.enroll(helper.makeEnrollmentOptions(0), function (errCode, obj) {
        if (errCode != null) {
            logger.error('could not enroll...');

            // --- Try Again ---  //
            if (attempt >= 2) {
                if (cb) cb(errCode);
            } else {
                try {
                    logger.warn('removing older kvs and trying to enroll again');
                    rmdir(makeKVSpath());				//delete old kvs folder
                    logger.warn('removed older kvs');
                    enroll_admin(++attempt, cb);
                } catch (e) {
                    logger.error('could not delete old kvs', e);
                }
            }
        } else {
            enrollObj = obj;
            if (cb) cb(null,enrollObj);
        }
    });
}

//random integer
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
}

//random string of x length
function randStr(length) {
    var text = '';
    var possible = 'abcdefghijkmnpqrstuvwxyz0123456789';
    for (var i = 0; i < length; i++) text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
}

//real simple hash
function simple_hash(a_string) {
    var hash = 0;
    for (var i in a_string) hash ^= a_string.charCodeAt(i);
    return hash;
}

// sanitise marble owner names
function saferNames(usernames) {
    var ret = [];
    for (var i in usernames) {
        var name = usernames[i].replace(/\W+/g, '');								//names should not contain many things...
        if (name !== '') ret.push(name.toLowerCase());
    }
    return ret;
}

// create marbles and marble owners, owners first
function create_assets(build_marbles_users) {
    build_marbles_users = saferNames(build_marbles_users);
    logger.info('Creating marble owners and marbles');
    var owners = [];

    if (build_marbles_users && build_marbles_users.length > 0) {
        async.each(build_marbles_users, function (username, owner_cb) {
            logger.debug('- creating marble owner: ', username);

            // --- Create Each User --- //
            create_owners(0, username, function (errCode, resp) {
                owners.push({ id: resp.id, username: username });
                owner_cb();
            });

        }, function (err) {
            logger.info('finished creating owners, now for marbles');
            if (err == null) {

                var marbles = [];
                var marblesEach = 3;											//number of marbles each owner gets
                for (var i in owners) {
                    for (var x = 0; x < marblesEach; x++) {
                        marbles.push(owners[i]);
                    }
                }
                logger.debug('prepared marbles obj', marbles.length, marbles);

                // --- Create Marbles--- //
                async.each(marbles, function (owner_obj, marble_cb) { 			//iter through each one
                    create_marbles(owner_obj.id, owner_obj.username, marble_cb);
                }, function (err) {												//marble owner creation finished
                    logger.debug('- finished creating asset');
                    if (err == null) {
                        all_done();												//delay for peer catch up
                    }
                });
            }
        });
    }
    else {
        logger.debug('- there are no new marble owners to create');
        all_done();
    }
}

//create the marble owner
module.exports.create_owners = function (attempt, username, cb) {
    var opts = helper.makeMarblesLibOptions();
    marbles_lib = require('./marbles/utils/marbles_cc_lib.js')(enrollObj, opts, fcw, logger);
    var options = {
        peer_urls: [helper.getPeersUrl(0)],
        args: {
            marble_owner: username,
            owners_company: process.env.marble_company
        }
    };
    marbles_lib.register_owner(options, function (e, resp) {
        if (e != null) {
            console.log('');
            logger.error('error creating the marble owner', e, resp);
            cb(e, resp);
        }
        else {
            query_owners(function(err){
                if (err){
                    logger.error(err);
                }
                else {
                    cb(null, resp);
                }

            });

        }
    });
}

//create 1 marble
module.exports.create_marbles = function (owner_id, username, color, size, cb) {
    var randOptions = build_marble_options(owner_id, username, color, size, process.env.marble_company);
    console.log('');
    logger.debug('[startup] going to create marble:', randOptions);
    var options = {
        chaincode_id: helper.getChaincodeId(),
        peer_urls: [helper.getPeersUrl(0)],
        args: randOptions
    };
    marbles_lib.create_a_marble(options, function (err, resp) {
        if (err){
            cb(err);
        }
        else {
            query_marbles(function (err) {
                if (err) {
                    cb(err);
                }
                else {
                    cb(null, resp);
                }

            });
        }

    });
}


module.exports.transfer_marble = function (owner_id, marble_id, cb){
    var options = {
        endorsed_hook: '',
        ordered_hook: '',
        args: {
            marble_id: marble_id,
            owner_id: owner_id,
            auth_company: process.env.marble_company
        }
    };

    marbles_lib.set_marble_owner(options, function (err, resp) {
        if (err){
            cb(err);
        }
        else {
            query_marbles(function (err) {
                if (err) {
                    cb(err);
                }
                else {
                    cb(null, resp);
                }

            });
        }
    });
}

module.exports.delete_marble = function (marble_id, cb){
    var options = {
        endorsed_hook: '',
        ordered_hook: '',
        args: {
            marble_id: marble_id,
            auth_company: process.env.marble_company
        }
    };

    marbles_lib.delete_marble(options, function (err, resp) {
        if (err){
            cb(err);
        }
        else {
            query_marbles(function (err) {
                if (err) {
                    cb(err);
                }
                else {
                    cb(null, resp);
                }

            });
        }
    });
}


function query_owners(cb){
    var options = {
        peer_urls: [helper.getPeersUrl(0)]
    };

    marbles_lib.read_everything(options, function (err, resp) {
        if (err != null) {
            console.log('');
            logger.debug('[checking] could not get everything:', err);
            var obj = {
                msg: 'error',
                e: err
            };
            if (cb) cb(obj);
        }
        else {
            var data = resp.parsed;
            var owners = '';

            if (data && data.owners) {

                for (var i=0; i<data.owners.length; i++){
                    owners += '\n' + data.owners[i].username;
                }
                logger.debug('[checking] number of owners: ', data.owners.length);
                logger.debug('[checking] list of owners:', owners);
                cb();

            }
        }
    })
}

function query_marbles(cb){
    var options = {
        peer_urls: [helper.getPeersUrl(0)],
    };

    marbles_lib.read_everything(options, function (err, resp) {
        if (err != null) {
            console.log('');
            logger.debug('[checking] could not get everything:', err);
            var obj = {
                msg: 'error',
                e: err
            };
            if (cb) cb(obj);
        }
        else {
            var data = resp.parsed;
            var owners = [];
            var marbles = '';

            if (data && data.owners && data.marbles) {

                for (var i=0; i<data.owners.length; i++){
                    owners.push(data.owners[i].username);
                }

                for (var j=0; j<owners.length; j++){
                    marbles += '\n' + owners[j] + '\'s marbles:';
                    for (var k=0; k<data.marbles.length; k++){
                        if (owners[j] == data.marbles[k].owner.username){
                            marbles += '\n' + '   Color: ' + data.marbles[k].color + ' Size: ' + data.marbles[k].size;
                        }
                    }
                }
                logger.debug('[checking] number of marbles: ', data.marbles.length);
                logger.debug('[checking] list of marbles:', marbles);
                cb ();

            }
            else if (data.marbles == null){
                logger.debug('[checking] number of marbles: ', 0);
                cb ();
            }
        }
    })
}

module.exports.query = function (enrollObj, cb){
    var opts = helper.makeMarblesLibOptions();
    marbles_lib = require('./marbles/utils/marbles_cc_lib.js')(enrollObj, opts, fcw, logger);
    var options = {
        peer_urls: [helper.getPeersUrl(0)],
    };

    marbles_lib.read_everything(options, function (err, resp) {
        if (err != null) {
            console.log('');
            logger.debug('[checking] could not get everything:', err);
            var obj = {
                msg: 'error',
                e: err
            };
            if (cb) cb(obj);
        }
        else {
            var data = resp.parsed;
            cb(null, data);
        }
    })
}

//create random marble arguments (it is not important for it to be random, just more fun)
function build_marble_options(id, username, color, size, company) {
    var colors = ['white', 'green', 'blue', 'purple', 'red', 'pink', 'orange', 'black', 'yellow'];
    var sizes = ['35', '16'];

    if (color == 'random') {
        var color_index = simple_hash(more_entropy + company) % colors.length;		//build a psudeo random index to pick a color
    }
    else {
        for (var i=0; i < colors.length; i++){
            if (color == colors[i]){
                var color_index = i;
            }
        }
    }

    if (size == 'random') {
        var size_index = getRandomInt(0, sizes.length);								//build a random size for this marble
    }
    else{
        for (var i=0; i < sizes.length; i++){
            if (size == sizes[i]){
                var size_index = i;
            }
        }
    }

    return {
        color: colors[color_index],
        size: sizes[size_index],
        owner_id: id,
        auth_company: process.env.marble_company
    };
}

//we are done, inform the clients
function all_done() {
    console.log('\n------------------------------------------ All Done ------------------------------------------\n');
    broadcast_state('registered_owners');
    process.env.app_first_setup = 'no';

    logger.debug('hash is', helper.getHash());
    helper.write({ hash: helper.getHash() });							//write state file so we know we started before
    ws_server.check_for_updates(null);								//call the periodic task to get the state of everything
}

//message to client to communicate where we are in the start up
function build_state_msg() {
    return {
        msg: 'app_state',
        state: process.env.app_state,
        first_setup: process.env.app_first_setup
    };
}

//send to all connected clients
function broadcast_state(new_state) {
    process.env.app_state = new_state;
    wss.broadcast(build_state_msg());											//tell client our app state
}

// remove any kvs from last run
function rmdir(dir_path) {
    if (fs.existsSync(dir_path)) {
        fs.readdirSync(dir_path).forEach(function (entry) {
            var entry_path = path.join(dir_path, entry);
            if (fs.lstatSync(entry_path).isDirectory()) {
                rmdir(entry_path);
            }
            else {
                fs.unlinkSync(entry_path);
            }
        });
        fs.rmdirSync(dir_path);
    }
}

// make the path to the kvs we use
function makeKVSpath() {
    var temp = helper.makeEnrollmentOptions(0);
    return path.join(os.homedir(), '.hfc-key-store/', temp.uuid);
}


