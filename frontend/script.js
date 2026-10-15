
const API_URL = "/api/tasks";

const taskForm = document.getElementById("taskForm");
const taskInput = document.getElementById("taskInput");
const taskList = document.getElementById("taskList");
const emptyState = document.getElementById("emptyState");
const loadingState = document.getElementById("loadingState");
const errorBanner = document.getElementById("errorBanner");
const clearButton = document.getElementById("clearCompleted");

let tasks = [];
let currentFilter = "all";
let isSaving = false;

// Make requests to the FastAPI backend
async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...options.headers
        }
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Request failed");
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
}

// Load tasks when the page opens

async function loadTasks() {
    loadingState.hidden = false;
    taskList.hidden = true;
    emptyState.hidden = true;
    errorBanner.hidden = true;

    try {
        const response = await fetch("/api/tasks");

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        tasks = await response.json();

        renderTasks();
    } catch (error) {
        console.error("Failed to load tasks:", error);

        errorBanner.textContent =
            "Unable to load tasks. Please check the backend.";
        errorBanner.hidden = false;

        emptyState.hidden = true;
        taskList.hidden = true;
    } finally {
        loadingState.hidden = true;
    }
}


// Display tasks on the page
function renderTasks() {
    taskList.replaceChildren();

    const visibleTasks = tasks.filter(task => {
        if (currentFilter === "active") return !task.completed;
        if (currentFilter === "completed") return task.completed;
        return true;
    });

    visibleTasks.forEach(task => {
        const item = document.createElement("div");
        item.className = "task-item";

        if (task.completed) {
            item.classList.add("completed");
        }

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "task-check";
        checkbox.checked = task.completed;
        checkbox.disabled = isSaving;

        checkbox.addEventListener("change", () => {
            toggleTask(task);
        });

        const content = document.createElement("div");
        content.className = "task-content";

        const title = document.createElement("span");
        title.className = "task-text";
        title.textContent = task.title;

        const date = document.createElement("span");
        date.className = "task-date";
        date.textContent = task.created_at
            ? "Added " + new Date(task.created_at).toLocaleDateString()
            : "";

        content.append(title, date);

        const status = document.createElement("span");
        status.className = task.completed
            ? "task-status status-done"
            : "task-status status-open";
        status.textContent = task.completed ? "Completed" : "Pending";

        const deleteButton = document.createElement("button");
        deleteButton.className = "delete-button";
        deleteButton.textContent = "Delete";
        deleteButton.type = "button";
        deleteButton.disabled = isSaving;

        deleteButton.addEventListener("click", () => {
            deleteTask(task);
        });

        item.append(checkbox, content, status, deleteButton);
        taskList.appendChild(item);
    });

    taskList.hidden = visibleTasks.length === 0;
    emptyState.hidden = visibleTasks.length !== 0;

    document.getElementById("emptyTitle").textContent =
        currentFilter === "completed"
            ? "No completed tasks"
            : currentFilter === "active"
                ? "You're all caught up!"
                : "No tasks yet!";

    document.getElementById("emptyMessage").textContent =
        currentFilter === "completed"
            ? "Complete a task and it will appear here."
            : currentFilter === "active"
                ? "You have no pending tasks."
                : "Add your first task to get started.";

    document.querySelectorAll(".filter-btn").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.filter === currentFilter
        );
    });

    clearButton.disabled =
        isSaving || !tasks.some(task => task.completed);
}

// Add a new task
async function addTask(event) {
    event.preventDefault();

    const title = taskInput.value.trim();

    if (!title || isSaving) return;

    setSaving(true);

    try {
        const task = await apiRequest(API_URL, {
            method: "POST",
            body: JSON.stringify({ title })
        });

        tasks.unshift(task);
        taskInput.value = "";
        currentFilter = "all";
        errorBanner.hidden = true;

        renderTasks();
    } catch (error) {
        errorBanner.textContent = "Could not add task: " + error.message;
        errorBanner.hidden = false;
    } finally {
        setSaving(false);
    }
}

// Complete or reopen a task
async function toggleTask(task) {
    if (isSaving) return;

    setSaving(true);

    try {
        const updatedTask = await apiRequest(
            `${API_URL}/${task.id}`,
            {
                method: "PATCH",
                body: JSON.stringify({
                    completed: !task.completed
                })
            }
        );

        tasks = tasks.map(item =>
            item.id === updatedTask.id ? updatedTask : item
        );

        errorBanner.hidden = true;
        renderTasks();
    } catch (error) {
        errorBanner.textContent = "Could not update task: " + error.message;
        errorBanner.hidden = false;
    } finally {
        setSaving(false);
    }
}

// Delete a task
async function deleteTask(task) {
    if (isSaving) return;

    setSaving(true);

    try {
        await apiRequest(`${API_URL}/${task.id}`, {
            method: "DELETE"
        });

        tasks = tasks.filter(item => item.id !== task.id);
        errorBanner.hidden = true;
        renderTasks();
    } catch (error) {
        errorBanner.textContent = "Could not delete task: " + error.message;
        errorBanner.hidden = false;
    } finally {
        setSaving(false);
    }
}

// Remove all completed tasks
async function clearCompleted() {
    if (isSaving || !tasks.some(task => task.completed)) return;

    setSaving(true);

    try {
        await apiRequest(API_URL, {
            method: "DELETE"
        });

        tasks = tasks.filter(task => !task.completed);
        errorBanner.hidden = true;
        renderTasks();
    } catch (error) {
        errorBanner.textContent = "Could not clear tasks: " + error.message;
        errorBanner.hidden = false;
    } finally {
        setSaving(false);
    }
}

function setSaving(value) {
    isSaving = value;
    taskInput.disabled = value;
    taskForm.querySelector("button").disabled = value;
    renderTasks();
}

// Button events
taskForm.addEventListener("submit", addTask);
clearButton.addEventListener("click", clearCompleted);

document.querySelectorAll(".filter-btn").forEach(button => {
    button.addEventListener("click", () => {
        currentFilter = button.dataset.filter;
        renderTasks();
    });
});

// Start the app
loadTasks();
