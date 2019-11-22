const Tile = {
	air: 0,
	teleporter: 1,
	wall: 2,
	duplicator: 3,
	charger: 4,
	lampOff: 5,
	lampOn: 6
};

const colors = new Int32Array([
	0xFFFFFFFF,
	0xFFFF00BF,
	0xFF000000,
	0xFF00EF00,
	0xFF007FFF,
	0xFF004F7F,
	0xFF00FFFF
]);

const ballColors = new Int32Array([
	0xFF7F5F00,
	0xFF00007F,
	0xFFFFBF00,
	0xFF0000FF
]);

class Ball {
	constructor(position, facingRight, charged) {
		this.position = position;
		this.facingRight = facingRight;
		this.charged = charged;
	}

	get color() {
		return ballColors[this.facingRight | (this.charged << 1)];
	}

	static fromColor(position, color) {
		const packed = ballColors.indexOf(color);
		return new Ball(position, (packed & 1) !== 0, (packed & 2) !== 0);
	}

	// copy() {
	// 	return new Ball(this.position, this.facingRight, this.charged);
	// }

	// reverse() {
	// 	this.facingRight = !this.facingRight;
	// 	return this;
	// }

	// toggle() {
	// 	this.charged = !this.charged;
	// 	return this;
	// }

	// move(amount) {
	// 	this.position += amount;
	// 	return this;
	// }

	// get offset() {
	// 	return this.facingRight ? 1 : -1;
	// }
}

export class Simulation {
	constructor({ data, width, height }) {
		const px = new Int32Array(data.buffer);
		this.width = width + 2;
		this.height = height + 2;
		this.map = new Uint8Array(this.width * this.height);
		this.balls = [];
		for (let i = 0; i < this.width; ++i) {
			this.map[i] = Tile.wall;
		}
		for (let i = this.width; i < this.map.length - this.width; i += this.width) {
			this.map[i + this.width - 1] = this.map[i] = Tile.wall;
		}
		for (let i = this.map.length - this.width; i < this.map.length; ++i) {
			this.map[i] = Tile.wall;
		}
		for (let y = 0; y < height; ++y) {
			const ai = y * width;
			const bi = y * this.width + this.width + 1;
			for (let x = 0; x < width; ++x) {
				const pos = bi + x;
				const col = px[ai + x];
				const tile = colors.indexOf(col);
				if (tile >= 0) {
					this.map[pos] = tile;
				} else {
					this.balls.push(Ball.fromColor(pos, col));
				}
			}
		}
	}

	// neighbors(position) {
	// 	return [position - this.width, position + this.width, position - 1, position + 1];
	// }

	neighborOffsets() {
		return [-this.width, this.width, -1, 1];
	}

	// isFree(position) {
	// 	const cell = this.map[position];
	// 	return cell === Tile.air || cell >= Ball.exists;
	// }

	// isFreeOrTeleporter(position) {
	// 	const cell = this.map[position];
	// 	return cell <= Tile.teleporter || cell >= Ball.exists;
	// }

	render() {
		const imageData = new ImageData(this.width, this.height);
		const px = new Int32Array(imageData.data.buffer);
		for (let i = 0; i < px.length; ++i) {
			px[i] = colors[this.map[i]];
		}
		for (const ball of this.balls) {
			px[ball.position] = ball.color;
		}
		return imageData;
	}

