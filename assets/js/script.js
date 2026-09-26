document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.dropdown').forEach(dropdown => {
    dropdown.style.pointerEvents = 'auto';
  });
  const sliderContainer = document.querySelector('#pen-dropdown .dropdown-items');
  if (sliderContainer) {
    sliderContainer.style.marginTop = '15px';
  }
});

const tools = document.querySelector(".open-tools");
const openTools = document.querySelector(".open-tools .open");
const closeTools = document.querySelector(".open-tools .close");
const toolsMenu = document.querySelector(".tools");

tools.addEventListener('click', () => {
  if (toolsMenu.style.display === "none" || toolsMenu.style.display === "") {
    toolsMenu.style.display = 'flex';
    openTools.style.display = 'none';
    closeTools.style.display = 'flex';
  } else {
    toolsMenu.style.display = 'none';
    openTools.style.display = 'flex';
    closeTools.style.display = 'none';
  }
});

const dropdownBtn = document.querySelector(".tool-btn.pen");
const dropdown = document.querySelector(".dropdown");

dropdownBtn.addEventListener('click', (event) => {
  event.stopPropagation();
  const isDropdownOpen = dropdown.style.display == 'flex';
  dropdown.style.display = isDropdownOpen ? 'none' : 'flex';
});

document.addEventListener('click', (event) => {
  if (dropdown.style.display == 'flex' && !dropdown.contains(event.target) && !dropdownBtn.contains(event.target)) {
    dropdown.style.display = 'none';
  }
});
let currentTool = "pen";
const toolBtn = document.querySelector(".tool-btn.pen span");
const toolDropdown = document.querySelector("#pen-dropdown");
const toolButtons = document.querySelectorAll(".dropdown-items-btn .other-tools");

const updateToolButtonIcon = (selectedTool) => {
  const icon = selectedTool.querySelector("i").cloneNode(true);
  toolBtn.innerHTML = "";
  toolBtn.appendChild(icon);
};

toolButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const toolId = button.getAttribute('id');
    if (toolId === 'trash') {
      document.querySelector(".overdiv").style.display = "flex";
      return;
    }
    currentTool = toolId;
    toolButtons.forEach((btn) => btn.classList.remove("selected-tool"));
    button.classList.add("selected-tool");
    updateToolButtonIcon(button);
    updateCursor(button);
  });
});

const workspace = document.querySelector("body");
const updateCursor = (selectedTool) => {
  const iconElement = selectedTool.querySelector("i");
  const iconClass = iconElement.className.split(" ").pop();
  const fontAwesomeUnicode = getFontAwesomeUnicode(iconClass);
  if (!fontAwesomeUnicode) {
    console.error(`Unable to find the Unicode for class ${iconClass}`);
    return;
  }
  const canvasCursor = document.createElement("canvas");
  const ctxCursor = canvasCursor.getContext("2d");
  canvasCursor.height = 32;
  canvasCursor.width = 32;
  ctxCursor.font = "16px FontAwesome";
  ctxCursor.fillStyle = "black";
  ctxCursor.textAlign = "center";
  ctxCursor.textBaseline = "middle";
  ctxCursor.fillText(fontAwesomeUnicode, canvasCursor.width / 2, canvasCursor.height / 2);
  const cursorUrl = canvasCursor.toDataURL();
  workspace.style.cursor = `url(${cursorUrl}) 16 16, auto`;
};

const getFontAwesomeUnicode = (className) => {
  const unicodeMap = {
    "fa-pencil": "\uf304",
    "fa-highlighter": "\uf591",
    "fa-eraser": "\uf12d",
    "fa-circle": "\uf111",
    "fa-trash": "\uf1f8",
  };
  return unicodeMap[className] || null;
};
const colorSwatches = document.querySelectorAll(".color-swatch");
const penButton = document.querySelector(".tool-btn.pen");
colorSwatches.forEach((swatch) => {
  swatch.addEventListener("click", () => {
    colorSwatches.forEach((btn) => btn.classList.remove("selected-color"));
    swatch.classList.add("selected-color");
    const selectedColor = swatch.dataset.color;
    if (penButton) {
      penButton.style.color = selectedColor;
    }
  });
});
const liveChatBtn = document.getElementById("live-chat");
const chatSection = document.querySelector(".chat-section");
liveChatBtn.addEventListener("click", () => {
   chatSection.style.display = (chatSection.style.display === "none" || chatSection.style.display === "") ? 'flex' : 'none';
});

