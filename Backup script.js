class Vec2 {
    x = 0;
    y = 0;

    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    add(vec) {
        this.x += vec.x;
        this.y += vec.y;
        return this;
    }

    subtract(vec) {
        this.x -= vec.x;
        this.y -= vec.y;
        return this;
    }

    set(x, y) {
        this.x = x;
        this.y = y;
        return this;
    }

    normalize() {
        return this.magnitude === 0 ? this : this.divide(this.magnitude);
    }

    get magnitude() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    multiply(value) {
        this.x *= value;
        this.y *= value;
        return this;
    }

    divide(scalar) {
        this.x /= scalar;
        this.y /= scalar;
        return this;
    }

    clone() {
        return new Vec2(this.x, this.y);
    }

    static multiplyVector(vec, scalar) {
        const result = vec.clone();
        result.multiply(scalar);
        return result;
    }

    static substractVectors(vecA, vecB) {
        return new Vec2(vecA.x - vecB.x, vecA.y - vecB.y);
    }

    static randomFloat() {
        return new Vec2(Math.random(), Math.random());
    }
}

const stats = new Stats();
const gui = new dat.GUI({name: "Params"});
gui.closed = false;

const params = {
    blur: 0,
    trail: true,
    trailLifeSpan: 0.2,
    color: {h: 360, s: 1, v: 0.5},
    colorVariation: 20,
    minLifeSpan: 50,
    maxLifeSpan: 100,
    shape: "Circle",
    blendMode: 'normal',
    background: {r: 15, g: 15, b: 15},
    spread: 30,
    randomness: 30,
    particleAddCount: 10,
    size: 7,
    circleSpeed: 1,
    circleRadius: 150,
    audioEnabled: false,
    audioReactivity: 0.5,
    bassInfluence: 1.0,
    trebleInfluence: 0.5
};

const simplex = new SimplexNoise();
const screen = document.getElementById("c");
const canvas = document.createElement("canvas");
const screenCtx = screen.getContext("2d");
const ctx = canvas.getContext("2d");

const time = {
    start: performance.now(),
    elapsed: null,
};

const size = {
    width: window.innerWidth,
    height: window.innerHeight,
};

let audioContext;
let analyser;
let audioData;
const AUDIO_BINS = 256;

class Particle {
    constructor(pos, vel = Vec2.randomFloat()) {
        this.age = 0;
        this.angle = 0;
        this.lifeSpan = randomInt(params.minLifeSpan, params.maxLifeSpan);
        this.isDead = false;
        this.position = pos;
        const velOffset = Vec2.randomFloat().multiply(randomFloat(1, 3));
        this.velocity = vel.multiply(0.25).add(velOffset);
        this.decay = randomFloat(0.95, 0.99);
        this.color = randomInt(params.color.h - params.colorVariation, params.color.h + params.colorVariation);
        this.radius = params.size;
    }

    update() {
        this.age++;
        const noise = simplex.noise3D(this.position.x * 0.005, this.position.y * 0.005, (time.elapsed / 1000) * 0.001);
        const angle = noise * params.randomness;
        const agePer = 1 - (this.age / this.lifeSpan);
        if (this.age > this.lifeSpan) this.isDead = true;
        const noiseVector = new Vec2(Math.cos(angle), Math.sin(angle)).multiply(0.15).multiply(1 - agePer);
        this.velocity.add(noiseVector);
        this.position.add(this.velocity);
        this.velocity.multiply(this.decay);
        this.radius = params.size * agePer;
        this.angle = (noise * 30) * 0.25;
        if (this.radius < 0) this.radius = 0;
    }

