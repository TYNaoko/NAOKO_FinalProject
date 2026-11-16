/* FINAL PROJECT Interactive Devices
 * Using Teachable Machine to regonise - "kena", "kiasu", "siao" and "chope". Where the signs trigger a full-screen overlay
 * "nothing" shows a positioning guide while no sign is detected
 */

let classifier;
const imageModelURL = "https://teachablemachine.withgoogle.com/models/eQ5yRxnLR/";

let video;
let flippedVideo;
let label = "";
let confidence = 0;

const CONFIDENCE_THRESHOLD = 0.95;
const HOLD_MS = 800;          // how long a sign must be held
const SHOW_MS = 4000;         // how long a sign overlay stays up

const signs = [
  { name: "kena",  file: "kena.png" },
  { name: "kiasu", file: "kiasu.png" },
  { name: "siao",  file: "siao.png" },
  { name: "chope", file: "chope.png" },
];

// which sign overlay is showing right now
let activeSign = null;
let showUntil = 0;

let guideImg;
const GUIDE_FILE = "nothing.png";
const GUIDE_MAX_ALPHA = 255;  
let lastNothingSeen = 0;
let guideAlpha = 0;           

let viewX, viewY, viewW, viewH;

function preload() {
  classifier = ml5.imageClassifier(imageModelURL + "model.json");

  for (const s of signs) {
    s.img = loadImage(
      s.file,
      () => console.log(s.file + " loaded"),
      () => console.error(s.file + " NOT found, check name and folder")
    );
    s.holdStart = null;
    s.locked = false;
    s.lastSeen = 0;
  }

  guideImg = loadImage(
    GUIDE_FILE,
    () => console.log(GUIDE_FILE + " loaded"),
    () => console.error(GUIDE_FILE + " NOT found, check name and folder")
  );
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  updateLayout();
  video = createCapture(VIDEO);
  video.size(320, 240);
  video.hide();
  cropG = createGraphics(224, 224)
  flippedVideo = ml5.flipImage(video);
  classifyVideo();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  updateLayout();
}


function updateLayout() {
  const ref = signs[0].img;
  const s = min(windowWidth / ref.width, windowHeight / ref.height);
  viewW = ref.width * s;
  viewH = ref.height * s;
  viewX = (windowWidth - viewW) / 2;
  viewY = (windowHeight - viewH) / 2;
}

function draw() {
  background(0);

  // camera fills the shared rectangle, cropped (not stretched) to fit
  const vs = max(viewW / flippedVideo.width, viewH / flippedVideo.height);
  const sw = viewW / vs;
  const sh = viewH / vs;
  image(
    flippedVideo,
    viewX, viewY, viewW, viewH,
    (flippedVideo.width - sw) / 2, (flippedVideo.height - sh) / 2, sw, sh
  );

  const lowerLabel = label.toLowerCase();

  // ---- sign detection ----
  for (const s of signs) {
    const isMatch = lowerLabel.includes(s.name) && confidence >= CONFIDENCE_THRESHOLD;

    if (isMatch) {
      s.lastSeen = millis();
      if (s.holdStart === null) s.holdStart = millis();

      if (millis() - s.holdStart >= HOLD_MS && !s.locked) {
        activeSign = s;
        showUntil = millis() + SHOW_MS;
        s.locked = true;
      }
    } else if (millis() - s.lastSeen > 300) {
      // only reset after the sign has been missing for 300ms
      s.holdStart = null;
      s.locked = false;
    }
  }

  // ---- positioning guide ----
  if (lowerLabel.includes("nothing") && confidence >= CONFIDENCE_THRESHOLD) {
    lastNothingSeen = millis();
  }
  const signOverlayActive = activeSign && millis() < showUntil;
  const guideWanted = millis() - lastNothingSeen < 300 && !signOverlayActive;

  // guide fades instead of flickering
  guideAlpha = lerp(guideAlpha, guideWanted ? GUIDE_MAX_ALPHA : 0, 0.15);

  if (guideAlpha > 2 && guideImg && guideImg.width > 1) {
    push();
    imageMode(CORNER);
    tint(255, guideAlpha);
    image(guideImg, viewX, viewY, viewW, viewH);
    pop();
  }

  if (signOverlayActive && activeSign.img.width > 1) {
    drawOverlay(activeSign.img);
  }

  // ---- live label ----
  push();
  fill(255);
  stroke(0);
  strokeWeight(3);
  textSize(18);
  text(label + "  " + nf(confidence * 100, 1, 0) + "%", 12, 26);
  pop();
}

function drawOverlay(img) {
  const remaining = showUntil - millis();

  let alpha = 255;
  if (remaining > SHOW_MS - 200) {
    alpha = map(remaining, SHOW_MS, SHOW_MS - 200, 0, 255);
  } else if (remaining < 500) {
    alpha = map(remaining, 500, 0, 255, 0);
  }

  push();
  imageMode(CORNER);
  tint(255, alpha);
  image(img, viewX, viewY, viewW, viewH);
  pop();
}

function keyPressed() {
  if (key === "n" || key === "N") {
    lastNothingSeen = millis() + 2000;   // holds guide up for about 2 seconds
    return;
  }
  const i = int(key) - 1;
  if (i >= 0 && i < signs.length) {
    activeSign = signs[i];
    showUntil = millis() + SHOW_MS;
  }
}

function classifyVideo() {
  flippedVideo = ml5.flipImage(video);
  const side = min(flippedVideo.width, flippedVideo.height);
  cropG.image(
    flippedVideo,
    0, 0, 224, 224,
    (flippedVideo.width - side) / 2, (flippedVideo.height - side) / 2, side, side
  );
  classifier.classify(cropG.elt, gotResult);
}f

function gotResult(error, results) {
  if (error) {
    console.error(error);
    return;
  }
  label = results[0].label;
  confidence = results[0].confidence;
  classifyVideo();
}