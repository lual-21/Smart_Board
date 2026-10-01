(() => {
"use strict";

const qs = s => document.querySelector(s);

const roomId =
    decodeURIComponent(
        new URLSearchParams(location.search).get("room")
        ||
        location.pathname
            .split("/")
            .filter(Boolean)
            .pop()
            ||
        ""
    );

if (!/^SB-[A-F0-9]{8}$/i.test(roomId)) {
    location.href = "/dashboard.html";
    return;
}

let me,
    room,
    kicked = false;

let clientId =
    crypto.randomUUID()
        .replaceAll("-", "")
        .slice(0, 16);

let localStream = null;
let screenStream = null;

const peers = new Map();

let participants = [];

let lastEvent = 0;
let pollBusy = false;
let presenceBusy = false;

let currentTool = "pen";
let currentColor = "#000000";
let currentWidth = 3;

let drawing = false;
let points = [];

let undoStack = [];
let redoStack = [];

let remoteDrawing = false;
let snapshotTimer = null;

const canvas =
    qs("#whiteboard");

const ctx =
    canvas.getContext("2d");

const endOverlay =
    qs("#endOverlay");

const toast =
    qs("#toast");


function showToast(text) {

    toast.textContent = text;

    toast.classList.add("show");

    clearTimeout(showToast.t);

    showToast.t =
        setTimeout(
            () =>
                toast.classList.remove("show"),
            2200
        );

}


function escapeHtml(s) {

    return String(s ?? "")
        .replace(
            /[&<>"']/g,
            c => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            }[c])
        );

}


async function api(url, options = {}) {

    const r =
        await fetch(
            url,
            {
                credentials: "same-origin",

                ...options,

                headers: {
                    "Content-Type":
                        "application/json",

                    ...(options.headers || {})
                }
            }
        );

    const d =
        await r.json()
            .catch(() => ({}));

    if (!r.ok) {

        throw new Error(
            d.error ||
            `Request failed (${r.status})`
        );

    }

    return d;

}


async function init() {

    try {

        const auth =
            await api("/api/auth/me");

        me = auth.user;

        const d =
            await api(
                `/api/classrooms/${encodeURIComponent(roomId)}`
            );

        room = d.classroom;

        participants =
            d.participants || [];

        if (room.status === "ENDED") {

            showEnded(
                "Classroom ended",
                "This classroom has already ended."
            );

            return;

        }

        if (
            (me.role === "TEACHER" ||
             me.role === "ADMIN")
            &&
            room.status === "SCHEDULED"
        ) {

            await api(
                `/api/classrooms/${encodeURIComponent(roomId)}`,
                {
                    method: "PATCH",

                    body: JSON.stringify({
                        action: "start"
                    })
                }
            );

        }

        lastEvent = Date.now();

        qs("#roomName").textContent =
            room.name;

        qs("#roomMeta").textContent =
            `${room.subject} · ${me.fullName} (${me.role})`;

        qs("#roomCode").textContent =
            room.classroomId;

        qs("#endBtn").style.display =
            (
                me.role === "TEACHER" ||
                me.role === "ADMIN"
            )
            ? "inline-block"
            : "none";

        qs("#settingDrawing").checked =
            room.settings?.allowStudentDrawing !== false;

        qs("#settingMic").checked =
            room.settings?.allowStudentMicrophone !== false;

        qs("#settingCamera").checked =
            room.settings?.allowStudentCamera !== false;

        qs("#settingScreen").checked =
            room.settings?.allowStudentScreenSharing === true;

        resizeCanvas();

        if (room.whiteboardSnapshot) {

            restoreSnapshot(
                room.whiteboardSnapshot
            );

        }

        await joinPresence();

        renderParticipants();

        await pollLoop();

        setInterval(
            pollLoop,
            850
        );

        setInterval(
            heartbeat,
            4000
        );

        setInterval(
            refreshPresence,
            2500
        );

        window.addEventListener(
            "beforeunload",
            () =>
                navigator.sendBeacon(
                    `/api/classrooms/${encodeURIComponent(roomId)}/presence`,
                    new Blob(
                        [
                            JSON.stringify({
                                clientId,
                                offline: true
                            })
                        ],
                        {
                            type:
                                "application/json"
                        }
                    )
                )
        );

    } catch (e) {

        console.error(e);

        showEnded(
            "Unable to join",
            e.message
        );

    }

}


async function joinPresence() {

    await api(
        `/api/classrooms/${encodeURIComponent(roomId)}/presence`,
        {
            method: "POST",

            body: JSON.stringify({
                clientId
            })
        }
    );

}


async function heartbeat() {

    if (
        kicked ||
        presenceBusy
    )
        return;

    presenceBusy = true;

    try {

        await api(
            `/api/classrooms/${encodeURIComponent(roomId)}/presence`,
            {
                method: "POST",

                body: JSON.stringify({
                    clientId,
                    camera: hasVideo(),
                    microphone: hasAudio(),
                    screen: !!screenStream
                })
            }
        );

    } catch (e) {

        if (
            e.message.includes("ended")
        ) {

            showEnded(
                "Classroom ended",
                "The teacher has ended this classroom."
            );

        }

    } finally {

        presenceBusy = false;

    }

}


async function refreshPresence() {

    try {

        const d =
            await api(
                `/api/classrooms/${encodeURIComponent(roomId)}/presence`
            );

        participants =
            d.participants;

        renderParticipants();

        syncPeers();

    } catch (e) {}

}


async function pollLoop() {

    if (pollBusy)
        return;

    pollBusy = true;

    try {

        const d =
            await api(
                `/api/classrooms/${encodeURIComponent(roomId)}/events?since=${lastEvent}`
            );

        for (
            const ev of d.events || []
        ) {

            lastEvent =
                Math.max(
                    lastEvent,
                    Number(
                        ev.createdAtMs || 0
                    )
                );

            await handleEvent(ev);

        }

    } catch (e) {

    } finally {

        pollBusy = false;

    }

}


async function sendEvent(
    type,
    data = {}
) {

    try {

        await api(
            `/api/classrooms/${encodeURIComponent(roomId)}/events`,
            {
                method: "POST",

                body: JSON.stringify({
                    type,

                    data: {
                        ...data,
                        clientId
                    }
                })
            }
        );

    } catch (e) {

        showToast(e.message);

    }

}


/* ================================
   WHITEBOARD
================================ */

function resizeCanvas() {

    const rect =
        canvas.getBoundingClientRect();

    const old =
        document.createElement("canvas");

    old.width =
        canvas.width;

    old.height =
        canvas.height;

    if (
        old.width &&
        old.height
    ) {

        old.getContext("2d")
            .drawImage(
                canvas,
                0,
                0
            );

    }

    canvas.width =
        Math.max(
            1,
            Math.floor(
                rect.width *
                devicePixelRatio
            )
        );

    canvas.height =
        Math.max(
            1,
            Math.floor(
                rect.height *
                devicePixelRatio
            )
        );

    ctx.setTransform(
        devicePixelRatio,
        0,
        0,
        devicePixelRatio,
        0,
        0
    );

    if (
        old.width &&
        old.height
    ) {

        ctx.drawImage(
            old,
            0,
            0,
            old.width /
                devicePixelRatio,
            old.height /
                devicePixelRatio
        );

    }

}


function xy(e) {

    const r =
        canvas.getBoundingClientRect();

    return {
        x:
            (e.clientX - r.left) /
            r.width,

        y:
            (e.clientY - r.top) /
            r.height
    };

}


function styleFor(
    tool = currentTool
) {

    ctx.lineWidth =
        currentWidth;

    ctx.lineCap =
        "round";

    ctx.lineJoin =
        "round";

    if (
        tool === "eraser"
    ) {

        ctx.globalCompositeOperation =
            "destination-out";

        ctx.globalAlpha = 1;

    } else {

        ctx.globalCompositeOperation =
            "source-over";

        ctx.globalAlpha =
            tool === "highlighter"
                ? 0.42
                : 1;

        ctx.strokeStyle =
            currentColor;

    }

}


function drawStroke(
    stroke,
    targetCtx = ctx
) {

    if (
        !stroke?.points?.length
    )
        return;

    const r =
        canvas.getBoundingClientRect();

    targetCtx.save();

    targetCtx.setTransform(
        devicePixelRatio,
        0,
        0,
        devicePixelRatio,
        0,
        0
    );

    targetCtx.lineWidth =
        stroke.width;

    targetCtx.lineCap =
        "round";

    targetCtx.lineJoin =
        "round";

    targetCtx.globalCompositeOperation =
        stroke.tool === "eraser"
            ? "destination-out"
            : "source-over";

    targetCtx.globalAlpha =
        stroke.tool === "highlighter"
            ? 0.42
            : 1;

    targetCtx.strokeStyle =
        stroke.color || "#000";

    targetCtx.beginPath();

    stroke.points.forEach(
        (p, i) => {

            const x =
                p[0] * r.width;

            const y =
                p[1] * r.height;

            i
                ? targetCtx.lineTo(x, y)
                : targetCtx.moveTo(x, y);

        }
    );

    targetCtx.stroke();

    targetCtx.restore();

}


function saveLocal() {

    try {

        undoStack.push(
            canvas.toDataURL(
                "image/png"
            )
        );

        if (
            undoStack.length > 30
        )
            undoStack.shift();

        redoStack = [];

    } catch {}

}


function restoreSnapshot(data) {

    const img =
        new Image();

    img.onload = () => {

        ctx.save();

        ctx.setTransform(
            1,
            0,
            0,
            1,
            0,
            0
        );

        ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        ctx.drawImage(
            img,
            0,
            0,
            canvas.width,
            canvas.height
        );

        ctx.restore();

        saveLocal();

    };

    img.src = data;

}


function queueSnapshot() {

    clearTimeout(
        snapshotTimer
    );

    snapshotTimer =
        setTimeout(
            () =>
                sendEvent(
                    "snapshot",
                    {
                        image:
                            canvas.toDataURL(
                                "image/png"
                            )
                    }
                ),
            700
        );

}


canvas.addEventListener(
    "pointerdown",
    e => {

        if (
            currentTool === "pointer" ||
            (
                me.role === "STUDENT" &&
                room.settings?.allowStudentDrawing === false
            )
        )
            return;

        drawing = true;

        points = [
            xy(e)
        ];

        canvas.setPointerCapture?.(
            e.pointerId
        );

        styleFor();

        ctx.beginPath();

        ctx.moveTo(
            points[0].x *
                canvas.clientWidth,
            points[0].y *
                canvas.clientHeight
        );

    }
);


canvas.addEventListener(
    "pointermove",
    e => {

        const p =
            xy(e);

        if (
            currentTool === "pointer"
        ) {

            if (
                e.buttons === 0
            )
                return;

            sendEvent(
                "pointer",
                {
                    clientId,
                    x: p.x,
                    y: p.y
                }
            );

            return;

        }

        if (!drawing)
            return;

        points.push(p);

        ctx.lineTo(
            p.x *
                canvas.clientWidth,
            p.y *
                canvas.clientHeight
        );

        ctx.stroke();

    }
);


canvas.addEventListener(
    "pointerup",
    async e => {

        if (!drawing)
            return;

        drawing = false;

        ctx.globalAlpha = 1;

        ctx.globalCompositeOperation =
            "source-over";

        const normalized =
            points.map(
                p => [
                    p.x,
                    p.y
                ]
            );

        const stroke = {

            tool:
                currentTool,

            color:
                currentColor,

            width:
                currentWidth,

            points:
                normalized

        };

        saveLocal();

        await sendEvent(
            "stroke",
            stroke
        );

        queueSnapshot();

    }
);


canvas.addEventListener(
    "pointercancel",
    () => {

        drawing = false;

        ctx.globalAlpha = 1;

        ctx.globalCompositeOperation =
            "source-over";

    }
);


window.addEventListener(
    "resize",
    resizeCanvas
);


function setTool(t) {

    currentTool = t;

    document
        .querySelectorAll(".tool")
        .forEach(
            b =>
                b.classList.remove(
                    "active"
                )
        );

    const map = {

        pen:
            "#penTool",

        highlighter:
            "#highlighterTool",

        eraser:
            "#eraserTool",

        pointer:
            "#pointerTool"

    };

    if (map[t]) {

        qs(map[t])
            .classList.add("active");

    }

}


qs("#penTool").onclick =
    () => setTool("pen");

qs("#highlighterTool").onclick =
    () => setTool("highlighter");

qs("#eraserTool").onclick =
    () => setTool("eraser");

qs("#pointerTool").onclick =
    () => setTool("pointer");


document
    .querySelectorAll(".color")
    .forEach(
        b =>
            b.onclick = () => {

                currentColor =
                    b.dataset.color;

                document
                    .querySelectorAll(".color")
                    .forEach(
                        x =>
                            x.style.outline =
                                ""
                    );

                b.style.outline =
                    "2px solid #60a5fa";

                setTool(
                    currentTool
                );

            }
    );


qs("#width").oninput =
    e =>
        currentWidth =
            Number(e.target.value);


qs("#clear").onclick =
    async () => {

        if (
            !confirm(
                "Erase the shared whiteboard?"
            )
        )
            return;

        ctx.save();

        ctx.setTransform(
            1,
            0,
            0,
            1,
            0,
            0
        );

        ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        ctx.restore();

        saveLocal();

        redoStack = [];

        await sendEvent(
            "clear"
        );

        queueSnapshot();

    };


qs("#undo").onclick =
    async () => {

        if (
            undoStack.length <= 1
        )
            return;

        redoStack.push(
            undoStack.pop()
        );

        const data =
            undoStack[
                undoStack.length - 1
            ];

        restoreSnapshot(data);

        await sendEvent(
            "snapshot",
            {
                image: data
            }
        );

    };


qs("#redo").onclick =
    async () => {

        if (
            !redoStack.length
        )
            return;

        const data =
            redoStack.pop();

        undoStack.push(data);

        restoreSnapshot(data);

        await sendEvent(
            "snapshot",
            {
                image: data
            }
        );

    };


/* ================================
   CHAT
================================ */

function addMessage(
    name,
    text
) {

    const d =
        document.createElement(
            "div"
        );

    d.className =
        "msg";

    d.innerHTML = `
        <div class="who">
            ${escapeHtml(name)}
        </div>

        <div class="bubble">
            ${escapeHtml(text)}
        </div>
    `;

    qs("#messages")
        .appendChild(d);

    qs("#messages")
        .scrollTop =
        qs("#messages").scrollHeight;

}


async function sendChat() {

    const input =
        qs("#messageInput");

    const text =
        input.value.trim();

    if (!text)
        return;

    input.value = "";

    await sendEvent(
        "chat",
        {
            text
        }
    );

}


qs("#sendMessage").onclick =
    sendChat;


qs("#messageInput").onkeydown =
    e => {

        if (
            e.key === "Enter" &&
            !e.shiftKey
        ) {

            e.preventDefault();

            sendChat();

        }

    };


qs("#chatBtn").onclick =
    () =>
        qs("#chat")
            .classList.toggle(
                "open"
            );


qs("#chatToolBtn").onclick =
    () =>
        qs("#chat")
            .classList.toggle(
                "open"
            );


/* ================================
   MEDIA
================================ */

function hasVideo() {

    return !!localStream
        ?.getVideoTracks()
        .some(
            t => t.enabled
        );

}


function hasAudio() {

    return !!localStream
        ?.getAudioTracks()
        .some(
            t => t.enabled
        );

}


async function startCamera() {

    if (
        me.role === "STUDENT" &&
        room.settings?.allowStudentCamera === false
    ) {

        return showToast(
            "Camera is disabled by the teacher"
        );

    }

    try {

        const s =
            await navigator
                .mediaDevices
                .getUserMedia({
                    video: true
                });

        localStream =
            mergeStreams(
                localStream,
                s
            );

        attachLocal();

        for (
            const p of peers.values()
        ) {

            replaceTrack(
                p.pc,
                s.getVideoTracks()[0],
                "video"
            );

        }

        await heartbeat();

    } catch (e) {

        showToast(
            "Camera permission was not granted"
        );

    }

}


function mergeStreams(
    old,
    s
) {

    if (!old)
        return s;

    s.getTracks()
        .forEach(
            t => {

                const same =
                    old.getTracks()
                        .find(
                            x =>
                                x.kind ===
                                t.kind
                        );

                if (same)
                    old.removeTrack(
                        same
                    );

                old.addTrack(t);

            }
        );

    return old;

}


async function stopCamera() {

    localStream
        ?.getVideoTracks()
        .forEach(
            t => t.stop()
        );

    localStream
        ?.getVideoTracks()
        .forEach(
            t =>
                localStream.removeTrack(t)
        );

    for (
        const p of peers.values()
    ) {

        await replaceTrack(
            p.pc,
            null,
            "video"
        );

    }

    attachLocal();

    heartbeat();

}


async function toggleCamera() {

    hasVideo()
        ? stopCamera()
        : await startCamera();

}


async function toggleMic() {

    if (
        me.role === "STUDENT" &&
        room.settings?.allowStudentMicrophone === false
    ) {

        return showToast(
            "Microphone is disabled by the teacher"
        );

    }

    if (
        !localStream
            ?.getAudioTracks()
            .length
    ) {

        try {

            const s =
                await navigator
                    .mediaDevices
                    .getUserMedia({
                        audio: true
                    });

            localStream =
                mergeStreams(
                    localStream,
                    s
                );

            attachLocal();

            for (
                const p of peers.values()
            ) {

                replaceTrack(
                    p.pc,
                    s.getAudioTracks()[0],
                    "audio"
                );

            }

        } catch {

            showToast(
                "Microphone permission was not granted"
            );

        }

    } else {

        localStream
            .getAudioTracks()
            .forEach(
                t =>
                    t.enabled =
                        !t.enabled
            );

        await heartbeat();

    }

}


function attachLocal() {

    let box =
        document.getElementById(
            "local-video"
        );

    if (!box) {

        box =
            document.createElement(
                "div"
            );

        box.id =
            "local-video";

        box.className =
            "mini-video";

        qs("#participants")
            .prepend(box);

    }

    if (
        localStream
            ?.getVideoTracks()
            .length
    ) {

        box.innerHTML = `
            <video
                autoplay
                muted
                playsinline
            ></video>

            <span class="mini-name">
                You
            </span>
        `;

        box.querySelector(
            "video"
        ).srcObject =
            localStream;

    } else {

        box.innerHTML = `
            <div class="avatar">
                👤
            </div>

            <span class="mini-name">
                You
            </span>
        `;

    }

}


async function toggleScreen() {

    if (
        me.role === "STUDENT" &&
        room.settings?.allowStudentScreenSharing === false
    ) {

        return showToast(
            "Screen sharing is disabled by the teacher"
        );

    }

    if (screenStream) {

        stopScreen();

        return;

    }

    try {

        screenStream =
            await navigator
                .mediaDevices
                .getDisplayMedia({
                    video: true
                });

        const track =
            screenStream
                .getVideoTracks()[0];

        for (
            const p of peers.values()
        ) {

            replaceTrack(
                p.pc,
                track,
                "video"
            );

        }

        attachLocal();

        await heartbeat();

        track.onended =
            stopScreen;

    } catch (e) {}

}


function stopScreen() {

    screenStream
        ?.getTracks()
        .forEach(
            t => t.stop()
        );

    screenStream = null;

    const cam =
        localStream
            ?.getVideoTracks()[0];

    for (
        const p of peers.values()
    ) {

        replaceTrack(
            p.pc,
            cam,
            "video"
        );

    }

    attachLocal();

    heartbeat();

}


async function replaceTrack(
    pc,
    track,
    kind
) {

    const sender =
        pc.getSenders()
            .find(
                s =>
                    s.track?.kind ===
                    kind
            );

    if (track) {

        if (sender)
            await sender.replaceTrack(
                track
            );
        else
            pc.addTrack(
                track,
                localStream
            );

    } else if (sender) {

        await sender.replaceTrack(
            null
        );

    }

}


qs("#cameraBtn").onclick =
    toggleCamera;

qs("#micBtn").onclick =
    toggleMic;

qs("#shareBtn").onclick =
    toggleScreen;


qs("#fullscreenBtn").onclick =
    () =>
        document.fullscreenElement
            ? document.exitFullscreen()
            : document.documentElement
                .requestFullscreen()
                .catch(() => {});


/* ================================
   WEBRTC
================================ */

function participantByClient(id) {

    return participants.find(
        p =>
            p.clientId === id
    );

}


function createPeer(remote) {

    if (
        remote.clientId ===
        clientId
    )
        return;

    if (
        peers.has(
            remote.clientId
        )
    )
        return peers.get(
            remote.clientId
        ).pc;

    const pc =
        new RTCPeerConnection({
            iceServers: [
                {
                    urls:
                        "stun:stun.l.google.com:19302"
                },

                {
                    urls:
                        "stun:stun1.l.google.com:19302"
                }
            ]
        });

    peers.set(
        remote.clientId,
        {
            pc,
            stream:
                new MediaStream(),
            name:
                remote.fullName,
            role:
                remote.role
        }
    );

    if (localStream) {

        localStream
            .getTracks()
            .forEach(
                t =>
                    pc.addTrack(
                        t,
                        localStream
                    )
            );

    }

    pc.onicecandidate =
        e => {

            if (e.candidate) {

                sendEvent(
                    "signal",
                    {
                        to:
                            remote.clientId,

                        from:
                            clientId,

                        kind:
                            "ice",

                        payload:
                            e.candidate
                    }
                );

            }

        };

    pc.ontrack =
        e => {

            const p =
                peers.get(
                    remote.clientId
                );

            p.stream.addTrack(
                e.track
            );

            renderRemote(
                remote.clientId
            );

        };

    pc.onconnectionstatechange =
        () => {

            if (
                [
                    "failed",
                    "closed",
                    "disconnected"
                ].includes(
                    pc.connectionState
                )
            ) {

                setTimeout(
                    () => {

                        if (
                            peers.has(
                                remote.clientId
                            )
                        ) {

                            pc.close();

                            peers.delete(
                                remote.clientId
                            );

                        }

                    },
                    2500
                );

            }

        };

    return pc;

}


async function makeOffer(
    remote
) {

    const pc =
        createPeer(remote);

    if (!pc)
        return;

    const offer =
        await pc.createOffer();

    await pc.setLocalDescription(
        offer
    );

    await sendEvent(
        "signal",
        {
            to:
                remote.clientId,

            from:
                clientId,

            kind:
                "offer",

            payload:
                pc.localDescription
        }
    );

}


async function syncPeers() {

    for (
        const remote of
        participants.filter(
            p =>
                p.clientId !==
                clientId
        )
    ) {

        const pc =
            createPeer(remote);

        if (
            remote.clientId >
                clientId &&
            pc?.signalingState ===
                "stable"
        ) {

            try {

                await makeOffer(
                    remote
                );

            } catch {}

        }

    }

    for (
        const [id, p] of peers
    ) {

        if (
            !participants.some(
                x =>
                    x.clientId === id
            )
        ) {

            p.pc.close();

            peers.delete(id);

            document
                .getElementById(
                    "remote-" + id
                )
                ?.remove();

        }

    }

}


function renderRemote(id) {

    const p =
        peers.get(id);

    if (!p)
        return;

    let box =
        document.getElementById(
            "remote-" + id
        );

    if (!box) {

        box =
            document.createElement(
                "div"
            );

        box.id =
            "remote-" + id;

        box.className =
            "mini-video";

        qs("#participants")
            .appendChild(box);

    }

    box.innerHTML = `
        <video
            autoplay
            playsinline
        ></video>

        <span class="mini-name">
            ${escapeHtml(p.name)}
        </span>
    `;

    box.querySelector(
        "video"
    ).srcObject =
        p.stream;

}


async function handleSignal(
    data
) {

    if (
        data.to !==
        clientId
    )
        return;

    const remote =
        participantByClient(
            data.from
        );

    if (!remote)
        return;

    const pc =
        createPeer(remote);

    try {

        if (
            data.kind ===
            "offer"
        ) {

            await pc.setRemoteDescription(
                data.payload
            );

            const answer =
                await pc.createAnswer();

            await pc.setLocalDescription(
                answer
            );

            await sendEvent(
                "signal",
                {
                    to:
                        data.from,

                    from:
                        clientId,

                    kind:
                        "answer",

                    payload:
                        pc.localDescription
                }
            );

        }

        else if (
            data.kind ===
            "answer"
        ) {

            if (
                pc.signalingState !==
                "stable"
            ) {

                await pc.setRemoteDescription(
                    data.payload
                );

            }

        }

        else if (
            data.kind ===
            "ice"
        ) {

            try {

                await pc.addIceCandidate(
                    data.payload
                );

            } catch {}

        }

    } catch (e) {

        console.debug(
            "signal",
            e
        );

    }

}


/* ================================
   EVENT HANDLING
================================ */

async function handleEvent(
    ev
) {

    const d =
        ev.data || {};

    if (
        ev.type ===
        "stroke"
    ) {

        if (
            d.clientId ===
            clientId
        )
            return;

        drawStroke(d);

        return;

    }

    if (
        ev.type ===
        "clear"
    ) {

        ctx.save();

        ctx.setTransform(
            1,
            0,
            0,
            1,
            0,
            0
        );

        ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        ctx.restore();

        return;

    }

    if (
        ev.type ===
        "snapshot"
    ) {

        if (
            d.to &&
            d.to !== clientId
        )
            return;

        if (
            d.clientId ===
            clientId
        )
            return;

        if (d.image)
            restoreSnapshot(
                d.image
            );

        return;

    }

    if (
        ev.type ===
        "chat"
    ) {

        addMessage(
            ev.from?.fullName ||
            "Participant",
            d.text || ""
        );

        return;

    }

    if (
        ev.type ===
        "signal"
    ) {

        await handleSignal(d);

        return;

    }

    if (
        ev.type ===
        "media"
    ) {

        if (
            d.action ===
                "joined" &&
            d.clientId !==
                clientId
        ) {

            if (
                me.role === "TEACHER" ||
                me.role === "ADMIN"
            ) {

                await sendEvent(
                    "snapshot",
                    {
                        to:
                            d.clientId,

                        image:
                            canvas.toDataURL(
                                "image/png"
                            )
                    }
                );

            }

            await refreshPresence();

            await syncPeers();

        }

        return;

    }

    if (
        ev.type ===
        "room_control"
    ) {

        if (
            d.status ===
            "ENDED"
        ) {

            showEnded(
                "Classroom ended",
                "The teacher has ended this classroom."
            );

            return;

        }

        if (d.settings) {

            room.settings =
                d.settings;

            qs("#settingDrawing")
                .checked =
                d.settings
                    .allowStudentDrawing;

            qs("#settingMic")
                .checked =
                d.settings
                    .allowStudentMicrophone;

            qs("#settingCamera")
                .checked =
                d.settings
                    .allowStudentCamera;

            qs("#settingScreen")
                .checked =
                d.settings
                    .allowStudentScreenSharing;

        }

        if (
            d.target === clientId &&
            d.action === "mute" &&
            localStream
        ) {

            localStream
                .getAudioTracks()
                .forEach(
                    t =>
                        t.enabled =
                            false
                );

        }

        if (
            d.target === clientId &&
            d.action === "kick"
        ) {

            kicked = true;

            showEnded(
                "Removed from classroom",
                "The teacher removed you from this classroom."
            );

        }

    }

}


function showEnded(
    title,
    text
) {

    qs("#endTitle")
        .textContent =
        title;

    qs("#endText")
        .textContent =
        text;

    endOverlay.classList.add(
        "show"
    );

    localStream
        ?.getTracks()
        .forEach(
            t => t.stop()
        );

    screenStream
        ?.getTracks()
        .forEach(
            t => t.stop()
        );

    peers.forEach(
        p =>
            p.pc.close()
    );

}


/* ================================
   PARTICIPANTS / TEACHER
================================ */

function renderParticipants() {

    qs("#participantCount")
        .textContent =
        `${participants.length} participant${participants.length === 1 ? "" : "s"}`;

    const list =
        qs("#peopleList");

    list.innerHTML =
        participants
            .map(
                p => `

                <div class="person">

                    <span>
                        ${escapeHtml(p.fullName)}
                        <small>
                            ${p.role}
                        </small>
                    </span>

                    ${
                        (
                            me.role === "TEACHER" ||
                            me.role === "ADMIN"
                        )
                        &&
                        p.id !== me.id

                        ? `

                        <span>

                            <button
                                data-mute="${p.clientId}"
                            >
                                Mute
                            </button>

                            <button
                                class="kick"
                                data-kick="${p.clientId}"
                            >
                                Kick
                            </button>

                        </span>

                        `
                        : ""
                    }

                </div>

                `
            )
            .join("");

    list
        .querySelectorAll(
            "[data-mute]"
        )
        .forEach(
            b =>
                b.onclick =
                    () =>
                        sendEvent(
                            "room_control",
                            {
                                action:
                                    "mute",

                                target:
                                    b.dataset.mute
                            }
                        )
        );

    list
        .querySelectorAll(
            "[data-kick]"
        )
        .forEach(
            b =>
                b.onclick =
                    () =>
                        sendEvent(
                            "room_control",
                            {
                                action:
                                    "kick",

                                target:
                                    b.dataset.kick
                            }
                        )
        );

}


qs("#participantsBtn")
    .onclick =
    () => {

        qs("#controlPanel")
            .classList.toggle(
                "show"
            );

        renderParticipants();

    };


qs("#saveSettings")
    .onclick =
    async () => {

        if (
            ![
                "TEACHER",
                "ADMIN"
            ].includes(
                me.role
            )
        )
            return;

        const body = {

            action:
                "settings",

            allowStudentDrawing:
                qs("#settingDrawing")
                    .checked,

            allowStudentMicrophone:
                qs("#settingMic")
                    .checked,

            allowStudentCamera:
                qs("#settingCamera")
                    .checked,

            allowStudentScreenSharing:
                qs("#settingScreen")
                    .checked

        };

        await api(
            `/api/classrooms/${encodeURIComponent(roomId)}`,
            {
                method: "PATCH",

                body:
                    JSON.stringify(body)
            }
        );

        room.settings = {
            ...body
        };

        delete room.settings.action;

        await sendEvent(
            "room_control",
            {
                settings:
                    room.settings
            }
        );

        showToast(
            "Classroom settings saved"
        );

    };


qs("#endBtn")
    .onclick =
    async () => {

        if (
            !confirm(
                "End this classroom for everyone?"
            )
        )
            return;

        await api(
            `/api/classrooms/${encodeURIComponent(roomId)}`,
            {
                method: "PATCH",

                body:
                    JSON.stringify({
                        action:
                            "end"
                    })
            }
        );

        showEnded(
            "Classroom ended",
            "The teacher ended this classroom."
        );

    };


qs("#leaveBtn")
    .onclick =
    () => {

        if (
            confirm(
                "Leave this classroom?"
            )
        )
            location.href =
                "/dashboard.html";

    };


qs("#toolsToggle")
    .onclick =
    () =>
        document
            .querySelectorAll(
                ".tool"
            )
            .forEach(
                b =>
                    b.classList.toggle(
                        "compact"
                    )
            );


init();

})();