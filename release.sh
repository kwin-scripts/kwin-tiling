#!/bin/sh
git archive --format=zip -o tiling.kwinscript ${1:-master}
