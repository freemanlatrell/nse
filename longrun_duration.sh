#!/bin/bash
secs=$1
# 1 hour = 3600, 1 day =  86400, 3 days = 259200
SECONDS=0
mkdir ./logs
rm -f ./logs/longrun_duration.log
while (( SECONDS < secs )); do
    echo "Executing invoke at $SECONDS seconds" | tee -a "./logs/longrun_duration.log"
    if node app.js invoke -c $2 -i $3 -v 1 -p 1a -m 1 | tee -a "./logs/longrun_duration.log" | grep -q '# pass  7'; then
                echo "Invoke completed successfully at $SECONDS seconds" | tee -a "./logs/longrun_duration.log"
        else
                echo "Invoke failed at $SECONDS seconds" | tee -a "./logs/longrun_duration.log"
	fi
done
