/**
 * Copyright 2017 IBM All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

// This is an end-to-end test that focuses on exercising all parts of the fabric APIs
// in a happy-path scenario
'use strict';

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);


var path = require('path');
var util = require('util');
var grpc = require('grpc');
var fs = require('fs');
var sleep = require('sleep');

var Client = require('fabric-client');
var utils = require('fabric-client/lib/utils.js');
var Peer = require('fabric-client/lib/Peer.js');
var Orderer = require('fabric-client/lib/Orderer.js');
var testUtil = require('./fabric-sdk/test/unit/util.js');
var EventHub = require('fabric-client/lib/EventHub.js');
var _commonProto = grpc.load(path.join(__dirname, './fabric-sdk/fabric-client/lib/protos/common/common.proto')).common;
var e2eUtils = require('./fabric-sdk/test/integration/e2e/e2eUtils.js');


Client.addConfigFile(path.join(__dirname, './ServiceCredentials.json'));
var ORGS = Client.getConfigSetting();

var tx_id = null;
var nonce = null;
var the_user = null;
var allEventhubs = [];

// =====================================================================================================================
// 										Install Example 2 Chaincode
// =====================================================================================================================
module.exports.install_chaincode = function (chaincodeId, chaincodeVersion, peerId, ordererId, example_cc1) {
    var logger = utils.getLogger('install-chaincode');

    testUtil.setupChaincodeDeploy();

    test('\n\n***** chaincode install *****\n\n', function (t) {

        installChaincode(t, chaincodeId, chaincodeVersion, peerId, ordererId)
            .then(function () {
                    t.pass('Successfully installed chaincode on peer ' + peerId);
                    t.end();
                },
                function (err) {
                    t.fail('Failed to install chaincode on peer' + peerId + err.stack ? err.stack : err);
                    t.end();
                }).catch(function (err) {
            t.fail('Test failed due to unexpected reasons. ' + err.stack ? err.stack : err);
            t.end();
        })
        ;
    })
    ;

    function installChaincode(t, chaincodeId, chaincodeVersion, peerId, ordererId) {
        Client.setConfigSetting('request-timeout', 60000);
        var client = new Client();
        var channel = client.newChannel('mychannel');

        // Get Org Name
        var mspid;
        for (let key in ORGS.peers) {
            if (ORGS.peers[key].name === peerId) {
                mspid = ORGS.peers[key].msp_id;
            }
        }
        var orgName = mspid;

        client.newCryptoSuite({path: testUtil.storePathForOrg(orgName)});

        var caRootsPath;
        for (let orderer in ORGS.orderers) {
            if (ORGS.orderers[orderer].name === ordererId) {
                caRootsPath = ORGS.orderers[orderer].ca_cert;
            }
        }
        let data = fs.readFileSync(path.join(__dirname, caRootsPath));
        let caroots = Buffer.from(data).toString();

        var ordererUrl;
        for (let i in ORGS.orderers) {
            if (ORGS.orderers[i].name === ordererId) {
                ordererUrl = ORGS.orderers[i].api_url;
            }
        }
        channel.addOrderer(
            client.newOrderer(
                ordererUrl,
                {
                    'pem': caroots,
                    'ssl-target-name-override': ordererId
                }
            )
        );

        var targets = [];
        for (let i in ORGS.peers) {
            if (ORGS.peers[i].name === peerId) {
                let peerCaCertPath = ORGS.peers[i].ca_cert;
                let data = fs.readFileSync(path.join(__dirname, peerCaCertPath));
                let peerCaCert = Buffer.from(data).toString();
                let peer = new Peer(
                    ORGS.peers[i].api_url,
                    {
                        'pem': peerCaCert,
                        'ssl-target-name-override': peerId
                    });
                targets.push(peer);
                channel.addPeer(peer);
            }
        }

        return Client.newDefaultKeyValueStore({
            path: testUtil.storePathForOrg(orgName)
        }).then(function (store) {
            client.setStateStore(store);
            return testUtil.getSubmitter(client, t, true, peerId, orgName);
        }).then(function (admin) {
                t.pass('Successfully enrolled user \'admin\'');
                the_user = admin;


            var request = {};
            if (example_cc1){
                request = {
                    targets: targets,
                    chaincodePath: testUtil.CHAINCODE_UPGRADE_PATH,
                    chaincodeId: chaincodeId,
                    chaincodeVersion: chaincodeVersion
                };
            }
            else {
                request = {
                    targets: targets,
                    chaincodePath: testUtil.CHAINCODE_PATH,
                    chaincodeId: chaincodeId,
                    chaincodeVersion: chaincodeVersion
                };
            }

                return client.installChaincode(request);
            }, function (err) {
                t.fail('Failed to enroll user \'admin\'. ' + err);
                throw new Error('Failed to enroll user \'admin\'. ' + err);
            }
        ).then(function (results) {
                var proposalResponses = results[0];

                var proposal = results[1];
                var header = results[2];
                var all_good = true;
                for (var i in proposalResponses) {
                    let one_good = false;
                    if (proposalResponses && proposalResponses[0].response && proposalResponses[0].response.status === 200) {
                        one_good = true;
                        logger.info('install proposal was good');
                    } else {
                        logger.error('install proposal was bad');
                    }
                    all_good = all_good & one_good;
                }
                if (all_good) {
                    t.pass(util.format('Successfully sent install Proposal and received ProposalResponse: Status - %s', proposalResponses[0].response.status));
                } else {
                    t.fail('Failed to send install Proposal or receive valid response. Response null or status is not 200. exiting...');
                }
            },
            function (err) {
                t.fail('Failed to send install proposal due to error: ' + err.stack ? err.stack : err);
                throw new Error('Failed to send install proposal due to error: ' + err.stack ? err.stack : err);
            }
        );
    }
}
// =====================================================================================================================
// 										Install Marbles Chaincode
// =====================================================================================================================
module.exports.install_marbles_chaincode = function (chaincodeId, chaincodeVersion, peerId, ordererId) {
    var logger = utils.getLogger('install-chaincode');

    testUtil.setupChaincodeDeploy();

    test('\n\n***** chaincode install *****\n\n', function (t) {

        installChaincode(t, chaincodeId, chaincodeVersion, peerId, ordererId, caId)
            .then(function () {
                    t.pass('Successfully installed chaincode on peer ' + peerId);
                    t.end();
                },
                function (err) {
                    t.fail('Failed to install chaincode on peer' + peerId + err.stack ? err.stack : err);
                    t.end();
                }).catch(function (err) {
            t.fail('Test failed due to unexpected reasons. ' + err.stack ? err.stack : err);
            t.end();
        })
        ;
    })
    ;

    function installChaincode(t, chaincodeId, chaincodeVersion, peerId, ordererId) {
        Client.setConfigSetting('request-timeout', 60000);
        var client = new Client();
        var chain = client.newChannel('mychannel');

        // Get Org Name
        var mspid;
        for (let key in ORGS.peers) {
            if (ORGS.peers[key].name === peerId) {
                mspid = ORGS.peers[key].msp_id;
            }
        }
        var orgName = mspid;

        client.newCryptoSuite({path: testUtil.storePathForOrg(orgName)});

        var caRootsPath;
        for (let orderer in ORGS.orderers) {
            if (ORGS.orderers[orderer].name === ordererId) {
                caRootsPath = ORGS.orderers[orderer].ca_cert;
            }
        }
        let data = fs.readFileSync(path.join(__dirname, caRootsPath));
        let caroots = Buffer.from(data).toString();

        var ordererUrl;
        for (let i in ORGS.orderers) {
            if (ORGS.orderers[i].name === ordererId) {
                ordererUrl = ORGS.orderers[i].api_url;
            }
        }
        channel.addOrderer(
            client.newOrderer(
                ordererUrl,
                {
                    'pem': caroots,
                    'ssl-target-name-override': ordererId
                }
            )
        );

        var targets = [];
        for (let i in ORGS.peers) {
            if (ORGS.peers[i].name === peerId) {
                let peerCaCertPath = ORGS.peers[i].ca_cert;
                let data = fs.readFileSync(path.join(__dirname, peerCaCertPath));
                let peerCaCert = Buffer.from(data).toString();
                let peer = new Peer(
                    ORGS.peers[i].api_url,
                    {
                        'pem': peerCaCert,
                        'ssl-target-name-override': peerId
                    });
                targets.push(peer);
                channel.addPeer(peer);
            }
        }

        return Client.newDefaultKeyValueStore({
            path: testUtil.storePathForOrg(orgName)
        }).then(function (store) {
            client.setStateStore(store);
            return testUtil.getSubmitter(client, t, true, peerId, orgName);
        }).then(function (admin) {
                t.pass('Successfully enrolled user \'admin\'');
                the_user = admin;

                // send proposal to endorser
                var request = {
                    targets: targets,
                    chaincodePath: testUtil.CHAINCODE_MARBLES_PATH,
                    chaincodeId: chaincodeId,
                    chaincodeVersion: chaincodeVersion
                };

                return client.installChaincode(request);
            }, function (err) {
                t.fail('Failed to enroll user \'admin\'. ' + err);
                throw new Error('Failed to enroll user \'admin\'. ' + err);
            }
        ).then(function (results) {
                var proposalResponses = results[0];

                var proposal = results[1];
                var header = results[2];
                var all_good = true;
                for (var i in proposalResponses) {
                    let one_good = false;
                    if (proposalResponses && proposalResponses[0].response && proposalResponses[0].response.status === 200) {
                        one_good = true;
                        logger.info('install proposal was good');
                    } else {
                        logger.error('install proposal was bad');
                    }
                    all_good = all_good & one_good;
                }
                if (all_good) {
                    t.pass(util.format('Successfully sent install Proposal and received ProposalResponse: Status - %s', proposalResponses[0].response.status));
                } else {
                    t.fail('Failed to send install Proposal or receive valid response. Response null or status is not 200. exiting...');
                }
            },
            function (err) {
                t.fail('Failed to send install proposal due to error: ' + err.stack ? err.stack : err);
                throw new Error('Failed to send install proposal due to error: ' + err.stack ? err.stack : err);
            }
        );
    }
}


// =====================================================================================================================
// 										Instantiate Example 2 Chaincode
// =====================================================================================================================
module.exports.instantiate_chaincode = function (channel, chaincodeId, chaincodeVersion, aVal, bVal, peerId, ordererId, endorsers, upgrade) {
    var logger = utils.getLogger('instantiate-chaincode');
    Client.setConfigSetting('request-timeout', 60000);
    var channel_name = Client.getConfigSetting('CHANNEL_NAME', channel);

    test('\n\n***** instantiate chaincode *****', function(t) {

        var targets = [],
            eventhubs = [];
        var type = 'instantiate';
        if (upgrade) type = 'upgrade';
        // override t.end function so it'll always disconnect the event hub
        t.end = (function (context, ehs, f) {
            return function () {
                for (var key in ehs) {
                    var eventhub = ehs[key];
                    if (eventhub && eventhub.isconnected()) {
                        logger.info('Disconnecting the event hub');
                        eventhub.disconnect();
                    }
                }

                f.apply(context, arguments);
            };
        })(t, eventhubs, t.end);

        var client = new Client();
        var channel = client.newChannel(channel_name);

        // Get Org Name
        var mspid;
        for (let key in ORGS.peers) {
            if (ORGS.peers[key].name === peerId) {
                mspid = ORGS.peers[key].msp_id;
            }
        }

        var orgName = mspid;
        var cryptoSuite = client.newCryptoSuite({path: testUtil.storePathForOrg(orgName)});
        //cryptoSuite.setCryptoKeyStore(client.newCryptoKeyStore({path: testUtil.storePathForOrg(orgName)}));
        client.setCryptoSuite(cryptoSuite);

        var ordererUrl;
        for (let i in ORGS.orderers) {
            if (ORGS.orderers[i].name === ordererId) {
                ordererUrl = ORGS.orderers[i].api_url;
            }
        }

        var caRootsPath;
        for (let orderer in ORGS.orderers) {
            if (ORGS.orderers[orderer].name === ordererId) {
                caRootsPath = ORGS.orderers[orderer].ca_cert;
            }
        }
        let data = fs.readFileSync(path.join(__dirname, caRootsPath));
        let caroots = Buffer.from(data).toString();

        channel.addOrderer(
            client.newOrderer(
                ordererUrl,
                {
                    'pem': caroots,
                    'ssl-target-name-override': ordererId
                }
            )
        );

        var targets = [];
        var badTransientMap = {'test1': 'transientValue'}; // have a different key than what the chaincode example_cc1.go expects in Init()
        var transientMap = {'test': 'transientValue'};

        return Client.newDefaultKeyValueStore({
            path: testUtil.storePathForOrg(orgName)
        }).then(function (store) {

            client.setStateStore(store);
            return testUtil.getSubmitter(client, t, true, peerId, orgName);

        }).then(function (admin) {

            t.pass('Successfully enrolled user \'admin\'');
            the_user = admin;


            for (let i in ORGS.peers) {
                if (ORGS.peers[i].name === peerId) {
                    logger.info(' create new peer %s', ORGS.peers[i].api_url);
                    let peerCaCertPath = ORGS.peers[i].ca_cert;
                    let data = fs.readFileSync(path.join(__dirname, peerCaCertPath));
                    let peerCaCert = Buffer.from(data).toString();
                    let peer = client.newPeer(
                        ORGS.peers[i].api_url,
                        {
                            'pem': peerCaCert,
                            'ssl-target-name-override': peerId
                        });
                    channel.addPeer(peer);
                    targets.push(peer);
                    logger.info(' create new eventhub %s', ORGS.peers[i].event_url);
                    let eh = new EventHub(client);
                    eh.setPeerAddr(
                        ORGS.peers[i].event_url,
                        {
                            'pem': peerCaCert,
                            'ssl-target-name-override': peerId
                        }
                    );
                    eh.connect();
                    eventhubs.push(eh);

                }
            }

            // read the config block from the orderer for the chain
            // and initialize the verify MSPs based on the participating
            // organizations
            return channel.initialize();
        }, function (err) {

            t.fail('Failed to enroll user \'admin\'. ' + err);
            throw new Error('Failed to enroll user \'admin\'. ' + err);

        }).then(function () {

            // the v1 chaincode has Init() method that expects a transient map
            if (upgrade) {
                // first test that a bad transient map would get the chaincode to return an error
                let request = buildChaincodeProposal(the_user, channel, testUtil.CHAINCODE_PATH, chaincodeId, chaincodeVersion, upgrade, badTransientMap, peerId, aVal, bVal, endorsers);
                tx_id = request.tx_id;
                t.comment(util.format(
                    'Upgrading chaincode "%s" at path "%s" to version "%s" by passing args "%s" to method "%s" in transaction "%s"',
                    request.chaincodeId,
                    request.chaincodePath,
                    request.chaincodeVersion,
                    request.args,
                    request.fcn,
                    request.txId.getTransactionID()
                ));

                return channel.sendUpgradeProposal(request)
                    .then(function (results) {
                        let proposalResponses = results[0];

                        // expecting both peers to return an Error due to the bad transient map
                        let success = false;
                        if (proposalResponses && proposalResponses.length > 0) {
                            proposalResponses.forEach(function (response) {
                                if (response instanceof Error &&
                                    response.message.indexOf('Did not find expected key "test" in the transient map of the proposal')) {
                                    success = true;
                                } else {
                                    success = false;
                                }
                            });
                        }

                        if (success) {
                            // successfully tested the negative conditions caused by
                            // the bad transient map, now send the good transient map
                            request = buildChaincodeProposal(the_user, channel, testUtil.CHAINCODE_PATH, chaincodeId, chaincodeVersion, upgrade, transientMap, peerId, aVal, bVal, endorsers);
                            tx_id = request.tx_id;
                            request = request.request;

                            return channel.sendUpgradeProposal(request);
                        } else {
                            throw new Error('Failed to test for bad transient map. The chaincode should have rejected the upgrade proposal.');
                        }
                    });
            } else {
                let request = buildChaincodeProposal(the_user, channel, testUtil.CHAINCODE_PATH, chaincodeId, chaincodeVersion, upgrade, transientMap, peerId, aVal, bVal, endorsers);
                tx_id = request.tx_id;
                request = request.request;

                return channel.sendInstantiateProposal(request);
            }

        }, function (err) {

            t.fail(util.format('Failed to initialize the channel. %s', err.stack ? err.stack : err));
            throw new Error('Failed to initialize the chain');

        }).then(function (results) {

            var proposalResponses = results[0];

            var proposal = results[1];
            var header = results[2];
            var all_good = true;
            for (var i in proposalResponses) {
                let one_good = false;
                if (proposalResponses && proposalResponses[i].response && proposalResponses[i].response.status === 200) {
                    // special check only to test transient map support during chaincode upgrade
                    one_good = true;
                    logger.info(type + ' proposal was good');
                } else {
                    logger.error(type + ' proposal was bad');
                }
                all_good = all_good & one_good;
            }
            if (all_good) {
                t.pass(util.format('Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s", metadata - "%s", endorsement signature: %s', proposalResponses[0].response.status, proposalResponses[0].response.message, proposalResponses[0].response.payload, proposalResponses[0].endorsement.signature));
                var request = {
                    proposalResponses: proposalResponses,
                    proposal: proposal,
                    header: header
                };

                // set the transaction listener and set a timeout of 30sec
                // if the transaction did not get committed within the timeout period,
                // fail the test
                var deployId = tx_id.getTransactionID();

                var eventPromises = [];
                eventhubs.forEach(function (eh) {
                    let txPromise = new Promise(function (resolve, reject) {
                        let handle = setTimeout(reject, 120000);

                        eh.registerTxEvent(deployId.toString(), function (tx, code) {
                            t.pass('The chaincode ' + type + ' transaction has been committed on peer ' + eh.ep._endpoint.addr);
                            clearTimeout(handle);
                            eh.unregisterTxEvent(deployId);

                            if (code !== 'VALID') {
                                t.fail('The chaincode ' + type + ' transaction was invalid, code = ' + code);
                                reject();
                            } else {
                                t.pass('The chaincode ' + type + ' transaction was valid.');
                                resolve();
                            }
                        });
                    });
                    logger.info('register eventhub %s with tx=%s', eh.ep._endpoint.addr, tx_id);
                    eventPromises.push(txPromise);
                });

                var sendPromise = channel.sendTransaction(request);
                return Promise.all([sendPromise].concat(eventPromises))
                    .then(function (results) {

                        logger.debug('Event promise all complete and testing complete');
                        return results[0]; // just first results are from orderer, the rest are from the peer events

                    }).catch(function (err) {

                        t.fail('Failed to send ' + type + ' transaction and get notifications within the timeout period.');
                        throw new Error('Failed to send ' + type + ' transaction and get notifications within the timeout period.');

                    });

            } else {
                t.fail('Failed to send ' + type + ' Proposal or receive valid response. Response null or status is not 200. exiting...');
                throw new Error('Failed to send ' + type + ' Proposal or receive valid response. Response null or status is not 200. exiting...');
            }
        }, function (err) {

            t.fail('Failed to send ' + type + ' proposal due to error: ' + err.stack ? err.stack : err);
            throw new Error('Failed to send ' + type + ' proposal due to error: ' + err.stack ? err.stack : err);

        }).then(function (response) {
            //TODO should look into the event responses
            if (!(response instanceof Error) && response.status === 'SUCCESS') {
                t.pass('Successfully sent ' + type + 'transaction to the orderer.');
                return true;
            } else {
                t.fail('Failed to order the ' + type + 'transaction. Error code: ' + response.status);
                Promise.reject(new Error('Failed to order the ' + type + 'transaction. Error code: ' + response.status));
            }
        }, function (err) {

            t.fail('Failed to send ' + type + ' due to error: ' + err.stack ? err.stack : err);
            Promise.reject(new Error('Failed to send instantiate due to error: ' + err.stack ? err.stack : err));
        });
    });
}

// =====================================================================================================================
// 										Instantiate Marbles Chaincode
// =====================================================================================================================
module.exports.instantiate_marbles_chaincode = function (channel, chaincodeId, chaincodeVersion, peerId, appName, endorsers, upgrade) {
    var logger = utils.getLogger('instantiate-chaincode');
    Client.setConfigSetting('request-timeout', 60000);
    var channel_name = Client.getConfigSetting('CHANNEL_NAME', channel);

    test('\n\n***** instantiate marbles chaincode *****', function(t) {

        var targets = [],
            eventhubs = [];
        var type = 'instantiate';
        if (upgrade) type = 'upgrade';
        // override t.end function so it'll always disconnect the event hub
        t.end = (function (context, ehs, f) {
            return function () {
                for (var key in ehs) {
                    var eventhub = ehs[key];
                    if (eventhub && eventhub.isconnected()) {
                        logger.info('Disconnecting the event hub');
                        eventhub.disconnect();
                    }
                }

                createBlockchainCredsFile(logger, peerId);  //Create blockchain_creds1.json file for marbles application

                createManifestYmlFile(logger, appName);   //Create manifest.yml file for marbles application

                f.apply(context, arguments);
            };
        })(t, eventhubs, t.end);

        var client = new Client();
        var channel = client.newChannel(channel_name);

        // Get Org Name
        var peerName, mspid;
        for (let key in ORGS.peers) {
            peerName = 'fabric-peer-' + peerId;
            if (ORGS.peers[key].name === peerName) {
                mspid = ORGS.peers[key].msp_id;
            }
        }

        var orgName = mspid;
        var cryptoSuite = client.newCryptoSuite({path: testUtil.storePathForOrg(orgName)});
        //cryptoSuite.setCryptoKeyStore(client.newCryptoKeyStore({path: testUtil.storePathForOrg(orgName)}));
        client.setCryptoSuite(cryptoSuite);

        var peerLpar = peerId.slice(-1);  //get last character of peer ID to know which orderer to use
        var ordererName, ordererUrl;
        for (let i in ORGS.orderers) {
            ordererName = 'fabric-orderer-' + peerId;
            if (ORGS.orderers[i].name === ordererName) {
                ordererUrl = ORGS.orderers[i].api_url;
            }
        }

        var caRootsPath;
        for (let orderer in ORGS.orderers) {
            if (ORGS.orderers[orderer].name === ordererId) {
                caRootsPath = ORGS.orderers[orderer].ca_cert;
            }
        }
        let data = fs.readFileSync(path.join(__dirname, caRootsPath));
        let caroots = Buffer.from(data).toString();

        channel.addOrderer(
            client.newOrderer(
                ordererUrl,
                {
                    'pem': caroots,
                    'ssl-target-name-override': 'orderer0.example.com'
                }
            )
        );

        var targets = [];
        var badTransientMap = {'test1': 'transientValue'}; // have a different key than what the chaincode example_cc1.go expects in Init()
        var transientMap = {'test': 'transientValue'};

        return Client.newDefaultKeyValueStore({
            path: testUtil.storePathForOrg(orgName)
        }).then(function (store) {

            client.setStateStore(store);
            return testUtil.getSubmitter(client, t, true, peerId, orgName);

        }).then(function (admin) {

            t.pass('Successfully enrolled user \'admin\'');
            the_user = admin;

            var peerName;

            for (let i in ORGS.peers) {
                peerName = 'fabric-peer-' + peerId;
                if (ORGS.peers[i].name === peerName) {
                    logger.info(' create new peer %s', ORGS.peers[i].api_url);
                    let peerCaCertPath = ORGS.peers[i].ca_cert;
                    let data = fs.readFileSync(path.join(__dirname, peerCaCertPath));
                    let peerCaCert = Buffer.from(data).toString();
                    let peer = client.newPeer(
                        ORGS.peers[i].api_url,
                        {
                            'pem': peerCaCert,
                            'ssl-target-name-override': peerId
                        });
                    channel.addPeer(peer);
                    targets.push(peer);
                    logger.info(' create new eventhub %s', ORGS.peers[i].event_url);
                    let eh = new EventHub(client);
                    eh.setPeerAddr(
                        ORGS.peers[i].event_url,
                        {
                            'pem': peerCaCert,
                            'ssl-target-name-override': peerId
                        }
                    );
                    eh.connect();
                    eventhubs.push(eh);

                }
            }

            // read the config block from the orderer for the chain
            // and initialize the verify MSPs based on the participating
            // organizations
            return channel.initialize();
        }, function (err) {

            t.fail('Failed to enroll user \'admin\'. ' + err);
            throw new Error('Failed to enroll user \'admin\'. ' + err);

        }).then(function () {

            // the v1 chaincode has Init() method that expects a transient map
            if (upgrade) {
                // first test that a bad transient map would get the chaincode to return an error
                let request = buildMarblesChaincodeProposal(the_user, channel, testUtil.CHAINCODE_MARBLES_PATH, chaincodeId, chaincodeVersion, upgrade, badTransientMap, peerId, endorsers);
                tx_id = request.tx_id;
                request = request.request;

                return channel.sendUpgradeProposal(request)
                    .then(function (results) {
                        let proposalResponses = results[0];

                        // expecting both peers to return an Error due to the bad transient map
                        let success = false;
                        if (proposalResponses && proposalResponses.length > 0) {
                            proposalResponses.forEach(function (response) {
                                if (response instanceof Error &&
                                    response.message.indexOf('Did not find expected key "test" in the transient map of the proposal')) {
                                    success = true;
                                } else {
                                    success = false;
                                }
                            });
                        }

                        if (success) {
                            // successfully tested the negative conditions caused by
                            // the bad transient map, now send the good transient map
                            request = buildMarblesChaincodeProposal(the_user, channel, testUtil.CHAINCODE_MARBLES_PATH, chaincodeId, chaincodeVersion, upgrade, transientMap, peerId, endorsers);
                            tx_id = request.tx_id;
                            request = request.request;

                            return channel.sendUpgradeProposal(request);
                        } else {
                            throw new Error('Failed to test for bad transient map. The chaincode should have rejected the upgrade proposal.');
                        }
                    });
            } else {
                let request = buildMarblesChaincodeProposal(the_user, channel, testUtil.CHAINCODE_MARBLES_PATH, chaincodeId, chaincodeVersion, upgrade, transientMap, peerId, endorsers);
                tx_id = request.tx_id;
                request = request.request;

                return channel.sendInstantiateProposal(request);
            }

        }, function (err) {

            t.fail(util.format('Failed to initialize the channel. %s', err.stack ? err.stack : err));
            throw new Error('Failed to initialize the chain');

        }).then(function (results) {

            var proposalResponses = results[0];

            var proposal = results[1];
            var header = results[2];
            var all_good = true;
            for (var i in proposalResponses) {
                let one_good = false;
                if (proposalResponses && proposalResponses[i].response && proposalResponses[i].response.status === 200) {
                    // special check only to test transient map support during chaincode upgrade
                    one_good = true;
                    logger.info(type + ' proposal was good');
                } else {
                    logger.error(type + ' proposal was bad');
                }
                all_good = all_good & one_good;
            }
            if (all_good) {
                t.pass(util.format('Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s", metadata - "%s", endorsement signature: %s', proposalResponses[0].response.status, proposalResponses[0].response.message, proposalResponses[0].response.payload, proposalResponses[0].endorsement.signature));
                var request = {
                    proposalResponses: proposalResponses,
                    proposal: proposal,
                    header: header
                };

                // set the transaction listener and set a timeout of 30sec
                // if the transaction did not get committed within the timeout period,
                // fail the test
                var deployId = tx_id.getTransactionID();

                var eventPromises = [];
                eventhubs.forEach(function (eh) {
                    let txPromise = new Promise(function (resolve, reject) {
                        let handle = setTimeout(reject, 120000);

                        eh.registerTxEvent(deployId.toString(), function (tx, code) {
                            t.pass('The chaincode ' + type + ' transaction has been committed on peer ' + eh.ep._endpoint.addr);
                            clearTimeout(handle);
                            eh.unregisterTxEvent(deployId);

                            if (code !== 'VALID') {
                                t.fail('The chaincode ' + type + ' transaction was invalid, code = ' + code);
                                reject();
                            } else {
                                t.pass('The chaincode ' + type + ' transaction was valid.');
                                resolve();
                            }
                        });
                    });
                    logger.info('register eventhub %s with tx=%s', eh.ep._endpoint.addr, tx_id);
                    eventPromises.push(txPromise);
                });

                var sendPromise = channel.sendTransaction(request);
                return Promise.all([sendPromise].concat(eventPromises))
                    .then(function (results) {

                        logger.debug('Event promise all complete and testing complete');
                        return results[0]; // just first results are from orderer, the rest are from the peer events

                    }).catch(function (err) {

                        t.fail('Failed to send ' + type + ' transaction and get notifications within the timeout period.');
                        throw new Error('Failed to send ' + type + ' transaction and get notifications within the timeout period.');

                    });

            } else {
                t.fail('Failed to send ' + type + ' Proposal or receive valid response. Response null or status is not 200. exiting...');
                throw new Error('Failed to send ' + type + ' Proposal or receive valid response. Response null or status is not 200. exiting...');
            }
        }, function (err) {

            t.fail('Failed to send ' + type + ' proposal due to error: ' + err.stack ? err.stack : err);
            throw new Error('Failed to send ' + type + ' proposal due to error: ' + err.stack ? err.stack : err);

        }).then(function (response) {
            //TODO should look into the event responses
            if (!(response instanceof Error) && response.status === 'SUCCESS') {
                t.pass('Successfully sent ' + type + 'transaction to the orderer.');
                return true;
            } else {
                t.fail('Failed to order the ' + type + 'transaction. Error code: ' + response.status);
                Promise.reject(new Error('Failed to order the ' + type + 'transaction. Error code: ' + response.status));
            }
        }, function (err) {

            t.fail('Failed to send ' + type + ' due to error: ' + err.stack ? err.stack : err);
            Promise.reject(new Error('Failed to send instantiate due to error: ' + err.stack ? err.stack : err));
        });
    });
};


// =====================================================================================================================
// 										Invoke Transaction
// =====================================================================================================================

module.exports.invoke_transaction = function (channel, chaincodeId, chaincodeVersion, value, peerId, ordererId, useStore) {
    var logger = utils.getLogger('invoke-chaincode');

    test('\n\n***** invoke transaction to move money *****', function (t) {
        Client.setConfigSetting('request-timeout', 60000);
        var channel_name = Client.getConfigSetting('CHANNEL_NAME', channel);

        var targets = [],
            eventhubs = [];
        var pass_results = null;

        // override t.end function so it'll always disconnect the event hub
        t.end = (function(context, ehs, f) {
                return function() {
                    for(var key in ehs) {
                        var eventhub = ehs[key];
                        if (eventhub && eventhub.isconnected()) {
                            logger.info('Disconnecting the event hub');
                            eventhub.disconnect();
                        }
                    }

                    f.apply(context, arguments);
                };
    })(t, eventhubs, t.end);

        // this is a transaction, will just use org's identity to
        // submit the request. intentionally we are using a different org
        // than the one that instantiated the chaincode, although either org
        // should work properly
        var client = new Client();
        var channel = client.newChannel(channel_name);

        // Get Org Name
        var mspid;
        for (let key in ORGS.peers) {
            if (ORGS.peers[key].name === peerId) {
                mspid = ORGS.peers[key].msp_id;
            }
        }

        var orgName = mspid;
        var cryptoSuite = clien.newcryptoSuite();
        /*if (userStor) {
            cryptoSuite.setCryptoKeyStore({path: testUtil.storePathForOrg(orgName)});
            client.setCryptoSuite(cryptoSuite);
        }*/

        var ordererUrl;
        for (let i in ORGS.orderers) {
            if (ORGS.orderers[i].name === ordererId) {
                ordererUrl = ORGS.orderers[i].api_url;
            }
        }

        var caRootsPath;
        for (let orderer in ORGS.orderers) {
            if (ORGS.orderers[orderer].name === ordererId) {
                caRootsPath = ORGS.orderers[orderer].ca_cert;
            }
        }
        let data = fs.readFileSync(path.join(__dirname, caRootsPath));
        let caroots = Buffer.from(data).toString();

        channel.addOrderer(
            client.newOrderer(
                ordererUrl,
                {
                    'pem': caroots,
                    'ssl-target-name-override': ordererId
                }
            )
        );

        var promise;
        if (useStore) {
            promise = Client.newDefaultKeyValueStore({
                path: testUtil.storePathForOrg(orgname)
            });
        }else {
            promise = Promise.resolve(useStore);
        }
        return promise.then(function(store){
            if (store) {
                client.setStateStore(store);
            }
            return testUtil.getSubmitter(client, t, true, peerId, orgName);
         }).then(function(admin) {

            t.pass('Successfully enrolled user \'admin\'');
        the_user = admin;


        for (let i in ORGS.peers) {
            if (ORGS.peers[i].name === peerId) {
                logger.info(' create new peer %s', ORGS.peers[i].api_url);
                let peerCaCertPath = ORGS.peers[i].ca_cert;
                let data = fs.readFileSync(path.join(__dirname, peerCaCertPath));
                let peerCaCert = Buffer.from(data).toString();
                let peer = client.newPeer(
                    ORGS.peers[i].api_url,
                    {
                        'pem': peerCaCert,
                        'ssl-target-name-override': peerId
                    });
                channel.addPeer(peer);
                logger.info(' create new eventhub %s', ORGS.peers[i].event_url);
                let eh = new EventHub(client);
                eh.setPeerAddr(
                    ORGS.peers[i].event_url,
                    {
                        'pem': peerCaCert,
                        'ssl-target-name-override': peerId
                    }
                );
                eh.connect();
                eventhubs.push(eh);

            }
        }

        return channel.initialize();

    }).then(function(nothing) {
        tx_id = client.newTransactionID(the_user);
        utils.setConfigSetting('E2E_TX_ID', tx_id.getTransactionID());
        logger.info('setConfigSetting("E2E_TX_ID") = %s', tx_id.getTransactionID());
        t.comment(util.format('Sending transaction "%s"', tx_id.getTransactionID()));

        // send proposal to endorser
        var request = {
            chaincodeId : chaincodeId,
         //   chaincodeVersion : chaincodeVersion,
         //   chainId: channel,
            fcn: 'invoke',
            args: ['move', 'a', 'b', value],
            txId: tx_id
        };
        return channel.sendTransactionProposal(request);

    }, function(err) {

            t.fail('Failed to enroll user \'admin\'. ' + err);
            throw new Error('Failed to enroll user \'admin\'. ' + err);
        }).then(function(results) {
            pass_results = results;
        var sleep_time = 0;
        // can use "sleep=30000" to give some time to manually stop and start
        // the peer so the event hub will also stop and start
        if (process.argv.length > 2) {
            if (process.argv[2].indexOf('sleep=') === 0) {
                sleep_time = process.argv[2].split('=')[1];
            }
        }
        t.comment('*****************************************************************************');
        t.comment('stop and start the peer event hub ---- N  O  W ----- you have ' + sleep_time + ' millis');
        t.comment('*****************************************************************************');
        return sleep_(sleep_time);
    }).then(function(nothing) {

            var proposalResponses = pass_results[0];

        var proposal = pass_results[1];
        var header   = pass_results[2];
        var all_good = true;
        for(var i in proposalResponses) {
            let one_good = false;
            let proposal_response = proposalResponses[i];
            if( proposal_response.response && proposal_response.response.status === 200) {
                t.pass('transaction proposal has response status of good');
                one_good = channel.verifyProposalResponse(proposal_response);
                if(one_good) {
                    t.pass(' transaction proposal signature and endorser are valid');
                }
            } else {
                t.fail('transaction proposal was bad');
            }
            all_good = all_good & one_good;
        }
        if (all_good) {
            // check all the read/write sets to see if the same, verify that each peer
            // got the same results on the proposal
            all_good = channel.compareProposalResponseResults(proposalResponses);
            t.pass('compareProposalResponseResults execution did not throw an error');
            if(all_good){
                t.pass(' All proposals have a matching read/writes sets');
            }
            else {
                t.fail(' All proposals do not have matching read/write sets');
            }
        }
        if (all_good) {
            // check to see if all the results match
            t.pass(util.format('Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s", metadata - "%s", endorsement signature: %s', proposalResponses[0].response.status, proposalResponses[0].response.message, proposalResponses[0].response.payload, proposalResponses[0].endorsement.signature));
            var request = {
                proposalResponses: proposalResponses,
                proposal: proposal,
                header: header
            };

            // set the transaction listener and set a timeout of 30sec
            // if the transaction did not get committed within the timeout period,
            // fail the test
            var deployId = tx_id.getTransactionID();

            var eventPromises = [];
            eventhubs.forEach(function(eh) {
                let txPromise = new Promise(function(resolve, reject) {
                        let handle = setTimeout(reject, 120000);

            eh.registerTxEvent(deployId.toString(),
                function(tx, code) {
                    clearTimeout(handle);
                    eh.unregisterTxEvent(deployId);

                    if (code !== 'VALID') {
                        t.fail('The balance transfer transaction was invalid, code = ' + code);
                        reject();
                    } else {
                         t.pass('The balance transfer transaction has been committed on peer '+ eh.ep._endpoint.addr);
                     resolve();
                     }
            },
            function(err) {
                clearTimeout(handle);
                t.pass('Successfully received notification of the event call back being cancelled for '+ deployId);
                resolve();
            }
        );
        });

            eventPromises.push(txPromise);
        });

            var sendPromise = channel.sendTransaction(request);
            return Promise.all([sendPromise].concat(eventPromises))
                    .then(function(results) {

                    logger.debug(' event promise all complete and testing complete');
            return results[0]; // the first returned value is from the 'sendPromise' which is from the 'sendTransaction()' call

        }).catch(function(err) {

                t.fail('Failed to send transaction and get notifications within the timeout period.');
            throw new Error('Failed to send transaction and get notifications within the timeout period.');

        });

        } else {
            t.fail('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
            throw new Error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
        }
    }, function(err) {

            t.fail('Failed to send proposal due to error: ' + err.stack ? err.stack : err);
            throw new Error('Failed to send proposal due to error: ' + err.stack ? err.stack : err);

        }).then(function(response) {

            if (response.status === 'SUCCESS') {
            t.pass('Successfully sent transaction to the orderer.');
            t.comment('******************************************************************');
            t.comment('To manually run /test/integration/query.js, set the following environment variables:');
            t.comment('export E2E_TX_ID='+'\''+tx_id+'\'');
            t.comment('******************************************************************');
            logger.debug('invokeChaincode end');
            return true;
        } else {
            t.fail('Failed to order the transaction. Error code: ' + response.status);
            throw new Error('Failed to order the transaction. Error code: ' + response.status);
        }
    }, function(err) {

            t.fail('Failed to send transaction due to error: ' + err.stack ? err.stack : err);
            throw new Error('Failed to send transaction due to error: ' + err.stack ? err.stack : err);

        });

    })
}

