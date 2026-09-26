let micStream = null;
let isMuted = true; 
async function startMic() {
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micStream.getTracks().forEach(track => track.enabled = !isMuted);
  } catch (err) {
    console.error("Error accessing the microphone: ", err);
  }
}

async function toggleMic() {
    if (!micStream) {
    isMuted = false; 
    await startMic();
    document.querySelector('.mic-on').style.display = 'flex';
    document.querySelector('.mic-off').style.display = 'none';
  } else {
    isMuted = !isMuted;
    micStream.getTracks().forEach(track => track.enabled = !isMuted);
    if (isMuted) {
      document.querySelector('.mic-on').style.display = 'none';
      document.querySelector('.mic-off').style.display = 'flex';
    } else {
      document.querySelector('.mic-on').style.display = 'flex';
      document.querySelector('.mic-off').style.display = 'none';
    }
  }
}