const sendMsgBtn = document.querySelector(".send-msg-box button");
const tutorMessage = document.getElementById("tutor-message");
const studentMessages = document.getElementById("student-messages");
sendMsgBtn.addEventListener("click", () => {
    const message = tutorMessage.value.trim();
    if(message) {
         const messageDiv = document.createElement("div");
         messageDiv.className = "chat-message";
         messageDiv.textContent = message;
         studentMessages.appendChild(messageDiv);
         tutorMessage.value = "";
         studentMessages.scrollTop = studentMessages.scrollHeight;
    }
});

tutorMessage.addEventListener("keypress", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMsgBtn.click();
  }
});

const screenToggleBtn = document.getElementById("screen-toggle");
screenToggleBtn.addEventListener("click", () => {
    if (!document.fullscreenElement) {
         document.documentElement.requestFullscreen().catch((err) => {
           console.error(`Error attempting to enable fullscreen mode: ${err.message} (${err.name})`);
         });
         document.querySelector(".screen-max").style.display = "none";
         document.querySelector(".screen-min").style.display = "inline";
    } else {
         document.exitFullscreen();
         document.querySelector(".screen-max").style.display = "inline";
         document.querySelector(".screen-min").style.display = "none";
    }
});

const screenShareBtn = document.getElementById("screen_share");
screenShareBtn.addEventListener("click", async () => {
   try {
       const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
       const videoElem = document.createElement("video");
       videoElem.srcObject = displayStream;
       videoElem.autoplay = true;
       videoElem.controls = true;
       videoElem.style.position = "absolute";
       videoElem.style.top = "0";
       videoElem.style.left = "0";
       videoElem.style.width = "100%";
       videoElem.style.height = "100%";
       videoElem.style.zIndex = "200";
       document.body.appendChild(videoElem);
       displayStream.getVideoTracks()[0].addEventListener("ended", () => {
            document.body.removeChild(videoElem);
       });
   } catch (err) {
       console.error("Error sharing screen: ", err);
   }
});

document.getElementById("yesBtn").addEventListener("click", () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  saveState();
  document.querySelector(".overdiv").style.display = "none";
});
document.getElementById("noBtn").addEventListener("click", () => {
  document.querySelector(".overdiv").style.display = "none";
});

const canvas = document.getElementById("whiteboard");
const ctx = canvas.getContext("2d");
function resizeCanvas() {
  const dataURL = canvas.toDataURL();
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = canvas.parentElement.clientHeight;
  const img = new Image();
  img.onload = function() {
    ctx.drawImage(img, 0, 0);
    saveState();
  };
  img.src = dataURL;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

let drawing = false;
let undoStack = [];
let redoStack = [];

function saveState() {
   try {
     const state = ctx.getImageData(0, 0, canvas.width, canvas.height);
     undoStack.push(state);
     redoStack = [];
   } catch (e) {
     console.error("Error saving state:", e);
   }
}

canvas.addEventListener("mousedown", (e) => {
  if (currentTool === "pointer") return;
  
  drawing = true;
  ctx.beginPath();
  const rect = canvas.getBoundingClientRect();
  ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  
  if (currentTool === "eraser") {
    ctx.globalCompositeOperation = 'destination-out';
  } else {
    ctx.globalCompositeOperation = 'source-over';
  }
  
  ctx.globalAlpha = (currentTool === "highlighter") ? 0.5 : 1;
});

canvas.addEventListener("mousemove", (e) => {
  if (!drawing) return;
  if (currentTool === "pointer") return;
  
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  ctx.lineTo(x, y);
  const width = Number(document.getElementById("pen-width").value);
  if (currentTool === "eraser") {
    ctx.lineWidth = width;
  } else {
    ctx.strokeStyle = document.querySelector(".selected-color")?.dataset.color || "#000000";
    ctx.lineWidth = width;
  }
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
});

const finishDrawing = () => {
  if (drawing) {
    saveState();
  }
  drawing = false;
  if (currentTool === "highlighter") {
    ctx.globalAlpha = 1;
  }
};

canvas.addEventListener("mouseup", finishDrawing);
canvas.addEventListener("mouseleave", finishDrawing);

document.getElementById("undo").addEventListener("click", () => {
    if (undoStack.length > 1) {
         redoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
         undoStack.pop();
         const prevState = undoStack[undoStack.length - 1];
         ctx.putImageData(prevState, 0, 0);
    }
});

document.getElementById("redo").addEventListener("click", () => {
    if (redoStack.length > 0) {
         undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
         const nextState = redoStack.pop();
         ctx.putImageData(nextState, 0, 0);
    }
});
const penWidthSlider = document.getElementById("pen-width");
const penWidthValue = document.getElementById("pen-width-value");
penWidthSlider.addEventListener("input", () => {
  penWidthValue.textContent = penWidthSlider.value;
});