// =====================================================================================================================
// 										Query
// =====================================================================================================================
module.exports.query = function (channel, chaincodeId, chaincodeVersion, peerId, ordererId, transientMap) {
    var logger = utils.getLogger('query');

    test('\n\n***** query chaincode *****', function(t) {

        Client.setConfigSetting('request-timeout', 60000);
        var channel_name = Client.getConfigSetting('CHANNEL_NAME', channel);

        // this is a transaction, will just use org's identity to
        // submit the request. intentionally we are using a different org
        // than the one that submitted the "move" transaction, although either org
        // should work properly
        var client = new Client();
        var channel = client.newChannel(channel_name);

        // Get Org Name
        var mspid;
        for (let key in ORGS.peers) {
            if (ORGS.peers[key].name === peerId) {
                mspid = ORGS.peers[key].msp_id;
            }
        }

        var orgName = mspid;
        var cryptoSuite = client.newCryptoSuite({path: testUtil.storePathForOrg(orgName)});
        //cryptoSuite.setCryptoKeyStore(client.newCryptoKeyStore({path: testUtil.storePathForOrg(orgName)}));
        client.setCryptoSuite(cryptoSuite);

        var targets = [];
        for (let i in ORGS.peers) {
            if (ORGS.peers[i].name === peerId) {
                logger.info(' create new peer %s', ORGS.peers[i].api_url);
                let peerCaCertPath = ORGS.peers[i].ca_cert;
                let data = fs.readFileSync(path.join(__dirname, peerCaCertPath));
                let peerCaCert = Buffer.from(data).toString();
                let peer = client.newPeer(
                    ORGS.peers[i].api_url,
                    {
                        'pem': peerCaCert,
                        'ssl-target-name-override': peerId
                    });
                channel.addPeer(peer);
            }
        }


        return Client.newDefaultKeyValueStore({
                path: testUtil.storePathForOrg(orgName)
            }).then(function(store) {

            client.setStateStore(store);
            return testUtil.getSubmitter(client, t, true, peerId, orgName);

    }).then(function(admin) {
            the_user = admin;
            tx_id = client.newTransactionID(the_user);

        // send query
        var request = {
            chaincodeId : chaincodeId,
           // chaincodeVersion : chaincodeVersion,
           // chainId: channel,
            txId: tx_id,
            fcn: 'invoke',
            args: ['query','b']
        };

        if (transientMap) {
            request.transientMap = transientMap;
            request.args = ['testTransient', ''];
        }

        return channel.queryByChaincode(request);
    },
        function(err) {
            t.comment('Failed to get submitter \'admin\'');
            t.fail('Failed to get submitter \'admin\'. Error: ' + err.stack ? err.stack : err );
            throw new Error('Failed to get submitter');
        }).then(function(response_payloads) {
            if (response_payloads) {
                for(let i = 0; i < response_payloads.length; i++) {
                    if (transientMap) {
                        logger.info('Query Result for B: ' + response_payloads[i].toString('utf8'));
                        t.pass('Successfully queried the result for B');
                    } else {
                        logger.info('Query Result for B: ' + response_payloads[i].toString('utf8'));
                        t.pass('Successfully queried the result for B');
                    }
                }
                t.end();
                return true;
            } else {
                t.fail('response_payloads is null');
                throw new Error('Failed to get response on query');
        }
    },
        function(err) {
            t.fail('Failed to send query due to error: ' + err.stack ? err.stack : err);
            throw new Error('Failed, got error on query');
        });
    });
};

