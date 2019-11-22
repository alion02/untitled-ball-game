const timeouts = [], eventName = 'zeroTimeout';
let currTimeout = 0;

addEventListener('message', ({ source, data }) => {
	if (source === window && data === eventName) {
		const [handler, args] = timeouts[currTimeout];
		handler(...args);
		if (++currTimeout === timeouts.length) {
			currTimeout = timeouts.length = 0;
		}
	}
}, true);

export function setZeroTimeout(handler, ...args) {
	timeouts.push([handler, args]);
	postMessage(eventName, '*');
}

export function setResponsiveWhile(whileHandler, pauseHandler, pauseInterval) {
	setResponsiveWhileInternal(whileHandler, pauseHandler, performance.now(), pauseInterval, 1);
}

function setResponsiveWhileInternal(whileHandler, pauseHandler, start, interval, pauseId) {
	const nextPause = start + interval * pauseId;
	while (performance.now() < nextPause) {
		if (!whileHandler()) {
			return;
		}
	}
	pauseHandler();
	setZeroTimeout(setResponsiveWhileInternal, whileHandler, pauseHandler, start, interval, pauseId + 1);
}