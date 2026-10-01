const token = localStorage.getItem("smartboard_token");

if (!token) {
    window.location.href = "login.html";
}

const classroomsContainer =
    document.getElementById("classrooms");

const createDialog =
    document.getElementById("createDialog");

const createClassBtn =
    document.getElementById("createClassBtn");

const cancelCreate =
    document.getElementById("cancelCreate");

const createClassForm =
    document.getElementById("createClassForm");

const userName =
    document.getElementById("userName");

const welcomeName =
    document.getElementById("welcomeName");

async function api(url, options = {}) {

    const response = await fetch(url, {
        ...options,

        headers: {
            "Content-Type": "application/json",

            "Authorization":
                `Bearer ${token}`,

            ...(options.headers || {})
        }
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message || "Request failed"
        );
    }

    return data;
}

function getUser() {

    try {
        const user =
            JSON.parse(
                localStorage.getItem("smartboard_user")
            );

        return user;
    } catch {
        return null;
    }
}

function setupUser() {

    const user = getUser();

    if (!user) {
        return;
    }

    const name =
        user.name ||
        user.fullname ||
        "Teacher";

    userName.textContent = name;
    welcomeName.textContent = name;
}

function formatDate(date) {

    if (!date) {
        return "Unknown";
    }

    return new Date(date).toLocaleString();
}

function renderClassrooms(classrooms) {

    if (!classrooms.length) {

        classroomsContainer.innerHTML = `
            <div class="empty">
                <h3>No classrooms yet</h3>
                <p>
                    Click "Create Classroom" to start teaching.
                </p>
            </div>
        `;

        return;
    }

    classroomsContainer.innerHTML =
        classrooms.map(classroom => {

            const status =
                classroom.status || "LIVE";

            const statusClass =
                status.toLowerCase();

            return `
                <article class="class-card">

                    <span
                        class="status ${statusClass}"
                    >
                        ${status}
                    </span>

                    <h3>
                        ${escapeHtml(classroom.name)}
                    </h3>

                    <p class="subject">
                        ${escapeHtml(classroom.subject)}
                    </p>

                    <div class="card-info">

                        <div>
                            👥
                            ${classroom.participantCount}
                            /
                            ${classroom.maxParticipants}
                            participants
                        </div>

                        <div>
                            Created:
                            ${formatDate(classroom.createdAt)}
                        </div>

                    </div>

                    <div class="card-actions">

                        ${
                            status !== "ENDED"
                            ?
                            `
                            <button
                                class="enter-btn"
                                onclick="enterClassroom(
                                    '${classroom.classroomId}'
                                )"
                            >
                                Enter Classroom
                            </button>
                            `
                            :
                            ""
                        }

                    </div>

                </article>
            `;

        }).join("");
}

async function loadClassrooms() {

    try {

        const data =
            await api("/api/classrooms/list");

        renderClassrooms(
            data.classrooms || []
        );

    } catch (error) {

        classroomsContainer.innerHTML = `
            <div class="empty">
                ${escapeHtml(error.message)}
            </div>
        `;
    }
}

createClassBtn.addEventListener(
    "click",
    () => createDialog.showModal()
);

cancelCreate.addEventListener(
    "click",
    () => createDialog.close()
);

createClassForm.addEventListener(
    "submit",
    async event => {

        event.preventDefault();

        const button =
            createClassForm.querySelector(
                ".submit"
            );

        button.disabled = true;
        button.textContent = "Creating...";

        try {

            const data =
                await api(
                    "/api/classrooms/create",
                    {
                        method: "POST",

                        body: JSON.stringify({
                            name:
                                document.getElementById(
                                    "className"
                                ).value,

                            subject:
                                document.getElementById(
                                    "subject"
                                ).value,

                            description:
                                document.getElementById(
                                    "description"
                                ).value,

                            maxParticipants:
                                document.getElementById(
                                    "maxParticipants"
                                ).value,

                            allowStudentDrawing:
                                document.getElementById(
                                    "allowDrawing"
                                ).checked,

                            allowStudentMicrophone:
                                document.getElementById(
                                    "allowMic"
                                ).checked,

                            allowStudentCamera:
                                document.getElementById(
                                    "allowCamera"
                                ).checked,

                            allowStudentScreenSharing:
                                document.getElementById(
                                    "allowScreen"
                                ).checked
                        })
                    }
                );

            createDialog.close();

            createClassForm.reset();

            alert(
                `Classroom created!\n\n` +
                `Classroom ID: ` +
                `${data.classroom.classroomId}`
            );

            await loadClassrooms();

        } catch (error) {

            alert(error.message);

        } finally {

            button.disabled = false;
            button.textContent =
                "Create Classroom";
        }
    }
);

window.enterClassroom =
    function(classroomId) {

        window.location.href =
            `classroom.html?classroom=${encodeURIComponent(
                classroomId
            )}`;
    };

document.getElementById(
    "logoutBtn"
).addEventListener(
    "click",
    () => {

        localStorage.removeItem(
            "smartboard_token"
        );

        localStorage.removeItem(
            "smartboard_user"
        );

        window.location.href =
            "login.html";
    }
);

function escapeHtml(value) {

    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

setupUser();
loadClassrooms();