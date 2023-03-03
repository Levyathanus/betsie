// IMPORTS
const html2canvas = window.html2canvas;
/*
The following license (BSD-3-Clause) applies to the point-in-svg-polygon module, to the current file (app.js):
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
const SVGNS = "http://www.w3.org/2000/svg";
const XLINKSNS = "http://www.w3.org/1999/xlink";

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
    this.id = ControlPoint.cpCounter++;
    this.radius = radius;
    color == null ? (this.color = "#0000FF") : (this.color = color);
    opacity == null || opacity < 0 || opacity > 1
      ? (this.opacity = 0.33)
      : (this.opacity = opacity);
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
      if (
        ControlPoint.cpCounter == CONTROL_POINTS_N ||
        (ControlPoint.cpCounter > CONTROL_POINTS_N &&
          ControlPoint.cpCounter % (CONTROL_POINTS_N - 1) == 1)
      ) {
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
        if (
          updatePrev &&
          gControlPoints[this.id - 1] != null &&
          gControlPoints[this.id - 2] != null
        ) {
          gControlPoints[this.id - 1].bCurves = [];
          gControlPoints[this.id - 2].bCurves = [];
        }
        if (gControlPoints[this.id - 3].bCurves.length > 1) {
          gControlPoints[this.id - 3].bCurves.pop();
        }
        for (const bCurve of this.bCurves) {
          // It should always remove 1 curve (loop for safety)
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
      throw new Error(
        `Cubic Bezier curve needs ${CONTROL_POINTS_N} control points!`
      );
    }
    let bezierCurve = document.createElementNS(SVGNS, "path");
    bezierCurve.setAttributeNS(
      null,
      "d",
      `M${controlPoints[0].x},${controlPoints[0].y} C${controlPoints[1].x},${controlPoints[1].y} ${controlPoints[2].x},${controlPoints[2].y} ${controlPoints[3].x},${controlPoints[3].y}`
    );
    bezierCurve.setAttributeNS(null, "stroke", bcColorSelector.value);
    bezierCurve.setAttributeNS(null, "stroke-width", bcSizeSelector.value);
    bezierCurve.setAttributeNS(
      null,
      "opacity",
      (100 - bcTransparencySelector.value) / 100
    );
    bezierCurve.setAttributeNS(null, "fill", "transparent");
    bezierCurve.setAttributeNS(
      null,
      "id",
      `bc-${controlPoints[0].id}-${controlPoints[1].id}-${controlPoints[2].id}-${controlPoints[3].id}`
    );
    svgCanvas.appendChild(bezierCurve);
    return bezierCurve;
  }

  updateBCurve(cpIndex) {
    if (this.bCurves.length > 0) {
      if (cpIndex == 0) {
        // special case: first cp of the first Bezier curve
        this.bCurves[0].setAttributeNS(
          null,
          "d",
          `M${this.x},${this.y} C${gControlPoints[cpIndex + 1].x},${
            gControlPoints[cpIndex + 1].y
          } ${gControlPoints[cpIndex + 2].x},${gControlPoints[cpIndex + 2].y} ${
            gControlPoints[cpIndex + 3].x
          },${gControlPoints[cpIndex + 3].y}`
        );
      } else {
        switch (cpIndex % (CONTROL_POINTS_N - 1)) {
          case 0: // worst case: the cp may be the ending point of a curve (bCurves[0]) and the starting point of the next curve (bCurves[1])
            if (this.bCurves.length > 1) {
              this.bCurves[1].setAttributeNS(
                null,
                "d",
                `M${this.x},${this.y} C${gControlPoints[cpIndex + 1].x},${
                  gControlPoints[cpIndex + 1].y
                } ${gControlPoints[cpIndex + 2].x},${
                  gControlPoints[cpIndex + 2].y
                } ${gControlPoints[cpIndex + 3].x},${
                  gControlPoints[cpIndex + 3].y
                }`
              );
            }
            this.bCurves[0].setAttributeNS(
              null,
              "d",
              `M${gControlPoints[cpIndex - 3].x},${
                gControlPoints[cpIndex - 3].y
              } C${gControlPoints[cpIndex - 2].x},${
                gControlPoints[cpIndex - 2].y
              } ${gControlPoints[cpIndex - 1].x},${
                gControlPoints[cpIndex - 1].y
              } ${this.x},${this.y}`
            );
            break;
          case 1:
            this.bCurves[0].setAttributeNS(
              null,
              "d",
              `M${gControlPoints[cpIndex - 1].x},${
                gControlPoints[cpIndex - 1].y
              } C${this.x},${this.y} ${gControlPoints[cpIndex + 1].x},${
                gControlPoints[cpIndex + 1].y
              } ${gControlPoints[cpIndex + 2].x},${
                gControlPoints[cpIndex + 2].y
              }`
            );
            break;
          case 2:
            this.bCurves[0].setAttributeNS(
              null,
              "d",
              `M${gControlPoints[cpIndex - 2].x},${
                gControlPoints[cpIndex - 2].y
              } C${gControlPoints[cpIndex - 1].x},${
                gControlPoints[cpIndex - 1].y
              } ${this.x},${this.y} ${gControlPoints[cpIndex + 1].x},${
                gControlPoints[cpIndex + 1].y
              }`
            );
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
  image.addEventListener("load", () => {
    onLoadFun(image);
  });
  return false;
}

function handleDragOn(e) {
  dropText.innerHTML =
    '<span class="font-semibold">Rilascia l\'immagine...</span>';
}

function handleDragOff(e) {
  dropText.innerHTML =
    '<span class="font-semibold">Clicca o trascina qui</span> per caricare <br/> l\'immagine (MAX: 1280x720px)';
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

[
  "drag",
  "dragstart",
  "dragend",
  "dragover",
  "dragenter",
  "dragleave",
  "drop",
].forEach((event) => {
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
  [...document.getElementsByTagName("img")].forEach((img) => {
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
    (event.clientY - rect.top) * scaleY,
  ];
}

function adjustImage(image) {
  let w = image.width;
  let h = image.height;
  let vertical = false;
  if (
    (w <= IMAGE_MAX_WIDTH && h <= IMAGE_MAX_HEIGHT) ||
    (h <= IMAGE_MAX_WIDTH && w <= IMAGE_MAX_HEIGHT)
  ) {
    return image;
  }
  if (w < h) {
    vertical = true;
  }
  if (
    (!vertical && w * ASPTECT_RATIO_16_9.H != h * ASPTECT_RATIO_16_9.W) ||
    (vertical && w * ASPTECT_RATIO_9_16.H != h * ASPTECT_RATIO_9_16.W)
  ) {
    // Aspect ratio error
    hideElement(dropDiv);
    hideElement(topNote);
    hideElement(bottomNote);
    hideElement(galleryDiv);
    return null;
  }
  let scaleX = vertical ? IMAGE_MAX_HEIGHT / w : IMAGE_MAX_WIDTH / w;
  let scaleY = vertical ? IMAGE_MAX_WIDTH / h : IMAGE_MAX_HEIGHT / h;
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
      retryBtn.addEventListener(
        "click",
        () => {
          location.reload();
        },
        { once: true }
      );
      reloadBtn.addEventListener(
        "click",
        () => {
          location.reload();
        },
        { once: true }
      );
      showElement(alert);
    } catch (error) {
      console.error("Errore gestione immagine di sfondo: " + error);
      location.reload();
    }
  } else {
    const imageWidth = image.width;
    const imageHeight = image.height;
    canvas.width = imageWidth;
    canvas.height = imageHeight;
    context.drawImage(image, 0, 0, imageWidth, imageHeight);
    editBtn.addEventListener("click", () => {
      editImageCut(image);
    });
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
    svgCanvas.setAttributeNS(
      null,
      "style",
      "position: absolute; left: 0; top: 0; z-index: 2;"
    );
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
        if (
          ControlPoint.cpCounter == CONTROL_POINTS_N ||
          (ControlPoint.cpCounter > CONTROL_POINTS_N &&
            ControlPoint.cpCounter % (CONTROL_POINTS_N - 1) == 1)
        ) {
          enableBtn(undoCurveBtn);
          enableBtn(closeCutBtn);
        }
      }
    });
    undoCurveBtn.addEventListener("click", () => {
      if (
        ControlPoint.cpCounter == CONTROL_POINTS_N ||
        (ControlPoint.cpCounter > CONTROL_POINTS_N &&
          ControlPoint.cpCounter % (CONTROL_POINTS_N - 1) == 1)
      ) {
        gControlPoints.slice(-CONTROL_POINTS_N + 1).forEach((cp) => {
          cp.remove();
        });
        if (cpPolyEnabledSelector.checked) {
          if (document.getElementById("c-polygon") == null) {
            ControlPoint.drawControlPolygon();
          } else {
            ControlPoint.updateControlPolygon();
          }
        }
        if (
          ControlPoint.cpCounter == CONTROL_POINTS_N ||
          (ControlPoint.cpCounter > CONTROL_POINTS_N &&
            ControlPoint.cpCounter % (CONTROL_POINTS_N - 1) == 1)
        ) {
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
          cps.forEach((el) => {
            showElement(el);
          });
        } else {
          cps.forEach((el) => {
            hideElement(el);
          });
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
      if (
        gControlPoints.length >= CONTROL_POINTS_N &&
        ControlPoint.cpCounter >= CONTROL_POINTS_N
      ) {
        let closingLine = document.createElementNS(SVGNS, "path");
        let path = `M${gControlPoints[0].x},${gControlPoints[0].y} L${
          gControlPoints.at(-1).x
        },${gControlPoints.at(-1).y}`;
        closingLine.setAttributeNS(null, "d", path);
        closingLine.setAttributeNS(null, "stroke", bcColorSelector.value);
        closingLine.setAttributeNS(null, "stroke-width", bcSizeSelector.value);
        closingLine.setAttributeNS(
          null,
          "opacity",
          (100 - bcTransparencySelector.value) / 100
        );
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
          for (const cp of gControlPoints) {
            // Point too close to already existing control point
            if (p.distanceTo(cp) <= 2 * cpSizeSelector.value) {
              return;
            }
          }
          var cp = new ControlPoint(
            x,
            y,
            cpSizeSelector.value,
            cpColorSelector.value,
            (100 - cpTransparencySelector.value) / 100
          );
          cp.show();
          // Update control polygon if visible
          if (cpPolyEnabledSelector.checked) {
            ControlPoint.updateControlPolygon();
          }
          if (ControlPoint.cpCounter >= 1) {
            enableBtn(undoBtn);
          }
          if (
            ControlPoint.cpCounter == CONTROL_POINTS_N ||
            (ControlPoint.cpCounter > CONTROL_POINTS_N &&
              ControlPoint.cpCounter % (CONTROL_POINTS_N - 1) == 1)
          ) {
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
        if (
          evt.target.id.toLowerCase() != svgCanvas.id &&
          evt.target.id.toLowerCase().slice(0, 2) == "cp"
        ) {
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
      okBtn.addEventListener(
        "click",
        async () => {
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
          bottomNote.innerText =
            "Scegliere se salvare l'area selezionata come nuova immagine prima di continuare o passare direttamente alla fase successiva:";
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
          cutSaveBtn.addEventListener("click", () => {
            downloadImage(ctImage);
          });

          // Next phase
          cutContinueBtn.addEventListener("click", () => {
            editImagePaste(ctImage, cutImageCanvas);
          });
          showElement(cutSaveBtn);
          showElement(cutContinueBtn);
        },
        { once: true }
      );
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
  newImgInput.addEventListener("change", (e) => {
    preventDefaults(e);
    handleClick(e, newImgInput, secondLoad);
  });
  dropDiv.addEventListener("drop", (e) => {
    handleDrop(e, secondLoad);
  });
  hideElementById("cut-image-canvas");
  showElement(dropDiv);
  topNote.innerHTML =
    "<b>Seleziona/trascina</b> l'immagine da usare come sfondo nella sezione qui sotto*:";
  bottomNote.innerHTML =
    "<b>Nota:</b> le dimensioni massime per l'immagine sono: 1280x720px o 720x1280px. Se l'immagine caricata ha dimensioni superiori verrà riscalata a 1280x720px (formato 16:9) o 720x1280px (formato 9:16). <br/>* Le dimensioni dell'immagine di sfondo devono essere più grandi della porzione ritagliata.";
  showElement(galleryDiv);
  galleryLink.removeEventListener("click", handleGalleryClick);
  galleryLink.addEventListener("click", (e) => {
    showGallery((e) => {
      hideElement(gallery);
      showElementById("top-section");
      showElementById("app-section");
      hideElement(galleryDiv);
      secondLoad(e.target);
    });
  });
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
        retryBtn.addEventListener(
          "click",
          () => {
            hideElement(alert);
            editImagePaste(ctImage, ctCanvas, true);
          },
          { once: true }
        );
        reloadBtn.addEventListener(
          "click",
          () => {
            location.reload();
          },
          { once: true }
        );
        showElement(alert);
      } catch (error) {
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
        retryBtn.addEventListener(
          "click",
          () => {
            hideElement(alert);
            editImagePaste(ctImage, ctCanvas, true);
          },
          { once: true }
        );
        reloadBtn.addEventListener(
          "click",
          () => {
            location.reload();
          },
          { once: true }
        );
        showElement(alert);
      } catch (error) {
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
    ctImage.setAttribute(
      "style",
      "position: absolute; left: 0; top: 0; z-index: 2; cursor: move; transform-origin: center;"
    );
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
      rotationInput.setAttribute("step", 1 / 180);
    });
    rotationInput.addEventListener("change", () => {
      let currentTransform = ctImage.style.transform;
      if (isDeg) {
        let rotation = 0;
        try {
          rotation = parseInt(rotationInput.value) % 360;
        } catch (error) {
          rotation = 0;
        }
        if (currentTransform != null && currentTransform.length > 0) {
          let transform = currentTransform.replace(
            rotateRegex,
            `rotate(${rotation}deg)`
          );
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
        } catch (error) {
          rotation = 0;
        }
        if (currentTransform != null && currentTransform.length > 0) {
          let transform = currentTransform.replace(
            rotateRegex,
            `rotate(${rotation * Math.PI}rad)`
          );
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
        let transform = currentTransform.replace(
          scaleRegex,
          `scale(${parseFloat(scaleInput.value)})`
        );
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
          scaleInput.value = 1.0;
          ctImage.style.transform = "";
          ctImage.style.left = "0px";
          ctImage.style.top = "0px";
        });
      }
    }
    showElement(cancelModBtn);

    finalEndBtn.addEventListener("click", () => {
      html2canvas(canvasDiv).then(function (finalCanvas) {
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
  tmpLink.download = fileName + ".png";
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
  var blob = new Blob(["self.onmessage = ", fn.toString()], {
    type: "text/javascript",
  });
  var url = URL.createObjectURL(blob);

  return new Worker(url);
}

function workerJob(message) {
  var bezier3Type = "bezier3";
  var lineType = "line";

  var mathAbs = Math.abs;
  var mathAsin = Math.asin;
  var mathCos = Math.cos;
  var mathMax = Math.max;
  var mathMin = Math.min;
  var mathPi = Math.PI;
  var mathPow = Math.pow;
  var mathSin = Math.sin;
  var mathSqrt = Math.sqrt;
  var mathTan = Math.tan;

  var tolerance = 1e-6;

  function x(p) {
    return p[0];
  }

  function y(p) {
    return p[1];
  }

  function splitArray(n) {
    return function (array) {
      return array.reduce(function (m, v, i, l) {
        if (i % n) {
          return m;
        }

        return m.concat([l.slice(i, i + n)]);
      }, []);
    };
  }

  var splitArray3 = splitArray(3);
  var splitArray2 = splitArray(2);

  function toFloat(v) {
    return parseFloat(v, 10);
  }

  function coordEqual(c1, c2) {
    return Math.abs(x(c1) - x(c2)) < 1e-10 && Math.abs(y(c1) - y(c2)) < 1e-10;
  }

  function coordMax(c1, c2) {
    return [mathMax(x(c1), x(c2)), mathMax(y(c1), y(c2))];
  }

  function coordMin(c1, c2) {
    return [mathMin(x(c1), x(c2)), mathMin(y(c1), y(c2))];
  }

  function coordMultiply(c, f) {
    return [x(c) * f, y(c) * f];
  }

  function coordAdd(c1, c2) {
    return [x(c1) + x(c2), y(c1) + y(c2)];
  }

  function coordDot(c1, c2) {
    return x(c1) * x(c2) + y(c1) * y(c2);
  }

  function coordLerp(c1, c2, t) {
    return [x(c1) + (x(c2) - x(c1)) * t, y(c1) + (y(c2) - y(c1)) * t];
  }

  function linearRoot(p2, p1) {
    var results = [];

    var a = p2;
    if (a !== 0) {
      results.push(-p1 / p2);
    }

    return results;
  }

  function quadRoots(p3, p2, p1) {
    var results = [];

    if (mathAbs(p3) <= tolerance) {
      return linearRoot(p2, p1);
    }

    var a = p3;
    var b = p2 / a;
    var c = p1 / a;
    var d = b * b - 4 * c;
    if (d > 0) {
      var e = mathSqrt(d);
      results.push(0.5 * (-b + e));
      results.push(0.5 * (-b - e));
    } else if (d === 0) {
      results.push(0.5 * -b);
    }

    return results;
  }

  function cubeRoots(p4, p3, p2, p1) {
    if (mathAbs(p4) <= tolerance) {
      return quadRoots(p3, p2, p1);
    }

    var results = [];

    var c3 = p4;
    var c2 = p3 / c3;
    var c1 = p2 / c3;
    var c0 = p1 / c3;

    var a = (3 * c1 - c2 * c2) / 3;
    var b = (2 * c2 * c2 * c2 - 9 * c1 * c2 + 27 * c0) / 27;
    var offset = c2 / 3;
    var discrim = (b * b) / 4 + (a * a * a) / 27;
    var halfB = b / 2;

    /* This should be here, but there's a typo in the original code (disrim =
     * 0) which causes it not to be present there. Ironically, adding the
     * following code breaks the algorithm, whereas leaving it out makes it
     * work correctly.
    if (mathAbs(discrim) <= tolerance) {
        discrim = 0;
    }
    */

    var tmp;
    if (discrim > 0) {
      var e = mathSqrt(discrim);
      tmp = -halfB + e;
      var root = tmp >= 0 ? mathPow(tmp, 1 / 3) : -mathPow(-tmp, 1 / 3);
      tmp = -halfB - e;
      if (tmp >= 0) {
        root += mathPow(tmp, 1 / 3);
      } else {
        root -= mathPow(-tmp, 1 / 3);
      }
      results.push(root - offset);
    } else if (discrim < 0) {
      var distance = mathSqrt(-a / 3);
      var angle = Math.atan2(mathSqrt(-discrim), -halfB) / 3;
      var cos = mathCos(angle);
      var sin = mathSin(angle);
      var sqrt3 = mathSqrt(3);
      results.push(2 * distance * cos - offset);
      results.push(-distance * (cos + sqrt3 * sin) - offset);
      results.push(-distance * (cos - sqrt3 * sin) - offset);
    } else {
      if (halfB >= 0) {
        tmp = -mathPow(halfB, 1 / 3);
      } else {
        tmp = mathPow(-halfB, 1 / 3);
      }
      results.push(2 * tmp - offset);
      results.push(-tmp - offset);
    }

    return results;
  }

  function arcToCurve(cp1, rx, ry, angle, large_arc, sweep, cp2, recurse) {
    function rotate(cx, cy, r) {
      var cos = mathCos(r);
      var sin = mathSin(r);
      return [cx * cos - cy * sin, cx * sin + cy * cos];
    }

    var x1 = x(cp1);
    var y1 = y(cp1);
    var x2 = x(cp2);
    var y2 = y(cp2);

    var rad = (mathPi / 180) * (+angle || 0);
    var f1 = 0;
    var f2 = 0;
    var cx;
    var cy;
    var res = [];

    if (!recurse) {
      var xy = rotate(x1, y1, -rad);
      x1 = x(xy);
      y1 = y(xy);
      xy = rotate(x2, y2, -rad);
      x2 = x(xy);
      y2 = y(xy);

      var px = (x1 - x2) / 2;
      var py = (y1 - y2) / 2;
      var h = (px * px) / (rx * rx) + (py * py) / (ry * ry);
      if (h > 1) {
        h = mathSqrt(h);
        rx = h * rx;
        ry = h * ry;
      }

      var rx2 = rx * rx;
      var ry2 = ry * ry;

      var k =
        (large_arc === sweep ? -1 : 1) *
        mathSqrt(
          mathAbs(
            (rx2 * ry2 - rx2 * py * py - ry2 * px * px) /
              (rx2 * py * py + ry2 * px * px)
          )
        );

      cx = (k * rx * py) / ry + (x1 + x2) / 2;
      cy = (k * -ry * px) / rx + (y1 + y2) / 2;
      f1 = mathAsin(((y1 - cy) / ry).toFixed(9));
      f2 = mathAsin(((y2 - cy) / ry).toFixed(9));

      f1 = x1 < cx ? mathPi - f1 : f1;
      f2 = x2 < cx ? mathPi - f2 : f2;

      if (f1 < 0) {
        f1 = mathPi * 2 + f1;
      }
      if (f2 < 0) {
        f2 = mathPi * 2 + f2;
      }
      if (sweep && f1 > f2) {
        f1 = f1 - mathPi * 2;
      }
      if (!sweep && f2 > f1) {
        f2 = f2 - mathPi * 2;
      }
    } else {
      f1 = recurse[0];
      f2 = recurse[1];
      cx = recurse[2];
      cy = recurse[3];
    }

    var df = f2 - f1;
    if (mathAbs(df) > (mathPi * 120) / 180) {
      var f2old = f2;
      var x2old = x2;
      var y2old = y2;

      f2 = f1 + ((mathPi * 120) / 180) * (sweep && f2 > f1 ? 1 : -1);
      x2 = cx + rx * mathCos(f2);
      y2 = cy + ry * mathSin(f2);
      res = arcToCurve(
        [x2, y2],
        rx,
        ry,
        angle,
        0,
        sweep,
        [x2old, y2old],
        [f2, f2old, cx, cy]
      );
    }

    df = f2 - f1;

    var c1 = mathCos(f1);
    var s1 = mathSin(f1);
    var c2 = mathCos(f2);
    var s2 = mathSin(f2);
    var t = mathTan(df / 4);
    var hx = (4 / 3) * rx * t;
    var hy = (4 / 3) * ry * t;
    var m1 = [x1, y1];
    var m2 = [x1 + hx * s1, y1 - hy * c1];
    var m3 = [x2 + hx * s2, y2 - hy * c2];
    var m4 = [x2, y2];
    m2[0] = 2 * m1[0] - m2[0];
    m2[1] = 2 * m1[1] - m2[1];

    function splitCurves(curves) {
      return splitArray3(splitArray2(curves));
    }

    if (recurse) {
      return splitCurves([m2, m3, m4].concat(res));
    } else {
      res = [m2, m3, m4].concat(res).join().split(",");
      var newres = [];
      for (var i = 0, ii = res.length; i < ii; i++) {
        newres[i] =
          i % 2
            ? rotate(res[i - 1], res[i], rad)[1]
            : rotate(res[i], res[i + 1], rad)[0];
      }
      return splitCurves(newres);
    }
  }

  // Unpack an SVG path string into different curves and lines
  //
  // https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/d
  function splitSegments(polygon) {
    if (typeof polygon !== "string") {
      throw new Error("Polygon should be a path string");
    }

    var start = null;
    var position = null;
    var result = [];
    var input = polygon;

    function stripWhitespace() {
      polygon = polygon.trim();
    }

    function readCharSeq(n) {
      var c = polygon.charCodeAt(n);
      while (c >= 48 && c <= 57) {
        n++;
        c = polygon.charCodeAt(n);
      }
      return n;
    }

    function readNumber() {
      stripWhitespace();

      var start = 0;
      var end = 0;
      if (polygon[start] === ",") {
        start++;
        end++;
      }

      if (polygon[start] === "-" || polygon[start] === ".") {
        end++;
      }

      end = readCharSeq(end);
      if (polygon[end] === "." && polygon[start] !== ".") {
        end++;
        end = readCharSeq(end);
      }

      var s = polygon.substring(start, end);
      if (s !== "") {
        var num = toFloat(s);
        polygon = polygon.substring(end);
        if (polygon.length && polygon[0].toLowerCase() === "e") {
          var f = 1;
          var expEnd = 0;
          if (polygon.length > 1 && polygon[1] === "-") {
            f = -1;
            expEnd = readCharSeq(2);
          } else {
            expEnd = readCharSeq(1);
          }
          var exp = toFloat(polygon.substring(1, expEnd));
          if (mathAbs(exp) > 0) {
            num *= mathPow(10, exp);
          }
          polygon = polygon.substring(expEnd);
        }
        return num;
      } else {
        throw new Error("Expected number: " + polygon);
      }
    }

    function readNumbers(n, fn) {
      stripWhitespace();
      var index = 0;
      var c = polygon.charCodeAt(0);
      while ((c >= 48 && c <= 57) || c === 44 || c === 45 || c === 46) {
        var numbers = [];
        for (var i = 0; i < n; i++) {
          numbers.push(readNumber());
        }
        fn(numbers, index);

        stripWhitespace();
        c = polygon.charCodeAt(0);
        index++;
      }
    }

    function readCoords(n, fn) {
      readNumbers(n * 2, function (numbers, index) {
        var coords = [];
        for (var i = 0; i < n; i++) {
          coords.push(numbers.splice(0, 2));
        }
        fn(coords, index);
      });
    }

    function pushType(itemType, offset) {
      return function (c) {
        if (offset) {
          c = c.map(function (c) {
            return [x(c) + x(position), y(c) + y(position)];
          });
        }
        c.unshift(position);
        result.push({
          type: itemType,
          coords: c,
        });
        position = c[c.length - 1];
      };
    }

    function calculateCubicControlPoints(coords) {
      return [
        coords[0],
        [
          x(coords[0]) + (2.0 / 3.0) * (x(coords[1]) - x(coords[0])),
          y(coords[0]) + (2.0 / 3.0) * (y(coords[1]) - y(coords[0])),
        ],
        [
          x(coords[2]) + (2.0 / 3.0) * (x(coords[1]) - x(coords[2])),
          y(coords[2]) + (2.0 / 3.0) * (y(coords[1]) - y(coords[2])),
        ],
        coords[2],
      ];
    }

    function calculateBezierControlPoint() {
      var lastBezier = result[result.length - 1];
      var controlPoint = null;
      if (!lastBezier || lastBezier.type !== bezier3Type) {
        controlPoint = position;
      } else {
        // Calculate the mirror point of the last control point
        var lastPoint = lastBezier.coords[2];
        var xOffset = x(position) - x(lastPoint);
        var yOffset = y(position) - y(lastPoint);

        controlPoint = [x(position) + xOffset, y(position) + yOffset];
      }

      return controlPoint;
    }

    function handleArcSegment(relative) {
      readNumbers(7, function (numbers) {
        var c2 = coordAdd(numbers.slice(5, 7), relative);
        var args = [position].concat(numbers.slice(0, 5)).concat([c2]);
        var curve = arcToCurve.apply(null, args);
        for (var i = 0; i < curve.length; i++) {
          pushType(bezier3Type)(curve[i]);
        }
      });
    }

    function readSegment() {
      stripWhitespace();
      if (polygon === "") {
        return;
      }

      var operator = polygon[0];
      polygon = polygon.substring(1);

      var pushLine = pushType(lineType);
      var origin = [0, 0];

      switch (operator) {
        case "M":
          readCoords(1, function (c, i) {
            if (i === 0) {
              position = c[0];
              if (!start) {
                start = position;
              }
            } else {
              pushType(lineType)(c);
            }
          });
          break;
        case "m":
          readCoords(1, function (c, i) {
            if (i === 0) {
              if (!position) {
                position = c[0];
              } else {
                position = coordAdd(c[0], position);
              }

              if (!start) {
                start = position;
              }
            } else {
              var c0 = c[0];
              pushType(lineType)([coordAdd(c0, position)]);
            }
          });
          break;
        case "C":
          readCoords(3, pushType(bezier3Type));
          break;
        case "c":
          readCoords(3, pushType(bezier3Type, true));
          break;
        case "Q":
          readCoords(2, function (coords) {
            coords.unshift(position);
            coords = calculateCubicControlPoints(coords);
            coords.shift();
            pushType(bezier3Type)(coords);
          });
          break;
        case "q":
          readCoords(2, function (coords) {
            coords = coords.map(function (c) {
              return coordAdd(c, position);
            });
            coords.unshift(position);
            coords = calculateCubicControlPoints(coords);
            coords.shift();
            pushType(bezier3Type)(coords);
          });
          break;
        case "S":
          readCoords(2, function (coords) {
            var controlPoint = calculateBezierControlPoint();
            coords.unshift(controlPoint);
            pushType(bezier3Type)(coords);
          });
          break;
        case "s":
          readCoords(2, function (coords) {
            var controlPoint = calculateBezierControlPoint();
            coords = coords.map(function (c) {
              return coordAdd(c, position);
            });
            coords.unshift(controlPoint);
            pushType(bezier3Type)(coords);
          });
          break;
        case "A":
          handleArcSegment(origin);
          break;
        case "a":
          handleArcSegment(position);
          break;
        case "L":
          readCoords(1, pushType(lineType));
          break;
        case "l":
          readCoords(1, function (c) {
            pushLine([[x(c[0]) + x(position), y(c[0]) + y(position)]]);
          });
          break;
        case "H":
          pushType(lineType)([[readNumber(), y(position)]]);
          break;
        case "h":
          pushType(lineType, true)([[readNumber(), 0]]);
          break;
        case "V":
          pushType(lineType)([[x(position), readNumber()]]);
          break;
        case "v":
          pushType(lineType, true)([[0, readNumber()]]);
          break;
        case "Z":
        case "z":
          if (!coordEqual(position, start)) {
            pushType(lineType)([start]);
          }
          break;
        default:
          throw new Error(
            "Unknown operator: " + operator + " for polygon '" + input + "'"
          );
      }
    }

    while (polygon.length > 0) {
      readSegment();
    }

    // Remove zero-length lines
    for (var i = 0; i < result.length; i++) {
      var segment = result[i];
      if (
        segment.type === lineType &&
        coordEqual(segment.coords[0], segment.coords[1])
      ) {
        result.splice(i, 1);
        i--;
      }
    }

    return result;
  }

  function intersectBezier3Line(p1, p2, p3, p4, a1, a2) {
    var result = [];

    var min = coordMin(a1, a2); // used to determine if point is on line segment
    var max = coordMax(a1, a2); // used to determine if point is on line segment

    // Start with Bezier using Bernstein polynomials for weighting functions:
    //     (1-t^3)P1 + 3t(1-t)^2P2 + 3t^2(1-t)P3 + t^3P4
    //
    // Expand and collect terms to form linear combinations of original Bezier
    // controls.  This ends up with a vector cubic in t:
    //     (-P1+3P2-3P3+P4)t^3 + (3P1-6P2+3P3)t^2 + (-3P1+3P2)t + P1
    //             /\                  /\                /\       /\
    //             ||                  ||                ||       ||
    //             c3                  c2                c1       c0

    // Calculate the coefficients
    var a = coordMultiply(p1, -1);
    var b = coordMultiply(p2, 3);
    var c = coordMultiply(p3, -3);
    var c3 = coordAdd(a, coordAdd(b, coordAdd(c, p4)));

    a = coordMultiply(p1, 3);
    b = coordMultiply(p2, -6);
    c = coordMultiply(p3, 3);
    var c2 = coordAdd(a, coordAdd(b, c));

    a = coordMultiply(p1, -3);
    b = coordMultiply(p2, 3);
    var c1 = coordAdd(a, b);

    var c0 = p1;

    // Convert line to normal form: ax + by + c = 0
    // Find normal to line: negative inverse of original line's slope
    var n = [y(a1) - y(a2), x(a2) - x(a1)];

    // Determine new c coefficient
    var cl = x(a1) * y(a2) - x(a2) * y(a1);

    // ?Rotate each cubic coefficient using line for new coordinate system?
    // Find roots of rotated cubic
    var roots = cubeRoots(
      coordDot(n, c3),
      coordDot(n, c2),
      coordDot(n, c1),
      coordDot(n, c0) + cl
    );

    // Any roots in closed interval [0,1] are intersections on Bezier, but
    // might not be on the line segment.
    // Find intersections and calculate point coordinates
    for (var i = 0; i < roots.length; i++) {
      var t = roots[i];

      if (t >= 0 && t <= 1) {
        // We're within the Bezier curve
        // Find point on Bezier
        var p5 = coordLerp(p1, p2, t);
        var p6 = coordLerp(p2, p3, t);
        var p7 = coordLerp(p3, p4, t);

        var p8 = coordLerp(p5, p6, t);
        var p9 = coordLerp(p6, p7, t);

        var p10 = coordLerp(p8, p9, t);

        // See if point is on line segment
        // Had to make special cases for vertical and horizontal lines due
        // to slight errors in calculation of p10
        if (x(a1) === x(a2)) {
          if (y(min) <= y(p10) && y(p10) <= y(max)) {
            result.push(p10);
          }
        } else if (y(a1) === y(a2)) {
          if (x(min) <= x(p10) && x(p10) <= x(max)) {
            result.push(p10);
          }
        } else if (
          x(min) <= x(p10) &&
          x(p10) <= x(max) &&
          y(min) <= y(p10) &&
          y(p10) <= y(max)
        ) {
          result.push(p10);
        }
      }
    }

    return result;
  }

  function intersectLineLine(a1, a2, b1, b2) {
    var ua_t =
      (x(b2) - x(b1)) * (y(a1) - y(b1)) - (y(b2) - y(b1)) * (x(a1) - x(b1));
    var ub_t =
      (x(a2) - x(a1)) * (y(a1) - y(b1)) - (y(a2) - y(a1)) * (x(a1) - x(b1));
    var u_b =
      (y(b2) - y(b1)) * (x(a2) - x(a1)) - (x(b2) - x(b1)) * (y(a2) - y(a1));

    if (u_b !== 0) {
      var ua = ua_t / u_b;
      var ub = ub_t / u_b;

      if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
        return [[x(a1) + ua * (x(a2) - x(a1)), y(a1) + ua * (y(a2) - y(a1))]];
      }
    }

    return [];
  }

  function getIntersections(zero, point, shape) {
    var coords = shape.coords;
    switch (shape.type) {
      case bezier3Type:
        return intersectBezier3Line(
          coords[0],
          coords[1],
          coords[2],
          coords[3],
          zero,
          point
        );
      case lineType:
        return intersectLineLine(coords[0], coords[1], zero, point);
      default:
        throw new Error("Unsupported shape type: " + shape.type);
    } // jscs:ignore validateIndentation
    // ^ (jscs bug)
  }

  function isInside(point, polygon) {
    var segments;
    if (polygon && Array.isArray(polygon)) {
      segments = polygon;
    } else {
      segments = splitSegments(polygon);
    }

    var minX = 0;
    var minY = 0;
    for (var s = 0; s < segments.length; s++) {
      var coords = segments[s].coords;
      for (var c = 0; c < coords.length; c++) {
        var coord = coords[c];
        minX = Math.min(minX, x(coord));
        minY = Math.min(minY, y(coord));
      }
    }
    var zero = [minX - 10, minY - 10];

    var intersections = [];
    for (var i = 0; i < segments.length; i++) {
      var newIntersections = getIntersections(zero, point, segments[i]);
      for (var j = 0; j < newIntersections.length; j++) {
        var seen = false;
        var intersection = newIntersections[j];

        for (var k = 0; k < intersections.length; k++) {
          if (coordEqual(intersections[k], intersection)) {
            seen = true;
            break;
          }
        }

        if (!seen) {
          intersections.push(intersection);
        }
      }
    }

    return intersections.length % 2 === 1;
  }

  const rawData = new Array();
  let tpPoints = new Array();
  const minYTopCp = message.data.minYTopCp;
  const maxYBottomCp = message.data.maxYBottomCp;
  const minXLeftCp = message.data.minXLeftCp;
  const maxXRightCp = message.data.maxXRightCp;
  const segments = splitSegments(message.data.path);
  for (let y = minYTopCp; y < maxYBottomCp; y++) {
    for (let x = minXLeftCp; x < maxXRightCp; x++) {
      if (!isInside([x, y], segments)) {
        if (isInside([x - 1, y], segments)) {
          tpPoints.push({ x: x, y: y });
        }
        if (isInside([x + 1, y], segments)) {
          tpPoints.push({ x: x, y: y });
        }
        if (isInside([x, y - 1], segments)) {
          tpPoints.push({ x: x, y: y });
        }
        if (isInside([x, y + 1], segments)) {
          tpPoints.push({ x: x, y: y });
        }
      }
    }
  }

  let minXLeftTp = Math.min(
    ...tpPoints.flatMap((tp) => {
      return tp.x;
    })
  );
  let maxXRightTp = Math.max(
    ...tpPoints.flatMap((tp) => {
      return tp.x;
    })
  );
  let minYTopTp = Math.min(
    ...tpPoints.flatMap((tp) => {
      return tp.y;
    })
  );
  let maxYBottomTp = Math.max(
    ...tpPoints.flatMap((tp) => {
      return tp.y;
    })
  );

  for (let y = minYTopTp; y < maxYBottomTp; y++) {
    for (let x = minXLeftTp; x < maxXRightTp; x++) {
      if (isInside([x, y], segments)) {
        // selected area
        rawData.push({ x: x, y: y, inside: true });
      } else {
        // transparent points to make ImageData a rect
        rawData.push({ x: x, y: y, inside: false });
      }
    }
  }

  const width = maxXRightTp - minXLeftTp;
  const height = maxYBottomTp - minYTopTp;
  self.postMessage({ rawData: rawData, width: width, height: height });
}

