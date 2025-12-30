import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

class TaskManager {
    constructor() {
        this.tasksPath = path.resolve(process.cwd(), 'data', 'tasks.json');
        this.tasks = [];
        this.init();
    }

    init() {
        // Ensure data directory exists
        const dir = path.dirname(this.tasksPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Load tasks if file exists
        if (fs.existsSync(this.tasksPath)) {
            try {
                this.tasks = JSON.parse(fs.readFileSync(this.tasksPath, 'utf8'));
            } catch (e) {
                console.error("Failed to load tasks:", e);
                this.tasks = [];
            }
        } else {
            this.saveTasks();
        }
    }

    saveTasks() {
        try {
            fs.writeFileSync(this.tasksPath, JSON.stringify(this.tasks, null, 2));
        } catch (e) {
            console.error("Failed to save tasks:", e);
        }
    }

    getTasks() {
        return this.tasks;
    }

    getPendingTasks() {
        return this.tasks.filter(t => !t.completed);
    }

    addTask(taskData) {
        const newTask = {
            id: uuidv4(),
            title: taskData.title,
            description: taskData.description || "",
            dueTime: taskData.dueTime || null,
            reminderTime: taskData.reminderTime || null,
            completed: false,
            createdAt: new Date().toISOString(),
            ...taskData
        };
        this.tasks.push(newTask);
        this.saveTasks();
        return newTask;
    }

    updateTask(id, updates) {
        const index = this.tasks.findIndex(t => t.id === id);
        if (index !== -1) {
            this.tasks[index] = { ...this.tasks[index], ...updates };
            this.saveTasks();
            return this.tasks[index];
        }
        return null;
    }

    deleteTask(id) {
        const index = this.tasks.findIndex(t => t.id === id);
        if (index !== -1) {
            const deletedTask = this.tasks.splice(index, 1);
            this.saveTasks();
            return deletedTask[0];
        }
        return null;
    }

    getDueSoonTasks(minutes = 15) {
        const now = new Date();
        const future = new Date(now.getTime() + minutes * 60000);

        return this.tasks.filter(t => {
            if (t.completed || !t.dueTime) return false;
            const due = new Date(t.dueTime);
            return due > now && due <= future;
        });
    }

    getSummary() {
        const total = this.tasks.length;
        const completed = this.tasks.filter(t => t.completed).length;
        const pending = total - completed;
        return { total, completed, pending };
    }
}

export default new TaskManager();
