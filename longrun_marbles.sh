#!/bin/bash
secs=$3
# 1 hour = 3600, 1 day =  86400, 3 days = 259200
SECONDS=0
mkdir ./logs
rm -f ./logs/longrun_marbles.log

echo "Installing Marbles" | tee -a "./logs/longrun_marbles.log"
if node app.js installmarbles -i $2 -v 1 -p 1a | tee -a "./logs/longrun_marbles.log" | grep -q '# pass  4'; then
	echo "Marbles installed successfully" | tee -a "./logs/longrun_marbles.log"
else
    echo "Marbles installation failed" | tee -a "./logs/longrun_marbles.log"
    exit 1
fi

sleep 5

echo "Instantiating Marbles" | tee -a "./logs/longrun_marbles.log"
if node app.js instantiatemarbles -c $1 -i $2 -z marblesjason -v 1 -p 1a | tee -a "./logs/longrun_marbles.log" | grep -q '# pass  6'; then
	echo "Marbles instantiation successfully" | tee -a "./logs/longrun_marbles.log"
else
    echo "Marbles instantiation failed" | tee -a "./logs/longrun_marbles.log"
    exit 1
fi

sleep 5

echo "Creating user1" | tee -a "./logs/longrun_marbles.log"
node app.js createmarblesowner -n user1 | tee -a "./logs/longrun_marbles.log"

echo "Creating user2" | tee -a "./logs/longrun_marbles.log"
node app.js createmarblesowner -n user2 | tee -a "./logs/longrun_marbles.log"

if cat ./logs/longrun_marbles.log | grep -q 'Create owner was successful'; then
	echo "User creation completed successfully" | tee -a "./logs/longrun_marbles.log"
else
    echo "User creation failed" | tee -a "./logs/longrun_marbles.log"
    exit 1
fi

node app.js createmarble -n user1 -c yellow -s small | tee -a "./logs/longrun_marbles.log"
node app.js createmarble -n user2 -c yellow -s small | tee -a "./logs/longrun_marbles.log"

while (( SECONDS < secs )); do
    echo "Creating large blue marble for user2" | tee -a "./logs/longrun_marbles.log"
    node app.js createmarble -n user1 -c blue -s large | tee -a "./logs/longrun_marbles.log"
	node app.js transfermarble -f user1 -t user2 -c blue -s large | tee -a "./logs/longrun_marbles.log"
	node app.js deletemarble -n user2 -c blue -s large | tee -a "./logs/longrun_marbles.log"
	echo "Loop completed at $SECONDS seconds" | tee -a "./logs/longrun_marbles.log"	
done
