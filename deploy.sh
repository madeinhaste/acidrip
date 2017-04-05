#!/bin/bash
./make-dist.sh
rsync -av dist/ madeinhaste:projects/lsd/