// =====================================================================================================================
// 										Create Channel
// =====================================================================================================================
module.exports.create_channel = function (channel, peerId, ordererId) {
    var logger = utils.getLogger('create-channel');


    test('\n\n***** Create Channel *****\n\n', function (t) {
        var client = new Client();

        var ordererUrl;
        for (let i in ORGS.orderers) {
            if (ORGS.orderers[i].name === ordererId) {
                ordererUrl = ORGS.orderers[i].api_url;
            }
        }

        var caRootsPath;
        for (let orderer in ORGS.orderers) {
            if (ORGS.orderers[orderer].name === ordererId) {
                caRootsPath = ORGS.orderers[orderer].ca_cert;
            }
        }
        let data = fs.readFileSync(path.join(__dirname, caRootsPath));
        let caroots = Buffer.from(data).toString();

        var orderer = client.newOrderer(
            ordererUrl,
            {
                'pem': caroots,
                'ssl-target-name-override': ordererId
            }
        );


        var TWO_ORG_MEMBERS_AND_ADMIN = [{
            role: {
                name: 'member',
                mspId: 'Org1MSP'
            }
        }, {
            role: {
                name: 'member',
                mspId: 'Org2MSP'
            }
        }, {
            role: {
                name: 'admin',
                mspId: 'OrdererMSP'
            }
        }];

        var ONE_OF_TWO_ORG_MEMBER = {
            identities: TWO_ORG_MEMBERS_AND_ADMIN,
            policy: {
                '1-of': [{ 'signed-by': 0 }, { 'signed-by': 1 }]
            }
        };

        var ACCEPT_ALL = {
            identities: [],
            policy: {
                '0-of': []
            }
        };


        //Get MSPID
        var mspid;
        for (let key in ORGS.peers){
            if (ORGS.peers[key].name === peerId){
                mspid = ORGS.peers[key].msp_id;
            }
        }

        var config = null;
        var signatures = [];
        var msps = [];

        msps.push(client.newMSP(e2eUtils.loadMSPConfig('OrdererMSP', '../../../../fabric-sdk/test/fixtures/channel/crypto-config/ordererOrganizations/example.com/msp/')));

        msps.push(client.newMSP(e2eUtils.loadMSPConfig('Org1MSP', '../../../../fabric-sdk/test/fixtures/channel/crypto-config/peerOrganizations/org1.example.com/msp/')));


        // Acting as a client in org1 when creating the channel
        var orgName = mspid;

        utils.setConfigSetting('key-value-store', 'fabric-client/lib/impl/FileKeyValueStore.js');

        return Client.newDefaultKeyValueStore({
            path: testUtil.storePathForOrg(orgName)
        }).then(function (store) {
            client.setStateStore(store);
            var cryptoSuite = client.newCryptoSuite({path: testUtil.storePathForOrg(orgName)});
            //cryptoSuite.setCryptoKeyStore(client.newCryptoKeyStore({path: testUtil.storePathForOrg(org)}));
            client.setCryptoSuite(cryptoSuite);

            return testUtil.getOrderAdminSubmitter(client, t);
        }).then(function (admin) {
            // use the config update created by the configtx tool
            let envelope_bytes = fs.readFileSync(path.join(__dirname, './fabric-sdk/test/fixtures/channel/mychannel.tx'));
            config = client.extractChannelConfig(envelope_bytes);
            t.pass('Successfull extracted the config update from the configtx envelope');

            client._userContext = null;
            return testUtil.getSubmitter(client, t, true, peerId, orgName);
        }).then(function (admin) {
            t.pass('Successfully enrolled user \'admin\' for ' + mspid);

            // sign the config
            var signature = client.signChannelConfig(config);
            t.pass('Successfully signed config update');
            // collect signature from org1 admin
            // TODO: signature counting against policies on the orderer
            // at the moment is being investigated, but it requires this
            // weird double-signature from each org admin
            signatures.push(signature);
            signatures.push(signature);

            // make sure we do not reuse the user
            client._userContext = null;

            return testUtil.getOrderAdminSubmitter(client, t);
        }).then(function (admin) {
            t.pass('Successfully enrolled user \'admin\' for orderer');
            the_user = admin;

            // sign the config
            var signature = client.signChannelConfig(config);
            t.pass('Successfully signed config update');

            // collect signature from orderer org admin
            // TODO: signature counting against policies on the orderer
            // at the moment is being investigated, but it requires this
            // weird double-signature from each org admin
            signatures.push(signature);
            signatures.push(signature);

            logger.debug('\n***\n done signing \n***\n');

            // build up the create request
            let tx_id = client.newTransactionID(the_user);
            var request = {
                config: config,
                signatures: signatures,
                name: channel,
                orderer: orderer,
                txId: tx_id
            };

            // send to create request to orderer
            return client.createChannel(request);
        })
            .then(function (result) {
                logger.debug('\n***\n completed the create \n***\n');

                logger.debug(' response ::%j', result);
                t.pass('Successfully created the channel.');
                if (result.status && result.status === 'SUCCESS') {
                    return e2eUtils.sleep(5000);
                } else {
                    t.fail('Failed to create the channel. ');
                    t.end();
                }
            }, function (err) {
                t.fail('Failed to create the channel: ' + err.stack ? err.stack : err);
                t.end();
            })
            .then(function (nothing) {
                t.pass('Successfully waited to make sure new channel was created.');
                t.end();
            }, function (err) {
                t.fail('Failed to sleep due to error: ' + err.stack ? err.stack : err);
                t.end();
            });
    });
}

