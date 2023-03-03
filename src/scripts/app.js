// IMPORTS
const pointInSvgPolygon = window.pointInSvgPolygon;
const html2canvas = window.html2canvas;
/*
The following license (BSD-3-Clause) applies to the point-in-svg-polygon module, to the current file (app.js) and to worker.js:
Copyright (c) 2023, Michele Zenoni
Copyright (c) 2016, Ruben Vermeersch
Copyright (c) 2013, Kevin Lindsey
All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

  Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.

  Redistributions in binary form must reproduce the above copyright notice, this
  list of conditions and the following disclaimer in the documentation and/or
  other materials provided with the distribution.

  Neither the name of the {organization} nor the names of its
  contributors may be used to endorse or promote products derived from
  this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

// GLOBAL CONSTANTS AND VARIABLES
const CANVAS_INIT_WIDTH = 1280;
const CANVAS_INIT_HEIGHT = 720;
const IMAGE_MAX_WIDTH = 1280;
const IMAGE_MAX_HEIGHT = 720;
const ASPTECT_RATIO_16_9 = { W: 16, H: 9 };
const ASPTECT_RATIO_9_16 = { W: 9, H: 16 };
const CONTROL_POINTS_N = 4;
const STEPPER_STEPS_N = 5;
const CANVAS_DEFAULT_CLASS = "aspect-video border border-solid border-zinc-400";
const SVGNS = 'http://www.w3.org/2000/svg';
const XLINKSNS = 'http://www.w3.org/1999/xlink';
const WORKER_CDN_URL = "https://cdn.jsdelivr.net/gh/Levyathanus/betsie@cb09aea70c5e8c320596639e5168a0039deb6301/src/scripts/worker.js";

var svgCanvas = null;
var gControlPoints = [];

// GLOBAL HTML ELEMENTS AND SETTINGS
const imgInput = document.querySelector("#dropzone-file");
const dropDiv = document.getElementById("dropzone-parent-div");
const dropText = document.getElementById("dropzone-text");
const dropLabel = document.getElementById("dropzone-parent-label");
const canvas = document.getElementById("canvas");
const canvasDiv = document.getElementById("canvas-parent-div");
const topNote = document.getElementById("top-note");
const bottomNote = document.getElementById("bottom-note");
const resetBtn = document.getElementById("reset-btn");
const editBtn = document.getElementById("edit-btn");
const cutContinueBtn = document.getElementById("cut-image-continue-btn");
const cutSaveBtn = document.getElementById("cut-image-save-btn");
const context = canvas.getContext("2d", { willReadFrequently: true });
const appSection = document.getElementById("app-section");
const cpEnabledSelector = document.getElementById("cp-enabled");
const cpPolyEnabledSelector = document.getElementById("cp-poly-enabled");
const cpSizeSelector = document.getElementById("cp-size");
const cpColorSelector = document.getElementById("cp-color");
const cpTransparencySelector = document.getElementById("cp-transparency");
const bcSizeSelector = document.getElementById("bc-size");
const bcColorSelector = document.getElementById("bc-color");
const bcTransparencySelector = document.getElementById("bc-transparency");
const rotScaleDiv = document.getElementById("roatation-scale-div");
const degRadio = document.getElementById("deg-radio");
const radRadio = document.getElementById("rad-radio");
const rotationInput = document.getElementById("rotation-input");
const scaleInput = document.getElementById("scale-input");
const finalEndBtn = document.getElementById("final-end-btn");
const cancelModBtn = document.getElementById("cancel-btn");
const finalSaveBtn = document.getElementById("final-save-btn");
const finalBackBtn = document.getElementById("final-back-btn");
const finalResetBtn = document.getElementById("final-reset-btn");
const appStepper = document.getElementById("app-stepper");
const gallery = document.getElementById("gallery");
const galleryLink = document.getElementById("gallery-link");
const galleryDiv = document.getElementById("select-image");

canvas.style = "display: none;";
canvas.width = CANVAS_INIT_WIDTH;
canvas.height = CANVAS_INIT_HEIGHT;
setStepperActiveStep(0);

// FUNCTIONS AND CLASSES
class Point {
  constructor(x, y) {
    this.x = Math.round(x);
    this.y = Math.round(y);
  }

  distanceTo(p) {
    return Point.distance(this, p);
  }

  static displayName = "Point";
  static distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }
}

class ControlPoint extends Point {
  static cpCounter = 0;
  constructor(x, y, radius, color = null, opacity = null) {
    super(x, y);
    gControlPoints[ControlPoint.cpCounter] = this;
    this.id = (ControlPoint.cpCounter++);
    this.radius = radius;
    color == null ? this.color = "#0000FF" : this.color = color;
    (opacity == null || opacity < 0 || opacity > 1) ? this.opacity = 0.33 : this.opacity = opacity;
    this.isActive = false;
    this.bCurves = [];
    this.setupSvg();
  }

  setupSvg() {
    this.circle = document.createElementNS(SVGNS, "circle");
    this.circle.setAttributeNS(null, "id", "cp-" + this.id);
    this.circle.setAttributeNS(null, "cx", this.x);
    this.circle.setAttributeNS(null, "cy", this.y);
    this.circle.setAttributeNS(null, "r", this.radius);
    this.circle.setAttributeNS(null, "fill", this.color);
    this.circle.setAttributeNS(null, "fill-opacity", this.opacity);
    this.circle.setAttributeNS(null, "style", "cursor: move;");
  }

  show() {
    if (!this.isActive && svgCanvas != null) {
      svgCanvas.appendChild(this.circle);
      this.isActive = true;
      if (ControlPoint.cpCounter == CONTROL_POINTS_N || (ControlPoint.cpCounter > CONTROL_POINTS_N && ControlPoint.cpCounter % (CONTROL_POINTS_N - 1) == 1)) {
        let cPoints = gControlPoints.slice(-CONTROL_POINTS_N);
        let bezierCurve = ControlPoint.drawCubicBezier(cPoints);
        for (const cp of cPoints) {
          cp.bCurves.push(bezierCurve);
        }
      }
    }
  }

  remove(updatePrev = false) {
    if (this.isActive && svgCanvas != null) {
      svgCanvas.removeChild(this.circle);
      if (this.id != 0 && this.id % (CONTROL_POINTS_N - 1) == 0) {
        if (updatePrev && gControlPoints[this.id - 1] != null && gControlPoints[this.id - 2] != null) {
          gControlPoints[this.id - 1].bCurves = [];
          gControlPoints[this.id - 2].bCurves = [];
        }
        if (gControlPoints[this.id - 3].bCurves.length > 1) {
          gControlPoints[this.id - 3].bCurves.pop();
        }
        for (const bCurve of this.bCurves) { // It should always remove 1 curve (loop for safety)
          svgCanvas.removeChild(bCurve);
        }
      }
      this.bCurves = [];
      this.isActive = false;
      gControlPoints.pop();
      ControlPoint.cpCounter--;
    }
  }

  static drawCubicBezier(controlPoints = []) {
    if (controlPoints.length != CONTROL_POINTS_N) {
      throw new Error(`Cubic Bezier curve needs ${CONTROL_POINTS_N} control points!`);
    }
    let bezierCurve = document.createElementNS(SVGNS, "path");
    bezierCurve.setAttributeNS(null, "d",
      `M${controlPoints[0].x},${controlPoints[0].y} C${controlPoints[1].x},${controlPoints[1].y} ${controlPoints[2].x},${controlPoints[2].y} ${controlPoints[3].x},${controlPoints[3].y}`);
    bezierCurve.setAttributeNS(null, "stroke", bcColorSelector.value);
    bezierCurve.setAttributeNS(null, "stroke-width", bcSizeSelector.value);
    bezierCurve.setAttributeNS(null, "opacity", (100 - bcTransparencySelector.value) / 100);
    bezierCurve.setAttributeNS(null, "fill", "transparent");
    bezierCurve.setAttributeNS(null, "id",
      `bc-${controlPoints[0].id}-${controlPoints[1].id}-${controlPoints[2].id}-${controlPoints[3].id}`);
    svgCanvas.appendChild(bezierCurve);
    return bezierCurve;
  }

  updateBCurve(cpIndex) {
    if (this.bCurves.length > 0) {
      if (cpIndex == 0) { // special case: first cp of the first Bezier curve
        this.bCurves[0].setAttributeNS(null, "d", `M${this.x},${this.y} C${gControlPoints[cpIndex + 1].x},${gControlPoints[cpIndex + 1].y} ${gControlPoints[cpIndex + 2].x},${gControlPoints[cpIndex + 2].y} ${gControlPoints[cpIndex + 3].x},${gControlPoints[cpIndex + 3].y}`);
      } else {
        switch (cpIndex % (CONTROL_POINTS_N - 1)) {
          case 0: // worst case: the cp may be the ending point of a curve (bCurves[0]) and the starting point of the next curve (bCurves[1])
            if (this.bCurves.length > 1) {
              this.bCurves[1].setAttributeNS(null, "d", `M${this.x},${this.y} C${gControlPoints[cpIndex + 1].x},${gControlPoints[cpIndex + 1].y} ${gControlPoints[cpIndex + 2].x},${gControlPoints[cpIndex + 2].y} ${gControlPoints[cpIndex + 3].x},${gControlPoints[cpIndex + 3].y}`);
            }
            this.bCurves[0].setAttributeNS(null, "d", `M${gControlPoints[cpIndex - 3].x},${gControlPoints[cpIndex - 3].y} C${gControlPoints[cpIndex - 2].x},${gControlPoints[cpIndex - 2].y} ${gControlPoints[cpIndex - 1].x},${gControlPoints[cpIndex - 1].y} ${this.x},${this.y}`);
          break;
          case 1:
            this.bCurves[0].setAttributeNS(null, "d", `M${gControlPoints[cpIndex - 1].x},${gControlPoints[cpIndex - 1].y} C${this.x},${this.y} ${gControlPoints[cpIndex + 1].x},${gControlPoints[cpIndex + 1].y} ${gControlPoints[cpIndex + 2].x},${gControlPoints[cpIndex + 2].y}`);
          break;
          case 2:
            this.bCurves[0].setAttributeNS(null, "d", `M${gControlPoints[cpIndex - 2].x},${gControlPoints[cpIndex - 2].y} C${gControlPoints[cpIndex - 1].x},${gControlPoints[cpIndex - 1].y} ${this.x},${this.y} ${gControlPoints[cpIndex + 1].x},${gControlPoints[cpIndex + 1].y}`);
          break;
        }
      }
    }
  }

  static drawControlPolygon() {
    if (gControlPoints.length < 2 || ControlPoint.cpCounter < 2) {
      return;
    }
    let cPolygon = document.createElementNS(SVGNS, "path");
    let path = `M${gControlPoints[0].x},${gControlPoints[0].y}`;
    for (let i = 1; i < gControlPoints.length; i++) {
      path += ` L${gControlPoints[i].x},${gControlPoints[i].y}`;
    }
    cPolygon.setAttributeNS(null, "d", path);
    cPolygon.setAttributeNS(null, "stroke", cpColorSelector.value);
    cPolygon.setAttributeNS(null, "stroke-width", 2);
    cPolygon.setAttributeNS(null, "stroke-dasharray", "4 0 4");
    cPolygon.setAttributeNS(null, "fill", "transparent");
    cPolygon.setAttributeNS(null, "id", "c-polygon");
    svgCanvas.appendChild(cPolygon);
  }

  static updateControlPolygon() {
    let cPolygon = document.getElementById("c-polygon");
    if (gControlPoints.length < 2 || ControlPoint.cpCounter < 2) {
      cPolygon.setAttributeNS(null, "stroke", cpColorSelector.value);
      cPolygon.setAttributeNS(null, "d", "");
    } else {
      let path = `M${gControlPoints[0].x},${gControlPoints[0].y}`;
      for (let i = 1; i < gControlPoints.length; i++) {
        path += ` L${gControlPoints[i].x},${gControlPoints[i].y}`;
      }
      cPolygon.setAttributeNS(null, "stroke", cpColorSelector.value);
      cPolygon.setAttributeNS(null, "d", path);
    }
  }
}

function hideElementById(id) {
  let element = document.getElementById(id);
  if (element != null) {
    element.style.display = "none";
  }
}

function hideElement(element) {
  if (element != null) {
    element.style.display = "none";
  }
}

function showElementById(id) {
  let element = document.getElementById(id);
  if (element != null) {
    let style = element.style;
    if (style != null && style.length > 0) {
      style.removeProperty("display");
    }
  }
}

function showElement(element) {
  if (element != null) {
    let style = element.style;
    if (style != null && style.length > 0) {
      style.removeProperty("display");
    }
  }
}

function disableBtn(button) {
  if (button != null) {
    button.style.cursor = "not-allowed";
    button.disabled = true;
  }
}

function enableBtn(button) {
  if (button != null) {
    button.style.removeProperty("cursor");
    button.disabled = false;
  }
}

async function handleClick(e, inputEl, onLoadFun) {
  const [file] = inputEl.files;
  await handleFileToImage(file, onLoadFun);
}

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

async function handleDrop(e, onLoadFun) {
  const [file] = e.dataTransfer.files;
  await handleFileToImage(file, onLoadFun);
}

function fileToDataUri(field) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      resolve(reader.result);
    });
    reader.readAsDataURL(field);
  });
}

async function handleFileToImage(file, onLoadFun) {
  const image = document.createElement("img");
  image.src = await fileToDataUri(file);
  image.addEventListener("load", () => { onLoadFun(image); });
  return false;
}

function handleDragOn(e) {
  dropText.innerHTML = '<span class="font-semibold">Rilascia l\'immagine...</span>';
}

function handleDragOff(e) {
  dropText.innerHTML = '<span class="font-semibold">Clicca o trascina qui</span> per caricare <br/> l\'immagine (MAX: 1280x720px)';
}

const initialLoad = (image) => {
  showElement(canvas);
  hideElement(dropDiv);
  hideElement(topNote);
  hideElement(bottomNote);
  hideElement(galleryDiv);
  let resetModal = document.getElementById("reset-modal");
  if (resetModal != null) {
    let okBtn = document.getElementById(resetModal.id + "-ok-btn");
    if (okBtn != null) {
      okBtn.addEventListener("click", () => {
        location.reload();
      });
    }
  }
  showElement(resetBtn);
  showElement(editBtn);
  showImage(image);
};

["drag", "dragstart", "dragend", "dragover", "dragenter", "dragleave", "drop"].forEach(event => {
  dropDiv.addEventListener(event, preventDefaults, false);
});

function handleInitalClick(e) {
  preventDefaults(e);
  handleClick(e, imgInput, initialLoad);
}

function handleInitalDrop(e) {
  handleDrop(e, initialLoad);
}

function handleGalleryClick(e) {
  showGallery((e) => {
    hideElement(gallery);
    showElementById("top-section");
    showElementById("app-section");
    hideElement(galleryDiv);
    initialLoad(e.target);
  });
}

imgInput.addEventListener("change", handleInitalClick);
dropDiv.addEventListener("drop", handleInitalDrop);
dropDiv.addEventListener("dragover", handleDragOn);
dropDiv.addEventListener("dragenter", handleDragOn);
dropDiv.addEventListener("dragleave", handleDragOff);
dropDiv.addEventListener("dragend", handleDragOff);
galleryLink.addEventListener("click", handleGalleryClick);

function showGallery(fun) {
  hideElementById("top-section");
  hideElementById("app-section");
  showElement(gallery);
  [...document.getElementsByTagName("img")].forEach(img => {
    if (img.id.startsWith("gallery-image-")) {
      img.addEventListener("click", (e) => fun(e));
    }
  });
}

function getMousePos(canvas, event) {
  let rect = canvas.getBoundingClientRect();
  let scaleX = canvas.width / rect.width;
  let scaleY = canvas.height / rect.height;
  return [
    (event.clientX - rect.left) * scaleX,
    (event.clientY - rect.top) * scaleY
	];
}

function adjustImage(image) {
  let w = image.width;
  let h = image.height;
  let vertical = false;
  if ((w <= IMAGE_MAX_WIDTH && h <= IMAGE_MAX_HEIGHT) ||
      (h <= IMAGE_MAX_WIDTH && w <= IMAGE_MAX_HEIGHT)) {
    return image;
  }
  if (w < h) {
    vertical = true;
  }
	if ((!vertical && w * ASPTECT_RATIO_16_9.H != h * ASPTECT_RATIO_16_9.W) ||
			(vertical && w * ASPTECT_RATIO_9_16.H != h * ASPTECT_RATIO_9_16.W)) {
		// Aspect ratio error
		hideElement(dropDiv);
		hideElement(topNote);
		hideElement(bottomNote);
		hideElement(galleryDiv);
		return null;
	}
  let scaleX = (vertical ? IMAGE_MAX_HEIGHT / w : IMAGE_MAX_WIDTH / w);
  let scaleY = (vertical ? IMAGE_MAX_WIDTH / h : IMAGE_MAX_HEIGHT / h);
  image.width *= scaleX;
  image.height *= scaleY;
  return image;
}

function showImage(originalImage = null) {
  if (originalImage == null) {
    return;
  }
  let image = adjustImage(originalImage);
	if (image == null) {
		hideElement(canvasDiv);
		hideElement(editBtn);
		hideElement(resetBtn);
		try {
      const alert = document.getElementById("aspect-ratio-alert");
      const retryBtn = document.getElementById(alert.id + "-retry-btn");
      const reloadBtn = document.getElementById(alert.id + "-reload-btn");
      retryBtn.addEventListener("click", () => {
        location.reload();
      }, { once: true });
      reloadBtn.addEventListener("click", () => {
        location.reload();
      }, { once: true });
      showElement(alert);
    } catch(error) {
      console.error("Errore gestione immagine di sfondo: " + error);
      location.reload();
    }
	} else {
		const imageWidth = image.width;
  	const imageHeight = image.height;
  	canvas.width = imageWidth;
  	canvas.height = imageHeight;
  	context.drawImage(image, 0, 0, imageWidth, imageHeight);
  	editBtn.addEventListener("click", () => { editImageCut(image) });
	}
}

function setStepperActiveStep(stepN) {
  if (stepN < 0 || stepN > STEPPER_STEPS_N) {
    return;
  }
  const appStepperId = appStepper.id;
  for (let i = 0; i < STEPPER_STEPS_N; i++) {
    let boldI = document.getElementById(appStepperId + "-bold-" + i);
    let iconI = document.getElementById(appStepperId + "-icon-" + i);
    let numI = document.getElementById(appStepperId + "-num-" + i);
    if (i < stepN) {
      boldI.style.fontWeight = "bold";
      iconI.style.display = "";
      numI.style.display = "none";
    } else if (i == stepN) {
      boldI.style.fontWeight = "bold";
      iconI.style.display = "none";
      numI.style.display = "";
    } else {
      boldI.style.fontWeight = "";
      iconI.style.display = "none";
      numI.style.display = "";
    }
  }
}

function editImageCut(originalImage = null) {
  if (originalImage == null) {
    return;
  }
  editBtn.disabled = true;
  setStepperActiveStep(1);
  hideElement(editBtn);
  showElementById("cp-selectors");
  showElementById("cp-selectors-title");
  showElementById("bc-selectors");
  showElementById("bc-selectors-title");
  showElementById("close-cut-btn");

  if (svgCanvas == null) {
    svgCanvas = document.createElementNS(SVGNS, "svg");
    svgCanvas.setAttributeNS(null, "id", "cp-svg");
    svgCanvas.setAttributeNS(null, "width", canvas.width);
    svgCanvas.setAttributeNS(null, "height", canvas.height);
    svgCanvas.setAttributeNS(null, "style", "position: absolute; left: 0; top: 0; z-index: 2;");
    svgCanvas.addEventListener("mouseenter", makeClickable, { once: true });
    svgCanvas.addEventListener("mouseenter", makeDraggable, { once: true });
    canvasDiv.appendChild(svgCanvas);
    const undoBtn = document.getElementById("delete-last-cp-btn");
    const undoCurveBtn = document.getElementById("delete-last-bc-btn");
    const closeCutBtn = document.getElementById("close-cut-btn");
    disableBtn(undoBtn);
    disableBtn(undoCurveBtn);
    disableBtn(closeCutBtn);
    undoBtn.addEventListener("click", () => {
      if (ControlPoint.cpCounter > 0) {
        gControlPoints.at(-1).remove(true);
        if (cpPolyEnabledSelector.checked) {
          if (document.getElementById("c-polygon") == null) {
            ControlPoint.drawControlPolygon();
          } else {
            ControlPoint.updateControlPolygon();
          }
        }
        if (ControlPoint.cpCounter == 0) {
          disableBtn(undoBtn);
        }
        disableBtn(undoCurveBtn);
        disableBtn(closeCutBtn);
        if (ControlPoint.cpCounter == CONTROL_POINTS_N || (ControlPoint.cpCounter > CONTROL_POINTS_N && ControlPoint.cpCounter % (CONTROL_POINTS_N - 1) == 1)) {
          enableBtn(undoCurveBtn);
          enableBtn(closeCutBtn);
        }
      }
    });
    undoCurveBtn.addEventListener("click", () => {
      if (ControlPoint.cpCounter == CONTROL_POINTS_N || (ControlPoint.cpCounter > CONTROL_POINTS_N && ControlPoint.cpCounter % (CONTROL_POINTS_N - 1) == 1)) {
        gControlPoints.slice(-CONTROL_POINTS_N + 1).forEach((cp) => { cp.remove(); });
        if (cpPolyEnabledSelector.checked) {
          if (document.getElementById("c-polygon") == null) {
            ControlPoint.drawControlPolygon();
          } else {
            ControlPoint.updateControlPolygon();
          }
        }
        if (ControlPoint.cpCounter == CONTROL_POINTS_N || (ControlPoint.cpCounter > CONTROL_POINTS_N && ControlPoint.cpCounter % (CONTROL_POINTS_N - 1) == 1)) {
          enableBtn(undoCurveBtn);
          enableBtn(closeCutBtn);
        } else {
          disableBtn(undoCurveBtn);
          disableBtn(closeCutBtn);
        }
      }
    });
    cpEnabledSelector.addEventListener("click", () => {
      let cps = [...document.getElementsByTagNameNS(SVGNS, "circle")];
      if (cps.length > 0) {
        if (cpEnabledSelector.checked) {
          cps.forEach((el) => { showElement(el); });
        } else {
          cps.forEach((el) => { hideElement(el); });
        }
      }
    });
    cpPolyEnabledSelector.addEventListener("click", () => {
      if (cpPolyEnabledSelector.checked) {
        if (document.getElementById("c-polygon") == null) {
          ControlPoint.drawControlPolygon();
        } else {
          ControlPoint.updateControlPolygon();
        }
        showElementById("c-polygon");
      } else {
        hideElementById("c-polygon");
      }
    });
    closeCutBtn.addEventListener("click", () => {
      if (gControlPoints.length >= CONTROL_POINTS_N && ControlPoint.cpCounter >= CONTROL_POINTS_N) {
        let closingLine = document.createElementNS(SVGNS, "path");
        let path = `M${gControlPoints[0].x},${gControlPoints[0].y} L${gControlPoints.at(-1).x},${gControlPoints.at(-1).y}`;
        closingLine.setAttributeNS(null, "d", path);
        closingLine.setAttributeNS(null, "stroke", bcColorSelector.value);
        closingLine.setAttributeNS(null, "stroke-width", bcSizeSelector.value);
        closingLine.setAttributeNS(null, "opacity", (100 - bcTransparencySelector.value) / 100);
        closingLine.setAttributeNS(null, "fill", "transparent");
        closingLine.setAttributeNS(null, "id", "bc-closing-line");
        svgCanvas.appendChild(closingLine);
      }
    });

    function makeClickable(event) {
      var svg = event.target;
      if (svg.id == null || svg.id != svgCanvas.id) {
        throw new Error("Problems making SVG clickable!");
      }
      svg.addEventListener("mousedown", createClickCp);
      function createClickCp(evt) {
        if (evt.target.id == svgCanvas.id) {
          let [x, y] = getMousePos(canvas, evt);
          let p = new Point(x, y);
          for (const cp of gControlPoints) { // Point too close to already existing control point
            if (p.distanceTo(cp) <= 2 * cpSizeSelector.value) {
              return;
            }
          }
          var cp = new ControlPoint(x, y, cpSizeSelector.value, cpColorSelector.value, (100 - cpTransparencySelector.value) / 100);
          cp.show();
          // Update control polygon if visible
          if (cpPolyEnabledSelector.checked) {
            ControlPoint.updateControlPolygon();
          }
          if (ControlPoint.cpCounter >= 1) {
            enableBtn(undoBtn);
          }
          if (ControlPoint.cpCounter == CONTROL_POINTS_N || (ControlPoint.cpCounter > CONTROL_POINTS_N && ControlPoint.cpCounter % (CONTROL_POINTS_N - 1) == 1)) {
            enableBtn(undoCurveBtn);
            enableBtn(closeCutBtn);
          } else {
            disableBtn(undoCurveBtn);
            disableBtn(closeCutBtn);
          }
        }
      }
    }

    function makeDraggable(event) {
      var svg = event.target;
      if (svg.id == null || svg.id != svgCanvas.id) {
        throw new Error("Problems making SVG draggable!");
      }
      var selectedElement = null;
      var offset = { x: 0.0, y: 0.0 };
      svg.addEventListener("mousedown", startDragCp);
      svg.addEventListener("mousemove", dragCp);
      svg.addEventListener("mouseup", endDragCp);
      svg.addEventListener("mouseleave", endDragCp);

      function startDragCp(evt) {
        if (evt.target.id.toLowerCase() != svgCanvas.id && evt.target.id.toLowerCase().slice(0, 2) == "cp") {
          selectedElement = evt.target;
          [offset.x, offset.y] = getMousePos(canvas, evt);
          offset.x -= parseInt(selectedElement.getAttributeNS(null, "cx"));
          offset.y -= parseInt(selectedElement.getAttributeNS(null, "cy"));
        }
      }

      function dragCp(evt) {
        if (selectedElement) {
          evt.preventDefault();
          let coord = { x: 0.0, y: 0.0 };
          [coord.x, coord.y] = getMousePos(canvas, evt);
          let newX = Math.round(coord.x - offset.x);
          let newY = Math.round(coord.y - offset.y);
          // Update circle SVG
          selectedElement.setAttributeNS(null, "cx", newX);
          selectedElement.setAttributeNS(null, "cy", newY);

          // Update ControlPoint
          let index = parseInt(selectedElement.id.slice(3));
          let cp = gControlPoints[index];
          if (cp != null) {
            cp.x = newX;
            cp.y = newY;

            // Update control polygon if visible
            if (cpPolyEnabledSelector.checked) {
              ControlPoint.updateControlPolygon();
            }
            // Update Bezier curves if necessary
            if (cp.bCurves.length > 0) {
              cp.updateBCurve(index);
            }
          }
        }
      }

      function endDragCp(evt) {
        selectedElement = null;
      }
    }
  }

  let closeCutModal = document.getElementById("close-cut-modal");
  if (closeCutModal != null) {
    let okBtn = document.getElementById(closeCutModal.id + "-ok-btn");
    let closeBtn = document.getElementById(closeCutModal.id + "-close-btn");
    let closeXBtn = document.getElementById(closeCutModal.id + "-X-btn");
    if (okBtn != null) {
      okBtn.addEventListener("click", async () => {
        canvasDiv.style.filter = "grayscale(0.8)";
        showElementById("cut-spinner");
        const imageData = await cutImage();
        context.clearRect(0, 0, canvas.width, canvas.height);
        let cutImageCanvas = document.createElement("canvas");
        cutImageCanvas.setAttribute("id", "cut-image-canvas");
        let imageContext = cutImageCanvas.getContext("2d");
        cutImageCanvas.width = imageData.width;
        cutImageCanvas.height = imageData.height;
        imageContext.putImageData(imageData, 0, 0);

        let ctImage = new Image();
        ctImage.id = "cut-image";
        ctImage.src = cutImageCanvas.toDataURL("img/png");
        canvasDiv.replaceChild(cutImageCanvas, canvas);
        let cpSvg = document.getElementById("cp-svg");
        if (cpSvg != null) {
          canvasDiv.removeChild(cpSvg);
        }

        // Update text messages
        topNote.innerText = "Area immagine selezionata:";
        showElement(topNote);
        bottomNote.setAttribute("class", "my-6");
        bottomNote.innerText = "Scegliere se salvare l'area selezionata come nuova immagine prima di continuare o passare direttamente alla fase successiva:";
        showElement(bottomNote);

        // Hide unused components
        hideElementById("cp-selectors-title");
        hideElementById("cp-selectors");
        hideElementById("bc-selectors-title");
        hideElementById("bc-selectors");

        // Remove unused buttons and setup the new ones
        appSection.removeChild(editBtn);
        appSection.removeChild(resetBtn);
        appSection.removeChild(document.getElementById("close-cut-btn"));
        cutSaveBtn.addEventListener("click", () => { downloadImage(ctImage); });

        // Next phase
        cutContinueBtn.addEventListener("click", () => { editImagePaste(ctImage, cutImageCanvas); });
        showElement(cutSaveBtn);
        showElement(cutContinueBtn);

      }, { once: true });
    }
    if (closeBtn != null) {
      closeBtn.addEventListener("click", removeClosingLine);
    }
    if (closeXBtn != null) {
      closeXBtn.addEventListener("click", removeClosingLine);
    }
  }
}

function resetInput(oldImgInput = null) {
  if (oldImgInput == null) {
    oldImgInput = imgInput;
  }
  dropLabel.removeChild(oldImgInput);
  dropLabel.setAttribute("for", "new-dropzone-file");
  let newImgInput = document.createElement("input");
  newImgInput.setAttribute("type", "file");
  newImgInput.setAttribute("id", "new-dropzone-file");
  newImgInput.setAttribute("class", "hidden");
  newImgInput.setAttribute("accept", "image/*");
  dropLabel.appendChild(newImgInput);
  return newImgInput;
}

function editImagePaste(ctImage, ctCanvas, retry = false) {
  let newImgInput = null;
  setStepperActiveStep(2);
  if (!retry) {
    appSection.removeChild(cutContinueBtn);
    appSection.removeChild(cutSaveBtn);
    newImgInput = resetInput();
  } else {
    newImgInput = resetInput(document.getElementById("new-dropzone-file"));
  }
  dropDiv.removeEventListener("drop", handleInitalDrop);
  newImgInput.addEventListener("change", (e) => { preventDefaults(e); handleClick(e, newImgInput, secondLoad); });
  dropDiv.addEventListener("drop", (e) => { handleDrop(e, secondLoad); });
  hideElementById("cut-image-canvas");
  showElement(dropDiv);
  topNote.innerHTML = "<b>Seleziona/trascina</b> l'immagine da usare come sfondo nella sezione qui sotto*:";
  bottomNote.innerHTML = "<b>Nota:</b> le dimensioni massime per l'immagine sono: 1280x720px o 720x1280px. Se l'immagine caricata ha dimensioni superiori verrà riscalata a 1280x720px (formato 16:9) o 720x1280px (formato 9:16). <br/>* Le dimensioni dell'immagine di sfondo devono essere più grandi della porzione ritagliata.";
  showElement(galleryDiv);
  galleryLink.removeEventListener("click", handleGalleryClick);
  galleryLink.addEventListener("click", (e) => { showGallery((e) => {
    hideElement(gallery);
    showElementById("top-section");
    showElementById("app-section");
    hideElement(galleryDiv);
    secondLoad(e.target);
  }); });
  showElement(topNote);
  showElement(bottomNote);
  const secondLoad = (originalImage) => {
    if (originalImage == null) {
      return;
    }
    let image = adjustImage(originalImage);
		if (image == null) {
			hideElement(dropDiv);
      hideElement(canvasDiv);
      hideElement(bottomNote);
      hideElement(topNote);
      hideElement(galleryDiv);
      try {
        const alert = document.getElementById("aspect-ratio-alert");
        const retryBtn = document.getElementById(alert.id + "-retry-btn");
        const reloadBtn = document.getElementById(alert.id + "-reload-btn");
        retryBtn.addEventListener("click", () => {
          hideElement(alert);
          editImagePaste(ctImage, ctCanvas, true);
        }, { once: true });
        reloadBtn.addEventListener("click", () => {
          location.reload();
        }, { once: true });
        showElement(alert);
      } catch(error) {
        console.error("Errore gestione immagine di sfondo: " + error);
        location.reload();
      }
      return;
		}
    const imageWidth = image.width;
    const imageHeight = image.height;
    if (imageWidth < ctCanvas.width || imageHeight < ctCanvas.height) {
      hideElement(dropDiv);
      hideElement(canvasDiv);
      hideElement(bottomNote);
      hideElement(topNote);
      hideElement(galleryDiv);
      try {
        const alert = document.getElementById("bg-image-alert");
        const retryBtn = document.getElementById(alert.id + "-retry-btn");
        const reloadBtn = document.getElementById(alert.id + "-reload-btn");
        retryBtn.addEventListener("click", () => {
          hideElement(alert);
          editImagePaste(ctImage, ctCanvas, true);
        }, { once: true });
        reloadBtn.addEventListener("click", () => {
          location.reload();
        }, { once: true });
        showElement(alert);
      } catch(error) {
        console.error("Errore gestione immagine di sfondo: " + error);
        location.reload();
      }
      return;
    }
    setStepperActiveStep(3);
    hideElement(dropDiv);
    hideElement(topNote);
    hideElement(bottomNote);
    showElement(canvasDiv);
    hideElement(galleryDiv);
    let bgCanvas = document.createElement("canvas");
    bgCanvas.setAttribute("id", "bg-canvas");
    bgCanvas.setAttribute("class", CANVAS_DEFAULT_CLASS);
    bgCanvas.setAttribute("width", CANVAS_INIT_WIDTH);
    bgCanvas.setAttribute("height", CANVAS_INIT_HEIGHT);
    canvasDiv.style.width = "fit-content";
    canvasDiv.style.height = "fit-content";
    canvasDiv.replaceChild(bgCanvas, ctCanvas);
    var bgContext = bgCanvas.getContext("2d");
    bgCanvas.width = imageWidth;
    bgCanvas.height = imageHeight;
    bgContext.drawImage(image, 0, 0, imageWidth, imageHeight);
    ctImage.setAttribute("style", "position: absolute; left: 0; top: 0; z-index: 2; cursor: move; transform-origin: center;");
    canvasDiv.appendChild(ctImage);
    
    // Setup to apply transformations: translation, rotation and scale/homothety
    // 1. translation: make the overlaying image draggable
    var selectedElement = null;
    var offset = { x: 0.0, y: 0.0 };
    var imgCoord = { x: 0.0, y: 0.0 };
    ctImage.addEventListener("mousedown", startDragImg);
    ctImage.addEventListener("mousemove", dragImg);
    ctImage.addEventListener("mouseup", endDragImg);
    ctImage.addEventListener("mouseleave", endDragImg);

    function startDragImg(evt) {
      if (evt.target.id.toLowerCase() == "cut-image") {
        selectedElement = evt.target;
        offset.x = evt.clientX;
        offset.y = evt.clientY;
        imgCoord.x = parseInt(selectedElement.style.left);
        imgCoord.y = parseInt(selectedElement.style.top);
      }
    }

    function dragImg(evt) {
      evt.preventDefault();
      if (selectedElement) {
        let mouseCoord = { x: 0.0, y: 0.0 };
        [mouseCoord.x, mouseCoord.y] = [evt.clientX, evt.clientY];
        let newX = mouseCoord.x - offset.x + imgCoord.x;
        let newY = mouseCoord.y - offset.y + imgCoord.y;
        selectedElement.style.left = newX + "px";
        selectedElement.style.top = newY + "px";
      }
    }

    function endDragImg(evt) {
      selectedElement = null;
    }

    // 2. rotation: make the overlaying image rotate (custom angle rad or deg)
    var isDeg = true;
    degRadio.checked = true;
    radRadio.checked = false;
    var rotateRegex = new RegExp("rotate\\(\\S*\\)");
    degRadio.addEventListener("click", () => {
      isDeg = degRadio.checked;
      rotationInput.value = mulRad2Deg(rotationInput.value);
      rotationInput.setAttribute("step", 1);
    });
    radRadio.addEventListener("click", () => {
      isDeg = !radRadio.checked;
      rotationInput.value = deg2MulRad(rotationInput.value);
      rotationInput.setAttribute("step", 1/180);
    });
    rotationInput.addEventListener("change", () => {
      let currentTransform = ctImage.style.transform;
      if (isDeg) {
        let rotation = 0;
        try {
          rotation = parseInt(rotationInput.value) % 360;
        } catch(error) {
          rotation = 0;
        }
        if (currentTransform != null && currentTransform.length > 0) {
          let transform = currentTransform.replace(rotateRegex, `rotate(${rotation}deg)`);
          if (transform != currentTransform) {
            ctImage.style.transform = transform;
          } else {
            ctImage.style.transform += ` rotate(${rotation}deg)`;
          }
        } else {
          ctImage.style.transform = `rotate(${rotation}deg)`;
        }
      } else {
        let rotation = 0;
        try {
          rotation = parseFloat(rotationInput.value);
        } catch(error) {
          rotation = 0;
        }
        if (currentTransform != null && currentTransform.length > 0) {
          let transform = currentTransform.replace(rotateRegex, `rotate(${rotation * Math.PI}rad)`);
          if (transform != currentTransform) {
            ctImage.style.transform = transform;
          } else {
            ctImage.style.transform += ` rotate(${rotation * Math.PI}rad)`;
          }
        } else {
          ctImage.style.transform = `rotate(${rotation * Math.PI}rad)`;
        }
      }
    });

    // 3. scale: make the overlaying image scalable
    var scaleRegex = new RegExp("scale\\(\\S*\\)");
    scaleInput.addEventListener("change", () => {
      let currentTransform = ctImage.style.transform;
      if (currentTransform != null && currentTransform.length > 0) {
        let transform = currentTransform.replace(scaleRegex, `scale(${parseFloat(scaleInput.value)})`);
        if (transform != currentTransform) {
          ctImage.style.transform = transform;
        } else {
          ctImage.style.transform += ` scale(${parseFloat(scaleInput.value)})`;
        }
      } else {
        ctImage.style.transform = `scale(${parseFloat(scaleInput.value)})`;
      }
    });
    showElement(rotScaleDiv);

    // Setup for saving the final image
    let cancelModal = document.getElementById("cancel-modal");
    if (cancelModal != null) {
      let okBtn = document.getElementById(cancelModal.id + "-ok-btn");
      if (okBtn != null) {
        okBtn.addEventListener("click", () => {
          rotationInput.value = 0;
          scaleInput.value = 1.00;
          ctImage.style.transform = "";
          ctImage.style.left = "0px";
          ctImage.style.top = "0px";
        });
      }
    }
    showElement(cancelModBtn);

    finalEndBtn.addEventListener("click", () => {
      html2canvas(canvasDiv).then(function(finalCanvas) {
        if (finalCanvas != null) {
          finalCanvas.setAttribute("id", "final-canvas");
          hideElement(cancelModBtn);
          hideElement(finalEndBtn);
          hideElement(rotScaleDiv);
          canvasDiv.removeChild(ctImage);
          canvasDiv.replaceChild(finalCanvas, bgCanvas);
          topNote.innerText = "Risultato finale:";
          setStepperActiveStep(4);
          showElement(topNote);
          showElement(finalSaveBtn);
          showElement(finalBackBtn);
          showElement(finalResetBtn);
        }
      });
    });
    showElement(finalEndBtn);

    finalBackBtn.addEventListener("click", () => {
      hideElement(finalSaveBtn);
      hideElement(finalBackBtn);
      hideElement(finalResetBtn);
      hideElement(topNote);
      canvasDiv.appendChild(ctImage);
      canvasDiv.replaceChild(bgCanvas, document.getElementById("final-canvas"));
      setStepperActiveStep(3);
      showElement(cancelModBtn);
      showElement(rotScaleDiv);
      showElement(finalEndBtn);
    });

    finalSaveBtn.addEventListener("click", () => {
      let finalCanvas = document.getElementById("final-canvas");
      let finalImage = new Image();
      finalImage.id = "final-image";
      finalImage.src = finalCanvas.toDataURL("img/png");
      setStepperActiveStep(5);
      downloadImage(finalImage, "modified-image");
    });

    let fResetModal = document.getElementById("final-reset-modal");
    if (fResetModal != null) {
      let okBtn = document.getElementById(fResetModal.id + "-ok-btn");
      if (okBtn != null) {
        okBtn.addEventListener("click", () => {
          location.reload();
        });
      }
    }
  };
  
}

function deg2MulRad(angle) {
  return angle / 180;
}

function mulRad2Deg(angle) {
  return angle * 180;
}

function downloadImage(img, fileName = "image") {
  if (img == null) {
    return;
  }
  let tmpLink = document.createElement("a");
  tmpLink.download = fileName + ".png"
  tmpLink.href = img.getAttribute("src");
  tmpLink.click();
}

function removeClosingLine() {
  let closingLine = document.getElementById("bc-closing-line");
    if (closingLine != null) {
      svgCanvas.removeChild(closingLine);
    }
}

/* const cutImage = () => {
  return new Promise(resolve => setTimeout(
    () => {
      const rawData = new Array();
      const bcIdRegexp = new RegExp("bc-\\d+-\\d+-\\d+-\\d+");
      let closedSplinePaths = [...document.getElementsByTagNameNS(SVGNS, "path")];
      let path = "";
      for (const bcPath of closedSplinePaths) {
        let id = bcPath.getAttributeNS(null, "id");
        if (id != null && (bcIdRegexp.test(id) || id == "bc-closing-line")) {
          path += bcPath.getAttributeNS(null, "d") + " ";
        }
      }

      let tpPoints = [];      
      let minXLeftCp = Math.min(...(gControlPoints.flatMap(cp => { return cp.x; })));
      let maxXRightCp = Math.max(...(gControlPoints.flatMap(cp => { return cp.x; })));
      let minYTopCp = Math.min(...(gControlPoints.flatMap(cp => { return cp.y; })));
      let maxYBottomCp = Math.max(...(gControlPoints.flatMap(cp => { return cp.y; })));
      for (let i = gControlPoints.length - 1; i >= 0; i--) {
        gControlPoints[i].remove(true);
      }
      let segments = pointInSvgPolygon.segments(path);

      for (let y = minYTopCp; y < maxYBottomCp; y++) {
        for (let x = minXLeftCp; x < maxXRightCp; x++) {
          if (!pointInSvgPolygon.isInside([x, y], segments)) {
            if (pointInSvgPolygon.isInside([x - 1, y], segments)) {
              tpPoints.push({ "x": x, "y": y});
            }
            if (pointInSvgPolygon.isInside([x + 1, y], segments)) {
              tpPoints.push({ "x": x, "y": y});
            }
            if (pointInSvgPolygon.isInside([x, y - 1], segments)) {
              tpPoints.push({ "x": x, "y": y});
            }
            if (pointInSvgPolygon.isInside([x, y + 1], segments)) {
              tpPoints.push({ "x": x, "y": y});
            }
          }
        }
      }

      let minXLeftTp = Math.min(...(tpPoints.flatMap(tp => { return tp.x; })));
      let maxXRightTp = Math.max(...(tpPoints.flatMap(tp => { return tp.x; })));
      let minYTopTp = Math.min(...(tpPoints.flatMap(tp => { return tp.y; })));
      let maxYBottomTp = Math.max(...(tpPoints.flatMap(tp => { return tp.y; })));

      for (let y = minYTopTp; y < maxYBottomTp; y++) {
        for (let x = minXLeftTp; x < maxXRightTp; x++) {
          if (pointInSvgPolygon.isInside([x, y], segments)) { // selected area
            rawData.push([...context.getImageData(x, y, 1, 1).data]);
          } else { // transparent points to make ImageData a rect
            rawData.push([0, 0, 0, 0]);
          }
        }
      }
      hideElementById("cut-spinner");
      canvasDiv.style.filter = "none";
      removeClosingLine();
      const width = maxXRightTp - minXLeftTp;
      const height = maxYBottomTp - minYTopTp;
      const data = Uint8ClampedArray.from(rawData.flat());
      resolve(new ImageData(data, width, height));
    }, 0));
}; */

