#!/bin/bash
yarn rollup
rsync -a static/ dist/
