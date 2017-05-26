#!/bin/bash
mkdir ./logs
rm -f ./logs/marbles_test.log

echo "Installing Marbles" | tee -a "./logs/marbles_test.log"
if node app.js installmarbles -i $2 -v 1 -p 1a | tee -a "./logs/marbles_test.log" | grep -q '# pass  4'; then
	echo "Marbles installed successfully" | tee -a "./logs/marbles_test.log"
else
    echo "Marbles installation failed" | tee -a "./logs/marbles_test.log"
    exit 1
fi

sleep 5

echo "Instantiating Marbles" | tee -a "./logs/marbles_test.log"
if node app.js instantiatemarbles -c $1 -i $2 -z marblesjason -v 1 -p 1a | tee -a "./logs/marbles_test.log" | grep -q '# pass  6'; then
	echo "Marbles instantiation successfully" | tee -a "./logs/marbles_test.log"
else
    echo "Marbles instantiation failed" | tee -a "./logs/marbles_test.log"
    exit 1
fi

sleep 5

echo "Creating user1" | tee -a "./logs/marbles_test.log"
node app.js createmarblesowner -n user1 | tee -a "./logs/marbles_test.log"

echo "Creating user2" | tee -a "./logs/marbles_test.log"
node app.js createmarblesowner -n user2 | tee -a "./logs/marbles_test.log"

echo "Creating user3" | tee -a "./logs/marbles_test.log"
node app.js createmarblesowner -n user3 | tee -a "./logs/marbles_test.log"

if cat ./logs/marbles_test.log | grep -q 'Create owner was successful'; then
	echo "User creation completed successfully" | tee -a "./logs/marbles_test.log"
else
    echo "User creation failed" | tee -a "./logs/marbles_test.log"
    exit 1
fi

echo "Creating small green marble for user1" | tee -a "./logs/marbles_test.log"
node app.js createmarble -n user1 -c green -s small | tee -a "./logs/marbles_test.log"

echo "Creating small yellow marble for user2" | tee -a "./logs/marbles_test.log"
node app.js createmarble -n user2 -c yellow -s small | tee -a "./logs/marbles_test.log"

echo "Creating small blue marble for user2" | tee -a "./logs/marbles_test.log"
node app.js createmarble -n user2 -c blue -s small | tee -a "./logs/marbles_test.log"

echo "Creating large blue marble for user2" | tee -a "./logs/marbles_test.log"
node app.js createmarble -n user2 -c blue -s large | tee -a "./logs/marbles_test.log"

if cat ./logs/marbles_test.log | grep -q 'Create marble was successful'; then
	echo "Marble creation completed successfully" | tee -a "./logs/marbles_test.log"
else
    echo "Marble creation failed" | tee -a "./logs/marbles_test.log"
    exit 1
fi

echo "Transfering small blue marble from user1 to user3" | tee -a "./logs/marbles_test.log"
node app.js transfermarble -f user2 -t user3 -c blue -s small | tee -a "./logs/marbles_test.log"

if cat ./logs/marbles_test.log | grep -q 'Transfer marble was successful'; then
	echo "Transfor marble completed successfully" | tee -a "./logs/marbles_test.log"
else
    echo "Transfer marble failed" | tee -a "./logs/marbles_test.log"
    exit 1
fi

echo "Deleting large blue marble from user2" | tee -a "./logs/marbles_test.log"
node app.js deletemarble -n user2 -c blue -s large | tee -a "./logs/marbles_test.log"

if cat ./logs/marbles_test.log | grep -q 'Delete marble was successful'; then
	echo "Marble deleted successfully" | tee -a "./logs/marbles_test.log"
else
    echo "Marble deletion failed" | tee -a "./logs/marbles_test.log"
    exit 1
fi

echo "All testing completed successfully" | tee -a "./logs/marbles_test.log"

exit 0