	step() {
		function compareBalls(a, b) {
			return a.position - b.position || a.facingRight - b.facingRight;
		}

		let balls = this.balls.sort(compareBalls);

		{
			const tempBalls = [];
			const occupied = new Set(balls.map(({ position }) => position));
			for (const ball of balls) {
				tempBalls.push(ball);
				for (const offset of this.neighborOffsets()) {
					switch (this.map[ball.position + offset]) {
						case Tile.duplicator:
							const newPos = ball.position - offset;
							if (this.map[newPos] <= Tile.teleporter && !occupied.has(newPos)) {
								occupied.add(newPos);
								tempBalls.push(new Ball(newPos, ball.facingRight, ball.charged));
							}
							break;
						case Tile.charger:
							ball.charged = !ball.charged;
							break;
						case Tile.lampOff:
							if (ball.charged) {
								this.map[ball.position + offset] = Tile.lampOn;
							}
							break;
						case Tile.lampOn: // TODO: Reduce code duplication
							if (!ball.charged) {
								this.map[ball.position + offset] = Tile.lampOff;
							}
							break;
					}
				}
			}
			balls = tempBalls.sort(compareBalls);
		}

		for (let i = 0; i < 2; ++i)
		{
			const tempBalls = [];
			let runLength, prevAdjacent = null;

			for (let i = 0; i < balls.length; i += runLength) {
				const run = [balls[i]];
				let nextAdjacent = null, nextPrevAdjacent = null;

				{
					const { charged } = run[0];
					for (let j = i + 1; j < balls.length; ++j) {
						const ball = balls[j];
						if (ball.position - run[run.length - 1].position > 1) {
							break;
						}
						if (ball.charged !== charged) {
							nextAdjacent = ball;
							nextPrevAdjacent = balls[j - 1];
							break;
						}
						run.push(ball);
					}
					runLength = run.length;
				}

				{
					const emptyLeft = this.map[Math.ceil(run[0].position - 1)] <= Tile.teleporter, emptyRight = this.map[Math.floor(run[run.length - 1].position + 1)] <= Tile.teleporter;

					if (emptyLeft || emptyRight) {
						let start = 0, end = run.length, split = start;
						if (emptyLeft) {
							if (emptyRight) {
								// No walls - resolve collisions according to conservation of energy
								for (const ball of run) {
									if (!ball.facingRight) {
										++split;
									}
								}
							} else {
								// Wall on right - everyone left
								split = end;
							}
						} // else { /* Wall on left - everyone right */ }

						// TODO: Reduce code duplication
						if (split < end && nextAdjacent && !nextAdjacent.facingRight && nextAdjacent.charged) {
							--end;
						} else if (split > start && prevAdjacent && prevAdjacent.facingRight && prevAdjacent.charged) {
							++start;
						}

						for (let i = start; i < end; ++i) {
							const ball = run[i];
							ball.facingRight = i >= split;
							ball.position += ball.facingRight ? 0.5 : -0.5;
							tempBalls.push(ball);
						}
						// for (let i = start; i < split; ++i) {
						// 	run[i].facingRight = false;
						// }
						// for (let i = split; i < end; ++i) {
						// 	run[i].facingRight = true;
						// }
					} else {
						tempBalls.push(...run);
					}
				}

				prevAdjacent = nextPrevAdjacent;
			}

			balls = tempBalls;

			// for (let i = 0; i < tempBalls.length; ++i) {
			// 	const ball = tempBalls[i];
			// 	const otherBall = tempBalls[i + ball.offset];
			// 	const [dist, sameDir] = otherBall ? [Math.abs(otherBall.position - ball.position), ball.facingRight === otherBall.facingRight] : [Infinity, false];

			// 	if (otherBall && dist <= 1 && !sameDir && !ball.charged && otherBall.charged) {
			// 		continue;
			// 	}
			// 	if (!otherBall || Math.abs(otherBall.position - ball.position) > 1 || (Math.abs()))

			// 	const newBall = ball.copy();
			// 	if ((!otherBall || ball.facingRight === otherBall.facingRight || ball.charged || !otherBall.charged) && Math.abs(otherBall.position - ball.position) >= 1) {
			// 		newBall.move(ball.offset / 2);
			// 	}
			// 	finalBalls.push(newBall);
			// }
		}

		{
			const tempBalls = [];
			const occupied = new Set();

			// function doTeleportationGravityStackingCrushing(ball, gravity = true) {
			// 	let { position } = ball;
			// 	while (this.map[position] === Tile.teleporter) {
			// 		position -= this.width;
			// 	}
			// 	if (gravity && this.isFree(position + this.width)) {
			// 		position += this.width;
			// 	}
				
			// 	const newPos = occupied.has(position) ? occupied.get(position) - this.width : position;
			// 	occupied.set(position, newPos);
			// 	if (newPos === ball.position) {
			// 		if (this.isFree(newPos)) {
			// 			tempBalls.push(ball);
			// 		}
			// 	} else {
			// 		ball.position = newPos;
			// 		doTeleportationGravityStackingCrushing(ball, false);
			// 	}
			// }

			for (let i = balls.length - 1; i >= 0; --i) {
				// doTeleportationGravityStackingCrushing(balls[i]);
				const ball = balls[i];

				// TODO: Prove that we don't need && !occupied.has(ball.position)
				if (this.map[ball.position] !== Tile.teleporter && this.map[ball.position + this.width] === Tile.air) {
					ball.position += this.width;
				}
				
				while (this.map[ball.position] === Tile.teleporter || occupied.has(ball.position)) {
					ball.position -= this.width;
				}
				if (this.map[ball.position] === Tile.air) {
					occupied.add(ball.position);
					tempBalls.push(ball);
				}

				// let { position } = ball;
				// do {
				// 	while (this.map[position] === Tile.teleporter) {
				// 		position -= this.width;
				// 	}
				// 	if (occupied.has(position)) {
				// 		position = occupied.get(position);
				// 	}
				// } while (this.map[position] === Tile.teleporter);

				// if (this.map[position] === Tile.air) {
				// 	occupied.set(position, position - this.width);
				// 	ball.position = position;
				// 	tempBalls.push(ball);
				// }
			}

			this.balls = tempBalls; // Sorting unnecessary
		}

		// TODO: Half-step, destroy uncharged that collide with charged, repeat run detection.

		// {
		// 	let indices = new Set();
		// 	for (let i = 0; i < balls.length; ++i) {
		// 		indices.add(i);
		// 	}

		// 	function interact(a, b, i) {
		// 		if (a.charged === b.charged) {
		// 			if (a.unlocked) {
		// 				a.reverse();
		// 			} else if (b.unlocked) {
		// 				b.reverse().lock();
		// 			}
		// 		}

		// 		if (a.unlocked && (a.charged || !b.charged)) {
		// 			indices.add(i);
		// 		}
		// 	}

		// 	while (indices.length > 0) {
		// 		const tempIndices = indices;
		// 		indices = new Set();
		// 		for (const i of tempIndices) {
		// 			const ball = balls[i];
		// 			const offset = ball.offset;
		// 			const target = ball.position + offset;

		// 			if (this.isAirOrTeleporter(target)) {
		// 				const j = i + offset;
		// 				const otherBall = balls[j];
		// 				if (Math.abs(otherBall.position - ball.position) <= 1 && ball.facingRight ^ otherBall.facingRight && ball.exists && otherBall.exists) {
		// 					interact(a, b, i);
		// 					interact(b, a, j);
		// 				}
		// 			}
		// 		}
		// 	}
		// }

		// function handleCollisionImmediate(i) {
		// 	const ball = balls[i];
		// 	const offset = ball.state & Ball.facingRight ? 1 : -1;

		// 	if (this.isFreeOrTeleporter(ball.position + offset)) {
		// 		const otherBall = balls[i + offset];
		// 		if (otherBall & Ball.exists && (otherBall.state ^ ball.state) & Ball.facingRight) {
		// 			if (ball.canBounce) {
		// 				ball.state ^= Ball.facingRight;
		// 			}
		// 			if (otherBall.canBounce) {
		// 				otherBall.state ^= Ball.facingRight;
		// 			}
		// 			handleCollisionImmediate(i);
		// 			handleCollisionImmediate(i + offset);
		// 		}
		// 	} else if (ball.canBounce) {
		// 		ball.canBounce = false;
		// 		ball.state ^= Ball.facingRight;
		// 		handleCollisionImmediate(i);
		// 	}
		// }

		// for (let i = 0; i < balls.length; ++i) {
		// 	handleCollisionImmediate(i);
		// }

		// function maxLengthHigherThan(arrays, value) {
		// 	for (const array of arrays) {
		// 		if (array.length > value) {
		// 			return true;
		// 		}
		// 	}

		// 	return false;
		// }

		// let resolve = true;
		// while (resolve) {
		// 	resolve = false;

		// 	const resolving = unresolved;
		// 	unresolved = new Map();

		// 	for (const pair of unresolved) {
		// 		let tuples = pair[0];

		// 		if (tuples.length > 1) {
		// 			for (const [, state, ] of tuples) {
		// 				if (state & Ball.charged) {
		// 					tuples = tuples.filter(([, state, ]) => state & Ball.charged);
		// 					break;
		// 				}
		// 			}

		// 			const newPos = pair[1];
		// 			// TODO: Change to 3-step movement (horz + xor, gravity, teleporter)
		// 		}
		// 	}
		// }
	}
}