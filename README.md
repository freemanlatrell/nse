# Node Simulation Engine (NSE) for Hyperledger Fabric


## Build and Test
To build and test, the following pre-requisites must be installed first:

* node runtime version 6.9.x, note that 7.0 is not supported at this point
* npm tool version 3.10.x

* In the current folder:
    * `npm install` to install dependencies (npm install will also perform a git clone of Marbles to perform marbles transactions later)

* Now you are ready to run the tests:
    * Configure the ServiceCredential information to drive your network.  You can use the ServiceCredentials.json included in the current directory as an example.

    * In the same directory perform  `node nse.js --help` to see a list of commands that can be executed.
    ```
     latrells-mbp:v1.0_sdk_tests latrellfreeman$ node nse.js --help
     info: Returning a new winston logger with default configurations
     Commands:
       installcc           Install Chaincode
       installmarbles      Install Marbles Chaincode
       instantiatecc       Instantiate Chaincode
       instantiatemarbles  Instantiate Marbles Chaincode
       invoke              Invoke transaction
       createmarblesowner  Create Marbles Owner
       createmarble        Create Marble
       transfermarble      Transfer Marble
       deletemarble        Transfer Marble
       query               Query
       createchannel       Create channel
       joinchannel         Join channel

    ```
    * After entering a command you should also perform another --help to see the required flags to be used against each command. `node nse.js installcc --help`
    ```
     latrells-mbp:v1.0_sdk_tests latrellfreeman$ node nse.js installcc --help
     info: Returning a new winston logger with default configurations
     Options:
       --chaincodeId, -i       Chaincode name                     [string] [required]
       --chaincodeVersion, -v  Chaincode version                  [string] [required]
       --chaincodePath, -f     Chaincode path (ex. github.com/example_cc)
                                                                  [string] [required]
       --peerId, -p            2 character peer ID to install chaincode (ex. 1a)
                                                                  [string] [required]
       --help                  Show help                                    [boolean]
    ```

    * Install Chaincode *mychaincode*.  - `node nse.js installcc -i mychaincode -v 1 -p 1a -f chaincode_example02`

    **Note**:  Place your chaincode(s) in the $PWD/src/$CHAINCODEPATH/ folder.  You should create a folder for each chaincode and place the chaincode in that folder.  For example, ./src/chaincode_example02/example_02.go
    * Instantiate Chaincode example - `node nse.js instantiatecc -c mychannel -i mychaincode -v 1 -p 1a -a a,200,b,200`
    * Invoke Transaction example - `node nse.js invoke -c mychannel -i mychaincode -v 1 -p 1a -n 20` (-n flag used to specify the number of invokes to be performed. The default for -n if not specified is 1)
    * Query - `node nse.js query -c mychannel -i mychaincode -v 1 -p 1a`
    * Create Channel - Under Maintenance
    * Join Channel - Under Maintenance



The Node Simulation Engine can also be driven through scripting.  Here are a few sample options:

Execute a run of a specified number of invokes with query against expected result, `./examplecc_test.sh "number of executons" "channel name" "chaincode" "expected query result"`

Execute a long run specifying a duration in seconds,
`./longrun_duration.sh "seconds to execute" "channel name" "chaincode"`

Execute a long run specifying number of executions,
`./longrun_executions.sh "number of executons" "channel name" "chaincode"`
