#!/bin/bash
mkdir ./logs
rm -f ./logs/longrun_executions.log
c=1
while [ $c -le $1 ]
do
    echo "Executing run $c" | tee -a "./logs/longrun_executions.log"
    if node app.js invoke -c $2 -i $3 -v 1 -p 1a -m 1 | tee -a "./logs/longrun_executions.log"| grep -q '# pass  7'; then
                echo "Invoke $c completed successfully" | tee -a "./logs/longrun_executions.log"
        else
                echo "Invoke $c failed" | tee -a "./logs/longrun_executions.log"
	fi				
        (( c++ ))
done