// ref. https://medium.com/@dee_bloo/make-multithreading-easier-with-inline-web-workers-a58723428a42
function createWorker(fn) {
  var blob = new Blob(['self.onmessage = ', fn.toString()], { type: 'text/javascript' });
  var url = URL.createObjectURL(blob);
  
  return new Worker(url);
}

function workerJob(message) {
  const pointInSvgPolygon = message.data.pointInSvgPolygon;
  const rawData = new Array();
	let tpPoints = new Array();
	const minYTopCp = message.data.minYTopCp;
	const maxYBottomCp = message.data.maxYBottomCp;
	const minXLeftCp = message.data.minXLeftCp;
	const maxXRightCp = message.data.maxXRightCp;
	const segments = pointInSvgPolygon.segments(message.data.path);
  for (let y = minYTopCp; y < maxYBottomCp; y++) {
		for (let x = minXLeftCp; x < maxXRightCp; x++) {
			if (!pointInSvgPolygon.isInside([x, y], segments)) {
				if (pointInSvgPolygon.isInside([x - 1, y], segments)) {
					tpPoints.push({ "x": x, "y": y});
				}
				if (pointInSvgPolygon.isInside([x + 1, y], segments)) {
					tpPoints.push({ "x": x, "y": y});
				}
				if (pointInSvgPolygon.isInside([x, y - 1], segments)) {
					tpPoints.push({ "x": x, "y": y});
				}
				if (pointInSvgPolygon.isInside([x, y + 1], segments)) {
					tpPoints.push({ "x": x, "y": y});
				}
			}
		}
	}

	let minXLeftTp = Math.min(...(tpPoints.flatMap(tp => { return tp.x; })));
  let maxXRightTp = Math.max(...(tpPoints.flatMap(tp => { return tp.x; })));
  let minYTopTp = Math.min(...(tpPoints.flatMap(tp => { return tp.y; })));
  let maxYBottomTp = Math.max(...(tpPoints.flatMap(tp => { return tp.y; })));

  for (let y = minYTopTp; y < maxYBottomTp; y++) {
    for (let x = minXLeftTp; x < maxXRightTp; x++) {
      if (pointInSvgPolygon.isInside([x, y], segments)) { // selected area
        rawData.push({"x": x, "y": y, "inside": true });
      } else { // transparent points to make ImageData a rect
        rawData.push({"x": x, "y": y, "inside": false });
      }
    }
  }
	
	const width = maxXRightTp - minXLeftTp;
  const height = maxYBottomTp - minYTopTp;
	self.postMessage({ "rawData": rawData, "width": width, "height": height });
}

