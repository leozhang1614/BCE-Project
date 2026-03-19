const { v4: uuidv4 } = require('uuid');

class AgentService {
  constructor() {
    this.agents = new Map();
  }

  async getAllAgents() {
    return Array.from(this.agents.values());
  }

  async registerAgent(data) {
    const agent = {
      id: uuidv4(),
      ...data,
      status: 'online',
      registeredAt: new Date().toISOString(),
      lastHeartbeat: new Date().toISOString()
    };
    this.agents.set(agent.id, agent);
    return agent;
  }

  async getAgentStatus(id) {
    const agent = this.agents.get(id);
    if (!agent) throw new Error('Agent 不存在');
    return {
      id: agent.id,
      status: agent.status,
      lastHeartbeat: agent.lastHeartbeat
    };
  }
}

module.exports = new AgentService();
