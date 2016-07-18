#!/bin/sh

. ~/bin/setup_node_env.sh

export NODE_ENV="test"
export NODE_APP_INSTANCE="save-payslips"

mocha -b --check-leaks --recursive test