// =====================================================================================================================
// 										Join Channel
// =====================================================================================================================
module.exports.join_channel = function (channel, peerId, ordererId) {
    var logger = utils.getLogger('join-channel');

    // Get Org Name
    var mspid;
    for (let key in ORGS.peers) {
        if (ORGS.peers[key].name === peerId) {
            mspid = ORGS.peers[key].msp_id;
        }
    }

    test('\n\n***** Join Channel *****\n\n', function (t) {
        // override t.end function so it'll always disconnect the event hub
        t.end = (function (context, ehs, f) {
            return function () {
                for (var key in ehs) {
                    var eventhub = ehs[key];
                    if (eventhub && eventhub.isconnected()) {
                        t.comment('Disconnecting the event hub');
                        eventhub.disconnect();
                    }
                }

                f.apply(context, arguments);
            };
        })(t, allEventhubs, t.end);

        joinChannel(channel, ordererId, t)
            .then(function () {
                t.pass(util.format('Successfully joined peers in organization "%s" to the channel', mspid));
                t.end();
            }, function (err) {
                t.fail(util.format('Failed to join peers in organization "%s" to the channel. %s', mspid, err.stack ? err.stack : err));
                t.end();
            })
            .catch(function (err) {
                t.fail('Failed request. ' + err);
                t.end();
            });
    });

    function joinChannel(channel_, ordererId, t) {
        t.comment(util.format('Calling peers in organization "%s" to join the channel', mspid));

        var channel_name = Client.getConfigSetting('CHANNEL_NAME', channel_);
        //
        // Create and configure the test chain
        //
        var client = new Client();
        var channel = client.newChannel(channel_name);

        var orgName = mspid;

        var targets = [],
            eventhubs = [];

        var ordererUrl;
        for (let i in ORGS.orderers) {
            if (ORGS.orderers[i].name === ordererId) {
                ordererUrl = ORGS.orderers[i].api_url;
            }
        }

        var caRootsPath;
        for (let orderer in ORGS.orderers) {
            if (ORGS.orderers[orderer].name === ordererId) {
                caRootsPath = ORGS.orderers[orderer].ca_cert;
            }
        }
        let data = fs.readFileSync(path.join(__dirname, caRootsPath));
        let caroots = Buffer.from(data).toString();
        var genesis_block = null;

        channel.addOrderer(
            client.newOrderer(
                ordererUrl,
                {
                    'pem': caroots,
                    'ssl-target-name-override': ordererId
                }
            )
        );

        return Client.newDefaultKeyValueStore({
            path: testUtil.storePathForOrg(orgName)
        }).then(function (store) {
            client.setStateStore(store);

            return testUtil.getOrderAdminSubmitter(client, t);
        }).then(function (admin) {
            t.pass('Successfully enrolled orderer \'admin\'');
            tx_id = client.newTransactionID();
            let request = {
                txId: tx_id
            };

            return channel.getGenesisBlock(request);
        }).then(function (block) {
            t.pass('Successfully got the genesis block');
            genesis_block = block;

            // get the peer org's admin required to send join channel requests
            client._userContext = null;

            return testUtil.getSubmitter(client, t, true, peerId, orgName);
        }).then(function (admin) {
            t.pass('Successfully enrolled org:' + mspid + ' \'admin\'');
            the_user = admin;


            for (let i in ORGS.peers) {
                if (ORGS.peers[i].name === peerId) {
                    logger.info(' create new peer %s', ORGS.peers[i].api_url);
                    let peerCaCertPath = ORGS.peers[i].ca_cert;
                    let data = fs.readFileSync(path.join(__dirname, peerCaCertPath));
                    let peerCaCert = Buffer.from(data).toString();
                    let peer = client.newPeer(
                        ORGS.peers[i].api_url,
                        {
                            'pem': peerCaCert,
                            'ssl-target-name-override': peerId
                        });
                    channel.addPeer(peer);
                    targets.push(peer);
                    logger.info(' create new eventhub %s', ORGS.peers[i].event_url);
                    let eh = new EventHub(client);
                    eh.setPeerAddr(
                        ORGS.peers[i].event_url,
                        {
                            'pem': peerCaCert,
                            'ssl-target-name-override': peerId
                        }
                    );
                    eh.connect();
                    eventhubs.push(eh);
                    allEventhubs.push(eh);
                }
            }

            var eventPromises = [];
            eventhubs.forEach(function (eh) {
                let txPromise = new Promise(function(resolve, reject) {
                    let handle = setTimeout(reject, 30000);

                    eh.registerBlockEvent(function(block){
                        clearTimeout(handle);

                        // in real-world situations, a peer may have more than one channel so
                        // we must check that this block came from the channel we asked the peer to join
                        if (block.data.data.length === 1) {
                            var data = ab2str(block.data.data[0]);
                            // Config block must only contain one transaction
                            if (data.includes(channel_name)) {
                                t.pass('The new channel has been successfully joined on peer ' + eh.ep._endpoint.addr);
                                resolve();
                            }
                            else {
                                t.fail('The new channel has not been succesfully joined');
                                reject();
                            }
                        }
                    });
                });

                eventPromises.push(txPromise);
            });
            tx_id = client.newTransactionID();
            let request = {
                targets: targets,
                block: genesis_block,
                txId: tx_id
            };
            let sendPromise = channel.joinChannel(request);
            return Promise.all([sendPromise].concat(eventPromises));
        }, function (err) {
            t.fail('Failed to enroll user \'admin\' due to error: ' + err.stack ? err.stack : err);
            throw new Error('Failed to enroll user \'admin\' due to error: ' + err.stack ? err.stack : err);
        })
            .then(function (results) {
                t.comment(util.format('Join Channel R E S P O N S E : %j', results));

                if (results[0] && results[0][0] && results[0][0].response && results[0][0].response.status == 200) {
                    t.pass(util.format('Successfully joined peers in organization %s to join the channel', orgName));
                } else {
                    t.fail(' Failed to join channel');
                    throw new Error('Failed to join channel');
                }
            }, function (err) {
                t.fail('Failed to join channel due to error: ' + err.stack ? err.stack : err);
            });
    }
}
// =====================================================================================================================
// 										Create Marbles Owner
// =====================================================================================================================
module.exports.create_marbles_owner = function(name, cb) {
    var marbles = require('./marbles.js');
    var logger = utils.getLogger('create-owner');


    marbles.enroll_admin(1, function (e, enrollObj ) {
        if (e) {
            logger.error('Failed to enroll user \'admin\'. ', e);
            //cb(e);
        }
        else {
            marbles.create_owners(1, name, function (err, res) {
                if (err){
                    cb(err)
                }
                else {

                    cb(null,res);
                }
            })
        }
    })

}

