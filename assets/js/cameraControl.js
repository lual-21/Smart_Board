// Get the camera control element and its parent container
const cameraControl = document.getElementById('camera-control');
const container = cameraControl.parentElement;

let isDragging = false;
let offsetX, offsetY;
let stream = null; // To keep track of the webcam stream

// Drag functionality for the camera control element
cameraControl.addEventListener('mousedown', (e) => {
  isDragging = true;
  offsetX = e.clientX - cameraControl.getBoundingClientRect().left;
  offsetY = e.clientY - cameraControl.getBoundingClientRect().top;
  cameraControl.style.cursor = 'grabbing';
});

document.addEventListener('mousemove', (e) => {
  if (isDragging) {
    const containerRect = container.getBoundingClientRect();
    const controlRect = cameraControl.getBoundingClientRect();
    let x = e.clientX - offsetX;
    let y = e.clientY - offsetY;
    // Constrain movement within the container
    x = Math.max(containerRect.left, Math.min(x, containerRect.right - controlRect.width));
    y = Math.max(containerRect.top, Math.min(y, containerRect.bottom - controlRect.height));
    cameraControl.style.left = `${x - containerRect.left}px`;
    cameraControl.style.top = `${y - containerRect.top}px`;
  }
});

document.addEventListener('mouseup', () => {
  if (isDragging) {
    isDragging = false;
    cameraControl.style.cursor = 'grab';
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const cameraOn = document.querySelector('.camera-on');
  const cameraOff = document.querySelector('.camera-off');
  const webcamDiv = document.getElementById('camera-control');
  if (cameraOn && cameraOff && webcamDiv) {
    cameraOn.style.display = 'none';
    cameraOff.style.display = 'flex';
    webcamDiv.style.display = 'none';
  }

  document.getElementById('camera-toggle').addEventListener('click', function () {
    const cameraOn = document.querySelector('.camera-on');
    const cameraOff = document.querySelector('.camera-off');
    const webcamDiv = document.getElementById('camera-control');
    
    if (stream) {
      stopWebcam();
      cameraOn.style.display = 'none';
      cameraOff.style.display = 'flex';
      webcamDiv.style.display = 'none';
    } else {
      startWebcam();
      cameraOn.style.display = 'flex';
      cameraOff.style.display = 'none';
      webcamDiv.style.display = 'flex';
    }
  });
});

async function startWebcam() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true });
    const videoElement = document.getElementById('webcam-video');
    videoElement.srcObject = stream;
    document.getElementById('webcam').style.display = 'flex';
  } catch (error) {
    console.error('Error accessing webcam: ', error);
  }
}
function stopWebcam() {
  if (stream) {
    const tracks = stream.getTracks();
    tracks.forEach(track => track.stop());
    stream = null;
  }
}
