#!/bin/bash

# copy static assets
#rsync -a static/ dist/

# build bundles
yarn gulp
yarn rollup