// =====================================================================================================================
// 										Create Marbles
// =====================================================================================================================
module.exports.create_marbles = function(name, color, size, cb) {
    var marbles = require('./marbles.js');
    var logger = utils.getLogger('create-marbles');


    marbles.enroll_admin(1, function (e, enrollObj ) {
        if (e) {
            logger.error('Failed to enroll user \'admin\'. ');
            //cb(e);
        }
        else {
            marbles.query(enrollObj, function(err, data){
                if (err){
                    logger.error('Failed to retrieve owner list', err);
                    cb(err);
                }
                else {
                    var owner_obj={};
                    for (var i=0; i<data.owners.length; i++){
                        if (data.owners[i].username == name.toLowerCase()) {
                            owner_obj = { id: data.owners[i].id, username: name };
                        }
                    }
                    marbles.create_marbles(owner_obj.id, owner_obj.username, color, size, function(err, res){
                        if (err){
                            cb(err);
                        }
                        else {
                            cb(null,res);
                        }
                    })
                }

            })


        }
    })

}

// =====================================================================================================================
// 										Transfer Marbles
// =====================================================================================================================
module.exports.transfer_marbles = function(initOwner, newOwner, color, size, cb) {
    var marbles = require('./marbles.js');
    var logger = utils.getLogger('transfer-marbles');


    marbles.enroll_admin(1, function (e, enrollObj) {
        if (e) {
            logger.error('Failed to enroll user \'admin\'. ');
            //cb(e);
        }
        else {
            marbles.query(enrollObj, function (err, data) {
                if (err) {
                    logger.error('Failed to retrieve owner list', err);
                    cb(err);
                }
                else {
                    var owner_id, marble_id;
                    for (var i = 0; i < data.owners.length; i++) {
                        if (data.owners[i].username == newOwner.toLowerCase()) {
                            owner_id = data.owners[i].id;
                        }
                    }
                    for (var j = 0; j < data.marbles.length; j++) {
                        if (data.marbles[j].color == color.toLowerCase() && data.marbles[j].size == size && data.marbles[j].owner.username == initOwner.toLowerCase()) {
                            marble_id = data.marbles[j].id;
                        }
                    }
                    marbles.transfer_marble(owner_id, marble_id, function (err, res) {
                        if (err) {
                            cb(err);
                        }
                        else {
                            cb(null, res);
                        }
                    })
                }
            })
        }
    })
}