    draw() {
        const agePer = 1 - (this.age / this.lifeSpan);
        ctx.fillStyle = `hsl(${this.color}, ${params.color.s * 100}%, ${100 - map(agePer, 0, 1, 0, 80)}%)`;
        ctx.save();
        ctx.beginPath();
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(this.angle);
        const d = this.radius;
        switch (params.shape) {
            case "Triangle":
                ctx.moveTo(0, -d / 2);
                ctx.lineTo(d / 2, d / 2);
                ctx.lineTo(-d / 2, d / 2);
                break;
            case "Square":
                ctx.rect(-d, -d, d, d);
                break;
            default:
                ctx.arc(0, 0, d, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.restore();
    }
}

class ParticleController {
    particles = [];

    addParticles(amount, position) {
        for (let i = 0; i < amount; i++) {
            const randVec = Vec2.randomFloat().multiply(params.spread).add(position);
            this.particles.push(new Particle(randVec));
        }
    }

    update() {
        this.particles = this.particles.filter((value) => {
            return !value.isDead;
        });
        for (let particle of this.particles) {
            particle.update();
        }
    }

    draw() {
        for (let particle of this.particles) {
            particle.draw();
        }
    }
}

function init() {
    document.body.appendChild(stats.domElement);
    let controller = new ParticleController();

    function createControls() {
        gui.add(params, 'blur', 0, 20, 1);
        gui.add(params, 'trail');
        gui.add(params, 'trailLifeSpan', 0.2, 0.9, 0.1);
        gui.add(params, 'size', 1, 30);
        gui.add(params, 'particleAddCount', 1, 40);
        gui.add(params, 'spread', 1, 50);
        gui.add(params, 'randomness', 5, 200);
        gui.add(params, 'colorVariation', 0, 100);
        gui.add(params, 'shape', ['Circle', 'Square', 'Triangle']);
        gui.add(params, 'minLifeSpan', 0, 200);
        gui.add(params, 'maxLifeSpan', 0, 200);
        gui.add(params, 'circleSpeed', 0.1, 3);
        gui.add(params, 'circleRadius', 50, 300);
        gui.add(params, 'blendMode', ["normal", "lighter", "darken", "lighten", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "color", "luminosity", "screen", "multiply"]);
        gui.addColor(params, 'color');
        gui.addColor(params, 'background');
        
        const audioFolder = gui.addFolder('Audio Controls');
        audioFolder.add(params, 'audioReactivity', 0, 2).name('Reactivity');
        audioFolder.add(params, 'bassInfluence', 0, 2).name('Bass Impact');
        audioFolder.add(params, 'trebleInfluence', 0, 2).name('Treble Impact');
        
        const startAudioBtn = { start: function() { setupAudio(); }};
        audioFolder.add(startAudioBtn, 'start').name('Start Audio');
        audioFolder.open();
    }

    function render(now) {
        stats.begin();
        time.elapsed = now - time.start;
        screenCtx.fillStyle = `rgba(${params.background.r}, ${params.background.g}, ${params.background.b}, ${params.trail ? params.trailLifeSpan : 1})`;
        screenCtx.fillRect(0, 0, canvas.width, canvas.height);
        update();
        draw();
        drawToScreen();
        stats.end();
        requestAnimationFrame(render);
    }

    function update() {
        const center = new Vec2(window.innerWidth/2, window.innerHeight/2);
        const t = time.elapsed * 0.001 * params.circleSpeed;
        
        let audioMultiplier = 1;
        if (params.audioEnabled && analyser) {
            analyser.getByteFrequencyData(audioData);
            const bass = average(audioData.slice(0, 10)) / 255;
            const treble = average(audioData.slice(100, 150)) / 255;
            audioMultiplier = 1 + (
                (bass * params.bassInfluence + treble * params.trebleInfluence) * 
                params.audioReactivity
            );
        }
        
        const currentRadius = params.circleRadius * audioMultiplier;
        const x = center.x + Math.cos(t) * currentRadius;
        const y = center.y + Math.sin(t) * currentRadius;
        const position = new Vec2(x, y);
        
        controller.addParticles(params.particleAddCount, position);
        controller.update();
    }

    function draw() {
        ctx.clearRect(0, 0, size.width, size.height);
        controller.draw();
    }

    function drawToScreen() {
        screenCtx.save();
        screenCtx.filter = `blur(${params.blur}px) brightness(115%)`;
        screenCtx.globalCompositeOperation = params.blendMode;
        screenCtx.drawImage(canvas, 0, 0);
        screenCtx.restore();
    }

    function resize() {
        size.width = window.innerWidth;
        size.height = window.innerHeight;
        screen.width = canvas.width = size.width;
        screen.height = canvas.height = size.height;
    }

    window.addEventListener("resize", resize);
    createControls();
    resize();
    requestAnimationFrame(render);
}

function randomFloat(min, max) {
    return min + (Math.random() * (max - min));
}

function randomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return min + Math.floor(Math.random() * (max + 1 - min));
}

function normalize(value, min, max) {
    return (value - min) / (max - min);
}

function interpolate(value, min, max) {
    return min + (max - min) * value;
}

function map(value, min1, max1, min2, max2) {
    return interpolate(normalize(value, min1, max1), min2, max2);
}

async function setupAudio() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const source = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = AUDIO_BINS * 2;
        source.connect(analyser);
        audioData = new Uint8Array(analyser.frequencyBinCount);
        params.audioEnabled = true;
        console.log('Audio setup successful!');
    } catch (error) {
        console.error('Audio setup failed:', error);
        params.audioEnabled = false;
    }
}

function average(array) {
    return array.reduce((a, b) => a + b, 0) / array.length;
}

init();