const cutImage = () => {
  return new Promise(resolve => {
      const bcIdRegexp = new RegExp("bc-\\d+-\\d+-\\d+-\\d+");
      let closedSplinePaths = [...document.getElementsByTagNameNS(SVGNS, "path")];
      let path = "";
      for (const bcPath of closedSplinePaths) {
        let id = bcPath.getAttributeNS(null, "id");
        if (id != null && (bcIdRegexp.test(id) || id == "bc-closing-line")) {
          path += bcPath.getAttributeNS(null, "d") + " ";
        }
      }  
      let minXLeftCp = Math.min(...(gControlPoints.flatMap(cp => { return cp.x; })));
      let maxXRightCp = Math.max(...(gControlPoints.flatMap(cp => { return cp.x; })));
      let minYTopCp = Math.min(...(gControlPoints.flatMap(cp => { return cp.y; })));
      let maxYBottomCp = Math.max(...(gControlPoints.flatMap(cp => { return cp.y; })));
      for (let i = gControlPoints.length - 1; i >= 0; i--) {
        gControlPoints[i].remove(true);
      }

			if (window.Worker) {
				const worker = createWorker(workerJob);
				worker.postMessage({
					"path": path,
					"minXLeftCp": minXLeftCp,
					"maxXRightCp": maxXRightCp,
					"minYTopCp": minYTopCp,
					"maxYBottomCp": maxYBottomCp,
          "pointInSvgPolygon": pointInSvgPolygon,
				});

				removeClosingLine();
				worker.addEventListener("message", (message) => {
					const rawData = message.data.rawData;
					const rawImageData = new Array();
					const width = message.data.width;
					const height = message.data.height;
					worker.terminate();
					for (const pixel of rawData) {
						if (pixel.inside) {
							rawImageData.push([...context.getImageData(pixel.x, pixel.y, 1, 1).data]);
						} else {
							rawImageData.push([0, 0, 0, 0]);
						}
					}
					hideElementById("cut-spinner");
      		canvasDiv.style.filter = "none";
      		const data = Uint8ClampedArray.from(rawImageData.flat());
      		resolve(new ImageData(data, width, height));
				});
			}
    });
};