// =====================================================================================================================
// 										Delete Marbles
// =====================================================================================================================
module.exports.delete_marbles = function(name, color, size, cb) {
    var marbles = require('./marbles.js');
    var logger = utils.getLogger('delete-marbles');


    marbles.enroll_admin(1, function (e, enrollObj) {
        if (e) {
            logger.error('Failed to enroll user \'admin\'. ');
            //cb(e);
        }
        else {
            marbles.query(enrollObj, function (err, data) {
                if (err) {
                    logger.error('Failed to retrieve owner list', err);
                    cb(err);
                }
                else {
                    var marble_id;
                    for (var i = 0; i < data.marbles.length; i++) {
                        if (data.marbles[i].color == color.toLowerCase() && data.marbles[i].size == size && data.marbles[i].owner.username == name.toLowerCase()) {
                            marble_id = data.marbles[i].id;
                        }
                    }
                    marbles.delete_marble(marble_id, function (err, res) {
                        if (err) {
                            cb(err);
                        }
                        else {
                            cb(null, res);
                        }
                    })
                }
            })
        }
    })
}



// =====================================================================================================================
// 										Misc
// =====================================================================================================================


function buildChaincodeProposal(the_user, channel, chaincode_path, chaincodeId, version, upgrade, transientMap, peerId,  aVal, bVal, endorsers) {
    let tx_id = client.newTransactionID(the_user);

    var mspid;
    for (let key in ORGS.peers) {
        if (ORGS.peers[key].name === peerId) {
            mspid = ORGS.peers[key].msp_id;
        }
    }

    // send proposal to endorser
    var request = {
        chaincodePath: chaincode_path,
        chaincodeId: chaincodeId,
        chainId: channel,
        chaincodeVersion: version,
        fcn: 'init',
        args: ['a', aVal, 'b', bVal],
        txId: tx_id
    };
    var endorsement_policy = build_endorsement_policy(endorsers);
    request['endorsement-policy'] = endorsement_policy;


    if(upgrade) {
        // use this call to test the transient map support during chaincode instantiation
        request.transientMap = transientMap;
    }

    return request;
}

