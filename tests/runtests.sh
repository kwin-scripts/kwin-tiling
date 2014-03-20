#!/bin/bash
TESTS=("test01.sh")

run_test () {
	if bash "$1"; then
		echo "Test $1 successful"
	else
		echo "Test $1 failed with $?"
	fi
}

if ! which wmctrl > /dev/null 2>&1; then
	echo "Please install wmctrl"
	exit 1
fi

for t in ${TESTS[@]}; do
	run_test $t
done
