const { v4: uuidv4 } = require('uuid');

class TaskService {
  constructor() {
    this.tasks = new Map();
  }

  async getAllTasks() {
    return Array.from(this.tasks.values());
  }

  async createTask(data) {
    const task = {
      id: uuidv4(),
      ...data,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.tasks.set(task.id, task);
    return task;
  }

  async getTaskById(id) {
    return this.tasks.get(id);
  }

  async updateTask(id, data) {
    const task = this.tasks.get(id);
    if (!task) throw new Error('任务不存在');
    const updated = {
      ...task,
      ...data,
      updatedAt: new Date().toISOString()
    };
    this.tasks.set(id, updated);
    return updated;
  }

  async deleteTask(id) {
    this.tasks.delete(id);
  }
}

module.exports = new TaskService();