function buildMarblesChaincodeProposal(the_user, channel, chaincode_path, chaincodeId, version, upgrade, transientMap, peerId, endorsers) {
    let tx_id = client.newTransactionID(the_user);

    var mspid;
    for (let key in ORGS.peers) {
        if (ORGS.peers[key].name === peerId) {
            mspid = ORGS.peers[key].msp_id;
        }
    }

    // send proposal to endorser
    var request = {
        chaincodePath: chaincode_path,
        chaincodeId: chaincodeId,
        chainId: channel,
        chaincodeVersion: version,
        fcn: 'init',
        args: ['314'],
        txId: tx_id
    };

    var endorsement_policy = build_endorsement_policy(endorsers);
    request['endorsement-policy'] = endorsement_policy;

    if(upgrade) {
        // use this call to test the transient map support during chaincode instantiation
        request.transientMap = transientMap;
    }

    return request;
}

function createBlockchainCredsFile(logger, peerId) {
    var ordererName, ordererUrl, ordererMspid, caName, enrollSecret, caMspid, caUrl, peerUrl, peerEventUrl, peerMspid, peerName;
    for (let i in ORGS.orderers) {
        ordererName = 'fabric-orderer-' + peerId;
        if (ORGS.orderers[i].name === ordererName) {
            ordererUrl = ORGS.orderers[i].api_url;
            ordererMspid = ORGS.orderers[i].msp_id;
        }
    }
    for (let j in ORGS.cas) {
        caName = 'fabric-ca-' + peerId;
        if (ORGS.cas[j].name === caName) {
            enrollSecret = ORGS.cas[j].users_clients[0].enrollSecret;
            caMspid = ORGS.cas[j].msp_id;
            caUrl = ORGS.cas[j].api_url;
        }
    }
    for (let k in ORGS.peers) {
        peerName = 'fabric-peer-' + peerId;
        if (ORGS.peers[k].name === peerName) {
            peerUrl = ORGS.peers[k].api_url;
            peerEventUrl = ORGS.peers[k].event_url;
            peerMspid = ORGS.peers[k].msp_id;
        }
    }

    var appJson = {
        "credentials": {
            "network_id": ORGS.network_id,
            "network_name": ORGS.network_name,
            "orderers": [
                {
                    "name": ordererName,
                    "discovery": ordererUrl,
                    "msp_id": ordererMspid,
                    "tls_certificate": "cert_1"
                }
            ],
            "cas": [
                {
                    "name": caName,
                    "api": caUrl,
                    "msp_id": caMspid,
                    "users": [
                        {
                            "enrollId": "admin",
                            "enrollSecret": enrollSecret
                        }
                    ],
                    "tls_certificate": "cert_1"
                }
            ],
            "peers": [
                {
                    "name": peerName,
                    "discovery": peerUrl,
                    "events": peerEventUrl,
                    "msp_id": peerMspid,
                    "tls_certificate": "cert_1"
                }
            ],
            "app": {
                "channel_id": channel,
                "chaincode_id": chaincodeId,
                "chaincode_version": chaincodeVersion,
                "block_delay": 1000
            },
            "tls_certificates": {
                "cert_1": {
                    "common_name": null,
                    "pem": ORGS.tls_certificates.cert_1.pem
                }
            }
        }
    };

    logger.info('Creating blockchain_creds1.json file');
    var wstream = fs.createWriteStream('./marbles/config/blockchain_creds1.json');
    wstream.write(JSON.stringify(appJson));
    wstream.end();

}

