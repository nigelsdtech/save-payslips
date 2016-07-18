#!/bin/sh

. ~/bin/setup_node_env.sh

appname=${PWD##*/}
export NODE_APP_INSTANCE="${appname}"
export NODE_ENV="test"

mocha -b --check-leaks --recursive test
