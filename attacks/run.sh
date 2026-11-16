#!/bin/bash
cd "$(dirname "$0")"
mongo=${MONGO_BASE:-mongodb://127.0.0.1:27017}
port=${ATTACK_PORT:-3300}
stamp=$(date +%Y%m%d_%H%M%S)
out=out/$stamp
mkdir -p $out

run() {
  name=$1
  shift
  env PORT=$port MONGO_URL=$mongo/attack_${stamp}_$name "$@" node ../server.js > $out/server_$name.log 2>&1 &
  pid=$!
  sleep 4
  echo $pid > $out/pid
}

stop() {
  kill $(cat $out/pid) 2>/dev/null
  sleep 1
}

run suite RATE_LIMIT_MAX=100000
python3 api_attacks.py http://localhost:$port final $out 1,3,5,6,7,8,4,14 | tee $out/suite.log
stop

run flood
python3 api_attacks.py http://localhost:$port final $out 2 | tee $out/flood.log
stop

echo
grep -h "RESULT" $out/suite.log $out/flood.log
