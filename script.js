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

let isListening = false;
let isSpeaking = false;
let recognition;
let audioContext;
let analyser;
let audioData;
const AUDIO_BINS = 256;
let synth = window.speechSynthesis;

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
    voiceReactivity: 1.0
};

const simplex = new SimplexNoise();
const screen = document.getElementById("c");
const canvas = document.createElement("canvas");
const screenCtx = screen.getContext("2d");
const ctx = canvas.getContext("2d");
const statusElement = document.getElementById('status');

const time = {
    start: performance.now(),
    elapsed: null,
};

const size = {
    width: window.innerWidth,
    height: window.innerHeight,
};

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

async function setupAudio() {
    try {
        // First check if the API is available
        if (!navigator.mediaDevices) {
            // Try the older webkit prefix
            navigator.mediaDevices = {};
            navigator.mediaDevices.getUserMedia = navigator.webkitGetUserMedia ||
                                                navigator.mozGetUserMedia ||
                                                navigator.msGetUserMedia;
            
            if (!navigator.mediaDevices.getUserMedia) {
                throw new Error('Media devices API not supported');
            }
        }

        // Request audio permission
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false
        });
        
        const source = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = AUDIO_BINS * 2;
        source.connect(analyser);
        audioData = new Uint8Array(analyser.frequencyBinCount);
        updateStatus('Microphone connected!');
    } catch (error) {
        console.error('Audio setup failed:', error);
        updateStatus('Microphone access denied. Please check your browser settings.');
        
        // Show user how to enable microphone
        alert('Please enable microphone access:\n\n' +
              '1. Click the lock/info icon in the address bar\n' +
              '2. Find "Microphone" in the permissions\n' +
              '3. Select "Allow"\n' +
              '4. Refresh the page');
    }
}

function setupSpeechRecognition() {
    try {
        if (!('webkitSpeechRecognition' in window)) {
            throw new Error('Speech recognition not supported');
        }

        recognition = new webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onstart = () => {
            isListening = true;
            document.getElementById('speakButton').classList.add('listening');
            updateStatus('Listening...');
        };

        recognition.onend = () => {
            isListening = false;
            document.getElementById('speakButton').classList.remove('listening');
            updateStatus('');
        };

        recognition.onresult = (event) => {
            const transcript = Array.from(event.results)
                .map(result => result[0])
                .map(result => result.transcript)
                .join('');
            
            if (event.results[0].isFinal) {
                handleUserInput(transcript);
            }
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'not-allowed') {
                updateStatus('Microphone access denied. Please check your browser settings.');
                alert('Please enable microphone access:\n\n' +
                      '1. Click the lock/info icon in the address bar\n' +
                      '2. Find "Microphone" in the permissions\n' +
                      '3. Select "Allow"\n' +
                      '4. Refresh the page');
            } else {
                updateStatus('Error: ' + event.error);
            }
        };
    } catch (error) {
        console.error('Speech recognition setup failed:', error);
        updateStatus('Speech recognition not supported in this browser');
    }
}

async function handleUserInput(text) {
    updateStatus('Processing...');
    
    // This is a simple response system. Replace this with actual AI API calls
    const responses = {
        'hello': 'Hello! How can I help you today?',
        'how are you': 'I\'m doing well, thank you for asking!',
        'what is your name': 'I\'m an AI assistant, nice to meet you!',
        'goodbye': 'Goodbye! Have a great day!',
    };

    let response = responses[text.toLowerCase().trim()] || 
        "I heard you say: " + text + ". However, I'm a demo version and can only respond to basic greetings.";

    speakResponse(response);
}

function speakResponse(text) {
    if (synth.speaking) {
        console.log('Still speaking...');
        return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => {
        isSpeaking = true;
        updateStatus('Speaking...');
    };
    
    utterance.onend = () => {
        isSpeaking = false;
        updateStatus('');
    };

    utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event);
        updateStatus('Error speaking response');
    };

    synth.speak(utterance);
}

function updateStatus(message) {
    statusElement.textContent = message;
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
        gui.add(params, 'voiceReactivity', 0.1, 2);
        gui.add(params, 'blendMode', ["normal", "lighter", "darken", "lighten", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "color", "luminosity", "screen", "multiply"]);
        gui.addColor(params, 'color');
        gui.addColor(params, 'background');
    }

    function render(now) {
        stats.begin();
        time.elapsed = now - time.start;
        
        if (params.trail) {
            screenCtx.fillStyle = `rgba(${params.background.r}, ${params.background.g}, ${params.background.b}, ${params.trailLifeSpan})`;
        } else {
            screenCtx.fillStyle = `rgb(${params.background.r}, ${params.background.g}, ${params.background.b})`;
        }
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
        if ((isListening || isSpeaking) && analyser) {
            analyser.getByteFrequencyData(audioData);
            const bass = average(audioData.slice(0, 10)) / 255;
            const treble = average(audioData.slice(100, 150)) / 255;
            audioMultiplier = 1 + ((bass + treble) * params.voiceReactivity);
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

    const speakButton = document.getElementById('speakButton');
    speakButton.addEventListener('mousedown', async () => {
        try {
            if (!audioContext) await setupAudio();
            if (!recognition) await setupSpeechRecognition();
            recognition.start();
        } catch (error) {
            console.error('Failed to start audio:', error);
            updateStatus('Failed to start audio. Please check permissions.');
        }
    });

    speakButton.addEventListener('mouseup', () => {
        if (recognition) {
            recognition.stop();
            updateStatus('');
        }
    });

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

function average(array) {
    return array.reduce((a, b) => a + b, 0) / array.length;
}

init();