function createManifestYmlFile(logger, appName){
    var manifest = '---\n' +
        'applications:\n' +
        '    - disk_quota: 1024M\n' +
        'name: ' + appName + '\n' +
        'command: "node app.js"\n' +
        'path: "."\n' +
        'instances: 1\n' +
        'memory: 256M';

    logger.info('Creating manifest.yml file');
    var wstream = fs.createWriteStream('./marbles/manifest.yml');
    wstream.write(manifest);
    wstream.end();
}

function sleep_(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function ab2str(buf) {
    return String.fromCharCode.apply(null, new Uint16Array(buf));
}

function build_endorsement_policy(endorsers){

    var peers = endorsers.split(',');
    var identities = [], signed_by = [];
    for (var i=0; i<peers.length; i++){
        signed_by.push({ 'signed-by': i});
        for (var j=0; j<ORGS.peers.length; j++){
            if (ORGS.peers[j].name === peers[i]){
                identities.push({ role: { name: 'member', mspId: ORGS.peers[j].msp_id }})
            }
        }
    }

    var endorsement_policy = {
        identities: identities
    };
    var policy = {};
    var how_many = peers.length + '-of';
    policy[how_many] = signed_by;
    endorsement_policy.policy = policy;

    // ===============================================================
    // 	 Example Policy Output:
    //   'endorsement-policy': {
    //      identities: [
    //          { role: { name: 'member', mspId: mspid }},
    //          { role: { name: 'admin', mspId: mspid}}
    //      ],
    //      policy: {
    //          '2-of': [{ 'signed-by': 0}, { 'signed-by': 1 }]
    //      }
    //  }
    // ===============================================================

    return endorsement_policy;
};
