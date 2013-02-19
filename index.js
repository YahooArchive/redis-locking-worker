/*
Copyright (c) 2012, Yahoo! Inc.  All rights reserved.
Copyrights licensed under the MIT License. See the accompanying LICENSE file for terms.
*/

var events = require("events");
var util = require("util");

var redis = require("redis");

var TIMEOUT_DEFAULT = 5000;
var MAX_LOCK_ATTEMPTS_DEFAULT = 5;
var DONE_VALUE = "DONE";

var RedisLockingWorker = module.exports = function RedisLockingWorker(settings) {
	if (!(this instanceof RedisLockingWorker)) {
		return new RedisLockingWorker(settings);
	}

	if (settings.client) {
		this.client = settings.client;
	} else {
		settings.port = settings.port || 6379;
		settings.host = settings.host || "localhost";
		this.client = redis.createClient(settings.port, settings.host);
	}

	this.lockKey = settings.lockKey;

	this.statusLevel = settings.statusLevel || StatusLevels.Normal;
	this.lockTimeout = settings.lockTimeout || TIMEOUT_DEFAULT;
	this.maxAttempts = settings.maxAttempts || MAX_LOCK_ATTEMPTS_DEFAULT;
};
util.inherits(RedisLockingWorker, events.EventEmitter);

var StatusLevels = RedisLockingWorker.StatusLevels = {
	"Verbose" : 1,
	"Normal" : 2
};

RedisLockingWorker.prototype.acquire = function acquire() {
	var that = this;

	this.client.setnx(this.lockKey, 1, function(error, result) {
		if (error) {
			console.error("Attempt to acquire lock failed: %j", error);
			return;
		}

		if (result) {
			that.emit("acquired", false);
		} else {
			that.emit("locked");
			setTimeout(checkLock.bind(that), that.lockTimeout, 1);
		}
	});
};

RedisLockingWorker.prototype.done = function done(lastAttempt) {
	if (lastAttempt) {
		this.client.del(this.lockKey);
	} else {
		this.client.set(this.lockKey, DONE_VALUE);
	}
};

function emitStatus(level, message) {
	if (level >= this.statusLevel) {
		this.emit("status", message);
	}
}

function reacquireLock(attemptCount) {
	var that = this;

	var emit = emitStatus.bind(this, StatusLevels.Normal);
	var emitVerbose = emitStatus.bind(this, StatusLevels.Verbose);
	
	emitVerbose("Trying to reacquire lock");

	this.client.watch(this.lockKey);
	this.client.get(this.lockKey, function(error, currentAttemptCount) {
		if (!currentAttemptCount) {
			emitVerbose("Lock is gone, someone else completed the work!");
			return;
		}

		emitVerbose("Current attempt count: " + currentAttemptCount);

		var attempts = parseInt(currentAttemptCount, 10) + 1;
		emitVerbose("This is attempt #" + attempts);

		if (attempts > that.maxAttempts) {
			emitVerbose("Exceeded maximum attempts, giving up!");
			that.emit("max-attempts");
			that.client.unwatch();
			that.client.expire(that.lockKey, ((that.lockTimeout / 1000) * 2));
			return;
		}

		that.client.multi()
			.set(that.lockKey, attempts)
			.exec(function(error, replies) {
				if (error) {
					that.emit("error", error);
					return;
				}

				if (!replies) {
					// The value changed out from under us, we didn't get the lock!
					that.emit("locked");
					that.client.get(that.lockKey, function(error, currentAttemptCount) {
						setTimeout(checkLock.bind(that), that.lockTimeout, currentAttemptCount);	
					});
				} else {
					that.emit("acquired", attempts === that.maxAttempts);
				}
			});	
	});
}

function checkLock(lastCount) {
	var that = this;

	var emit = emitStatus.bind(this, StatusLevels.Normal);
	var emitVerbose = emitStatus.bind(this, StatusLevels.Verbose);

	emitVerbose("Checking status of work from attempt #" + lastCount);

	this.client.watch(this.lockKey);
	this.client.multi()
		.get(this.lockKey)
		.exec(function(error, replies) {
			if (error) {
				that.emit("error", error);
				return;
			}

			if (!replies) {
				emit("Lock value has changed while we were checking it, someone else got the lock");
				that.client.get(that.lockKey, function(error, newCount) {
					setTimeout(checkLock.bind(that), that.lockTimeout, newCount);
				});
				return;
			}

			var currentCount = replies[0];
			if (currentCount === null) {
				emit("Lock key is gone, someone else completed the work and deleted the lock");
				return;
			} else if (currentCount === DONE_VALUE) {
				emit("Work completed successfully by primary process, deleting lock");
				that.client.del(that.lockKey);
			} else if (currentCount == lastCount) {
				emit("Work was not completed, trying to reacquire lock for attempt #" + currentCount);
				reacquireLock.call(that, currentCount);
			} else {
				emitVerbose("Attempt count has been incremented (expected " + lastCount + ", but it's " + currentCount + "), someone else got the lock");
				setTimeout(checkLock.bind(that), that.lockTimeout, currentCount);
			}
		});
};
