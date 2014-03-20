#!/bin/bash
numwin=$(wmctrl -l | wc -l)
dolphin
dolphin
if [[ "$(wmctrl -l | wc -l)" -gt "$numwin" ]]; then
	echo "Windows created"
	exit 0
else
	echo "No windows created"
	exit 1
fi
