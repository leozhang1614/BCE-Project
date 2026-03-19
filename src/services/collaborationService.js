const { v4: uuidv4 } = require('uuid');

class CollaborationService {
  constructor() {
    this.sessions = new Map();
  }

  async createSession(data) {
    const session = {
      id: uuidv4(),
      ...data,
      participants: [],
      createdAt: new Date().toISOString()
    };
    this.sessions.set(session.id, session);
    return session;
  }

  async getSession(id) {
    return this.sessions.get(id);
  }

  async addParticipant(sessionId, participant) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('会话不存在');
    session.participants.push({
      ...participant,
      joinedAt: new Date().toISOString()
    });
    return session;
  }
}

module.exports = new CollaborationService();
