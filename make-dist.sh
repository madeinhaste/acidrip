#!/bin/bash

# copy static assets
rsync -a static/ dist/

# build bundles
yarn rollup
yarn gulp
