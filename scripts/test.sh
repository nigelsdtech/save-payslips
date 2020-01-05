#!/bin/sh

export NODE_APP_INSTANCE="fictionCorp"
export NODE_ENV="test"

mocha -b test/unit
mocha -b test/functional
