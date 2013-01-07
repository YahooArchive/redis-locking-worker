# redis-locking-worker

## Overview

An event driven implementation of global locks using Redis.

## Install

    npm install redis-locking-worker

## Usage

```js
var RedisLockingWorker = require("redis-locking-worker");

var worker = new RedisLockingWorker({
	"lockKey" : "mylock",
	"statusLevel" : RedisLockingWorker.StatusLevels.Verbose,
	"lockTimeout" : 5000,
	"maxAttempts" : 5
});

worker.on("acquired", function(lastAttempt) {
	if (Math.random() <= SUCCESS_CHANCE) {
		console.log("Completed work successfully, cleaning up!");
		worker.done(lastAttempt);
	} else {
		// oh no, we failed to do work!
		console.log("Failed to do work, hopefully someone else will have better luck!");
	}	
});

worker.on("locked", function() {
	console.log("Someone else acquired the lock");
});

worker.on("error", function(error) {
	console.error("Error from lock: %j", error);
});

worker.on("status", function(message) {
	console.log("Status message from lock: %s", message);
});

worker.acquire();
```

## Options

You can specify a variety of options when creating a new lock instance:

	{
		"client" : null,										/* Instance of a node-redis redis client (https://github.com/mranney/node_redis) */
		"host" : "localhost",									/* Redis host to connect to if a client wasn't explicitly passed in */
		"port" : 6379,											/* Redis port to connect to if a client wasn't explicitly passed in */
		"lockKey" : null,										/* Name of the key to use for this lock, defaults to null, not optional */
		"statusLevel" : RedisLockingWorker.StatusLevel.Normal,	/* Verbosity to use when emitting status events */
		"lockTimeout" : 5000,									/* Time, in milliseconds, before a lock should expire. */
		"maxAttempts" : 5,										/* Number of attempts to complete work before giving up */
	}

## Example

You can run:

    node examples/cluster.js

For an example implementation that uses cluster to fork one worker per CPU core, each one with a 15% chance of completing the "work" successfully. You should see output along these lines:

	Worker 1 failed to do work
	Worker 2 did not acquire lock
	Worker 3 did not acquire lock
	Worker 5 did not acquire lock
	Worker 4 did not acquire lock
	Worker 6 did not acquire lock
	Worker 7 did not acquire lock
	Worker 8 did not acquire lock
	Worker 2 Status message from lock: Checking status of work from attempt #1
	Worker 2 Status message from lock: Work was not completed, trying to reacquire lock for attempt #1
	Worker 2 Status message from lock: Trying to reacquire lock
	Worker 2 Status message from lock: Current attempt count: 1
	Worker 2 Status message from lock: This is attempt #2
	Worker 2 failed to do work
	Worker 3 Status message from lock: Checking status of work from attempt #1
	Worker 3 Status message from lock: Attempt count has been incremented (expected 1, but it's 2), someone else got the lock
	Worker 5 Status message from lock: Checking status of work from attempt #1
	Worker 5 Status message from lock: Attempt count has been incremented (expected 1, but it's 2), someone else got the lock
	Worker 4 Status message from lock: Checking status of work from attempt #1
	Worker 4 Status message from lock: Attempt count has been incremented (expected 1, but it's 2), someone else got the lock
	Worker 6 Status message from lock: Checking status of work from attempt #1
	Worker 6 Status message from lock: Attempt count has been incremented (expected 1, but it's 2), someone else got the lock
	Worker 7 Status message from lock: Checking status of work from attempt #1
	Worker 7 Status message from lock: Attempt count has been incremented (expected 1, but it's 2), someone else got the lock
	Worker 8 Status message from lock: Checking status of work from attempt #1
	Worker 8 Status message from lock: Attempt count has been incremented (expected 1, but it's 2), someone else got the lock
	Worker 3 Status message from lock: Checking status of work from attempt #2
	Worker 3 Status message from lock: Work was not completed, trying to reacquire lock for attempt #2
	Worker 3 Status message from lock: Trying to reacquire lock
	Worker 3 Status message from lock: Current attempt count: 2
	Worker 3 Status message from lock: This is attempt #3
	Worker 3 failed to do work
	Worker 5 Status message from lock: Checking status of work from attempt #2
	Worker 5 Status message from lock: Attempt count has been incremented (expected 2, but it's 3), someone else got the lock
	Worker 4 Status message from lock: Checking status of work from attempt #2
	Worker 4 Status message from lock: Attempt count has been incremented (expected 2, but it's 3), someone else got the lock
	Worker 6 Status message from lock: Checking status of work from attempt #2
	Worker 6 Status message from lock: Attempt count has been incremented (expected 2, but it's 3), someone else got the lock
	Worker 7 Status message from lock: Checking status of work from attempt #2
	Worker 7 Status message from lock: Attempt count has been incremented (expected 2, but it's 3), someone else got the lock
	Worker 8 Status message from lock: Checking status of work from attempt #2
	Worker 8 Status message from lock: Attempt count has been incremented (expected 2, but it's 3), someone else got the lock
	Worker 5 Status message from lock: Checking status of work from attempt #3
	Worker 5 Status message from lock: Work was not completed, trying to reacquire lock for attempt #3
	Worker 5 Status message from lock: Trying to reacquire lock
	Worker 5 Status message from lock: Current attempt count: 3
	Worker 5 Status message from lock: This is attempt #4
	Worker 5 completed work successfully, last attempt? false
	Worker 4 Status message from lock: Checking status of work from attempt #3
	Worker 4 Status message from lock: Work completed successfully by primary process, deleting lock
	Worker 6 Status message from lock: Checking status of work from attempt #3
	Worker 6 Status message from lock: Lock key is gone, someone else completed the work and deleted the lock
	Worker 7 Status message from lock: Checking status of work from attempt #3
	Worker 7 Status message from lock: Lock key is gone, someone else completed the work and deleted the lock
	Worker 8 Status message from lock: Checking status of work from attempt #3
	Worker 8 Status message from lock: Lock key is gone, someone else completed the work and deleted the lock