const cutImage = () => {
  return new Promise((resolve) => {
    const bcIdRegexp = new RegExp("bc-\\d+-\\d+-\\d+-\\d+");
    let closedSplinePaths = [...document.getElementsByTagNameNS(SVGNS, "path")];
    let path = "";
    for (const bcPath of closedSplinePaths) {
      let id = bcPath.getAttributeNS(null, "id");
      if (id != null && (bcIdRegexp.test(id) || id == "bc-closing-line")) {
        path += bcPath.getAttributeNS(null, "d") + " ";
      }
    }
    let minXLeftCp = Math.min(
      ...gControlPoints.flatMap((cp) => {
        return cp.x;
      })
    );
    let maxXRightCp = Math.max(
      ...gControlPoints.flatMap((cp) => {
        return cp.x;
      })
    );
    let minYTopCp = Math.min(
      ...gControlPoints.flatMap((cp) => {
        return cp.y;
      })
    );
    let maxYBottomCp = Math.max(
      ...gControlPoints.flatMap((cp) => {
        return cp.y;
      })
    );
    for (let i = gControlPoints.length - 1; i >= 0; i--) {
      gControlPoints[i].remove(true);
    }

    if (window.Worker) {
      const worker = createWorker(workerJob);
      worker.postMessage({
        path: path,
        minXLeftCp: minXLeftCp,
        maxXRightCp: maxXRightCp,
        minYTopCp: minYTopCp,
        maxYBottomCp: maxYBottomCp,
      });

			hideElementById("c-polygon");
      removeClosingLine();
      worker.addEventListener("message", (message) => {
        const rawData = message.data.rawData;
        const rawImageData = new Array();
        const width = message.data.width;
        const height = message.data.height;
        worker.terminate();
        for (const pixel of rawData) {
          if (pixel.inside) {
            rawImageData.push([
              ...context.getImageData(pixel.x, pixel.y, 1, 1).data,
            ]);
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
