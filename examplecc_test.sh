#!/bin/bash
mkdir ./logs
rm -f ./logs/examplecc_test.log
c=1
while [ $c -le $1 ]
do
    echo "Executing run $c" | tee -a "./logs/examplecc_test.log"
    if node app.js invoke -c $2 -i $3 -v 1 -p 1a -m 1 | tee -a "./logs/examplecc_test.log" | grep -q '# pass  7'; then
                echo "Run $c execution completed successfully" | tee -a "./logs/examplecc_test.log"
        else
                echo "Node SDK execution failed" | tee -a "./logs/examplecc_test.log"
                exit 1
    fi
        (( c++ ))
    done

sleep 5
	
printf "Query to verify successful execution of tests\n" | tee -a "./logs/examplecc_test.log"
if node app.js query -c $2 -i $3 -v 1 -p 1a | tee -a "./logs/examplecc_test.log" | grep -q $4; then
  echo "Node SDK execution completed successfully" | tee -a "./logs/examplecc_test.log"
else
  echo "Node SDK execution failed" | tee -a "./logs/examplecc_test.log"
  exit 1
fi
exit 0
