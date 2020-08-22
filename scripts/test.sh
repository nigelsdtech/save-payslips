#!/bin/sh

export NODE_APP_INSTANCE="fictionCorp"
export NODE_ENV="test"

mkdir -p logs
mocha -b --recursive --check-leaks test/unit
#mocha -b test/functional
rm -rf logs

