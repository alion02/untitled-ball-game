import { Simulation } from '/simulation.js';
import { setResponsiveWhile } from '/lib.js';

const canvas = document.querySelector('#display');
const ctx = canvas.getContext('2d');

function updateCanvasSize() {
	const scale = Math.floor(Math.min(window.innerHeight / canvas.height, window.innerWidth / canvas.width));
	canvas.style.width = `${canvas.width * scale}px`;
	canvas.style.height = `${canvas.height * scale}px`;
}

{
	let sim, lastURL;
	function render() {
		ctx.putImageData(sim.render(), -1, -1);
	}

	function loadGame() {
		const img = new Image();
		img.addEventListener('load', function () {
			canvas.width = this.width;
			canvas.height = this.height;

			ctx.drawImage(this, 0, 0);
			updateCanvasSize();

			if (!sim) {
				window.addEventListener('resize', updateCanvasSize);

				const resetBtn = document.querySelector('#reset');
				resetBtn.addEventListener('click', loadGame);
				resetBtn.disabled = false;

				const stepBtn = document.querySelector('#step');
				stepBtn.addEventListener('click', () => {
					sim.step();
					render();
				});
				stepBtn.disabled = false;

				{
					let running = false;
					const playBtn = document.querySelector('#play');
					const pauseBtn = document.querySelector('#pause');
	
					playBtn.addEventListener('click', () => {
						running = true;
						stepBtn.disabled = true;
						playBtn.hidden = true;
						pauseBtn.hidden = false;
						setResponsiveWhile(() => {
							sim.step();
							return running;
						}, render, 20);
					});
	
					pauseBtn.addEventListener('click', () => {
						running = false;
						stepBtn.disabled = false;
						playBtn.hidden = false;
						pauseBtn.hidden = true;
					});

					playBtn.disabled = false;
				}
			}
			sim = new Simulation(ctx.getImageData(0, 0, this.width, this.height));
		});
		img.src = lastURL;
	}

	document.querySelector('#file-selector').addEventListener('change', function () {
		const f = this.files[0];
		if (f) {
			// TODO: Dispose immediately on load (use render() to show the initial image)
			if (lastURL) {
				URL.revokeObjectURL(lastURL);
			}
			lastURL = URL.createObjectURL(f);
			loadGame();
		}
	});
}