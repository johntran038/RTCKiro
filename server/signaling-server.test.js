import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocket, WebSocketServer } from 'ws';
import express from 'express';
import { createServer } from 'http';

describe('Signaling Server', () => {
  let server;
  let wss;
  let httpServer;
  let port;
  let clients = [];

  beforeEach(async () => {
    // Create a test server instance
    const app = express();
    httpServer = createServer(app);
    wss = new WebSocketServer({ server: httpServer });

    // In-memory storage for rooms and participants
    const rooms = new Map();
    const participants = new Map();

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        rooms: rooms.size,
        connections: participants.size 
      });
    });

    // WebSocket connection handler
    wss.on('connection', (ws) => {
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          handleMessage(ws, message);
        } catch (error) {
          ws.send(JSON.stringify({ 
            type: 'error', 
            payload: { message: 'Invalid message format' } 
          }));
        }
      });

      ws.on('close', () => {
        handleDisconnect(ws);
      });

      ws.on('error', (error) => {
        handleDisconnect(ws);
      });
    });

    // Message handler dispatcher
    function handleMessage(ws, message) {
      const { type } = message;

      switch (type) {
        case 'join-room':
          handleJoinRoom(ws, message);
          break;
        case 'leave-room':
          handleLeaveRoom(ws, message);
          break;
        case 'offer':
          handleOffer(ws, message);
          break;
        case 'answer':
          handleAnswer(ws, message);
          break;
        case 'ice-candidate':
          handleIceCandidate(ws, message);
          break;
        default:
          ws.send(JSON.stringify({ 
            type: 'error', 
            payload: { message: `Unknown message type: ${type}` } 
          }));
      }
    }

    // Join room handler
    function handleJoinRoom(ws, message) {
      const { roomId, userId } = message;

      if (!roomId || !userId) {
        ws.send(JSON.stringify({ 
          type: 'error', 
          payload: { message: 'roomId and userId are required' } 
        }));
        return;
      }

      participants.set(ws, { userId, roomId });

      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
      }

      const room = rooms.get(roomId);
      
      const existingParticipants = [];
      room.forEach((participantWs) => {
        const participant = participants.get(participantWs);
        if (participant) {
          existingParticipants.push({ userId: participant.userId });
          
          participantWs.send(JSON.stringify({
            type: 'participant-joined',
            roomId,
            userId,
            payload: { userId }
          }));
        }
      });

      room.add(ws);

      ws.send(JSON.stringify({
        type: 'room-joined',
        roomId,
        userId,
        payload: { 
          participants: existingParticipants 
        }
      }));
    }

    // Leave room handler
    function handleLeaveRoom(ws, message) {
      const { roomId, userId } = message;
      
      if (!roomId || !userId) {
        return;
      }

      removeParticipantFromRoom(ws, roomId, userId);
    }

    // Offer handler
    function handleOffer(ws, message) {
      const { roomId, targetId, payload } = message;
      const sender = participants.get(ws);

      if (!sender || !targetId) {
        ws.send(JSON.stringify({ 
          type: 'error', 
          payload: { message: 'Invalid offer message' } 
        }));
        return;
      }

      const room = rooms.get(roomId);
      if (!room) {
        ws.send(JSON.stringify({ 
          type: 'error', 
          payload: { message: 'Room not found' } 
        }));
        return;
      }

      room.forEach((participantWs) => {
        const participant = participants.get(participantWs);
        if (participant && participant.userId === targetId) {
          participantWs.send(JSON.stringify({
            type: 'offer',
            roomId,
            userId: sender.userId,
            payload
          }));
        }
      });
    }

    // Answer handler
    function handleAnswer(ws, message) {
      const { roomId, targetId, payload } = message;
      const sender = participants.get(ws);

      if (!sender || !targetId) {
        ws.send(JSON.stringify({ 
          type: 'error', 
          payload: { message: 'Invalid answer message' } 
        }));
        return;
      }

      const room = rooms.get(roomId);
      if (!room) {
        ws.send(JSON.stringify({ 
          type: 'error', 
          payload: { message: 'Room not found' } 
        }));
        return;
      }

      room.forEach((participantWs) => {
        const participant = participants.get(participantWs);
        if (participant && participant.userId === targetId) {
          participantWs.send(JSON.stringify({
            type: 'answer',
            roomId,
            userId: sender.userId,
            payload
          }));
        }
      });
    }

    // ICE candidate handler
    function handleIceCandidate(ws, message) {
      const { roomId, targetId, payload } = message;
      const sender = participants.get(ws);

      if (!sender || !targetId) {
        ws.send(JSON.stringify({ 
          type: 'error', 
          payload: { message: 'Invalid ICE candidate message' } 
        }));
        return;
      }

      const room = rooms.get(roomId);
      if (!room) {
        return;
      }

      room.forEach((participantWs) => {
        const participant = participants.get(participantWs);
        if (participant && participant.userId === targetId) {
          participantWs.send(JSON.stringify({
            type: 'ice-candidate',
            roomId,
            userId: sender.userId,
            payload
          }));
        }
      });
    }

    // Handle disconnection
    function handleDisconnect(ws) {
      const participant = participants.get(ws);
      
      if (participant) {
        const { userId, roomId } = participant;
        removeParticipantFromRoom(ws, roomId, userId);
      }
      
      participants.delete(ws);
    }

    // Remove participant from room
    function removeParticipantFromRoom(ws, roomId, userId) {
      const room = rooms.get(roomId);
      
      if (room) {
        room.delete(ws);
        
        room.forEach((participantWs) => {
          participantWs.send(JSON.stringify({
            type: 'participant-left',
            roomId,
            userId,
            payload: { userId }
          }));
        });
        
        if (room.size === 0) {
          rooms.delete(roomId);
        }
      }
    }

    // Start server on random port
    await new Promise((resolve) => {
      httpServer.listen(0, () => {
        port = httpServer.address().port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    // Close all client connections
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.close();
      }
    });
    clients = [];

    // Close server
    await new Promise((resolve) => {
      wss.close(() => {
        httpServer.close(() => {
          resolve();
        });
      });
    });
  });

  // Helper function to create a client
  function createClient() {
    const client = new WebSocket(`ws://localhost:${port}`);
    clients.push(client);
    return client;
  }

  // Helper function to wait for client to be ready
  function waitForOpen(client) {
    return new Promise((resolve) => {
      if (client.readyState === WebSocket.OPEN) {
        resolve();
      } else {
        client.once('open', resolve);
      }
    });
  }

  // Helper function to wait for a message
  function waitForMessage(client) {
    return new Promise((resolve) => {
      client.once('message', (data) => {
        resolve(JSON.parse(data.toString()));
      });
    });
  }

  describe('Room Creation and Participant Tracking', () => {
    it('should create a room when first participant joins', async () => {
      const client = createClient();
      await waitForOpen(client);

      client.send(JSON.stringify({
        type: 'join-room',
        roomId: 'room1',
        userId: 'user1'
      }));

      const response = await waitForMessage(client);
      
      expect(response.type).toBe('room-joined');
      expect(response.roomId).toBe('room1');
      expect(response.userId).toBe('user1');
      expect(response.payload.participants).toEqual([]);
    });

    it('should track multiple participants in the same room', async () => {
      const client1 = createClient();
      const client2 = createClient();
      
      await waitForOpen(client1);
      await waitForOpen(client2);

      // First user joins
      client1.send(JSON.stringify({
        type: 'join-room',
        roomId: 'room1',
        userId: 'user1'
      }));

      await waitForMessage(client1);

      // Second user joins
      client2.send(JSON.stringify({
        type: 'join-room',
        roomId: 'room1',
        userId: 'user2'
      }));

      const [notification, joinResponse] = await Promise.all([
        waitForMessage(client1),
        waitForMessage(client2)
      ]);

      // Client1 should receive participant-joined notification
      expect(notification.type).toBe('participant-joined');
      expect(notification.userId).toBe('user2');

      // Client2 should receive room-joined with existing participants
      expect(joinResponse.type).toBe('room-joined');
      expect(joinResponse.payload.participants).toHaveLength(1);
      expect(joinResponse.payload.participants[0].userId).toBe('user1');
    });

    it('should handle multiple rooms independently', async () => {
      const client1 = createClient();
      const client2 = createClient();
      
      await waitForOpen(client1);
      await waitForOpen(client2);

      // User1 joins room1
      client1.send(JSON.stringify({
        type: 'join-room',
        roomId: 'room1',
        userId: 'user1'
      }));

      // User2 joins room2
      client2.send(JSON.stringify({
        type: 'join-room',
        roomId: 'room2',
        userId: 'user2'
      }));

      const [response1, response2] = await Promise.all([
        waitForMessage(client1),
        waitForMessage(client2)
      ]);

      expect(response1.roomId).toBe('room1');
      expect(response2.roomId).toBe('room2');
      expect(response1.payload.participants).toEqual([]);
      expect(response2.payload.participants).toEqual([]);
    });

    it('should reject join-room without roomId or userId', async () => {
      const client = createClient();
      await waitForOpen(client);

      client.send(JSON.stringify({
        type: 'join-room',
        roomId: 'room1'
        // Missing userId
      }));

      const response = await waitForMessage(client);
      
      expect(response.type).toBe('error');
      expect(response.payload.message).toBe('roomId and userId are required');
    });
  });

  describe('Message Relay Between Participants', () => {
    it('should relay offer from one participant to another', async () => {
      const client1 = createClient();
      const client2 = createClient();
      
      await waitForOpen(client1);
      await waitForOpen(client2);

      // Both join the same room
      client1.send(JSON.stringify({
        type: 'join-room',
        roomId: 'room1',
        userId: 'user1'
      }));

      await waitForMessage(client1);

      client2.send(JSON.stringify({
        type: 'join-room',
        roomId: 'room1',
        userId: 'user2'
      }));

      await waitForMessage(client1); // participant-joined notification
      await waitForMessage(client2); // room-joined response

      // Client1 sends offer to client2
      const offerPayload = { sdp: 'mock-sdp-offer', type: 'offer' };
      client1.send(JSON.stringify({
        type: 'offer',
        roomId: 'room1',
        targetId: 'user2',
        payload: offerPayload
      }));

      const offerMessage = await waitForMessage(client2);
      
      expect(offerMessage.type).toBe('offer');
      expect(offerMessage.userId).toBe('user1');
      expect(offerMessage.payload).toEqual(offerPayload);
    });

    it('should relay answer from one participant to another', async () => {
      const client1 = createClient();
      const client2 = createClient();
      
      await waitForOpen(client1);
      await waitForOpen(client2);

      // Both join the same room
      client1.send(JSON.stringify({
        type: 'join-room',
        roomId: 'room1',
        userId: 'user1'
      }));

      await waitForMessage(client1);

      client2.send(JSON.stringify({
        type: 'join-room',
        roomId: 'room1',
        userId: 'user2'
      }));

      await waitForMessage(client1);
      await waitForMessage(client2);

      // Client2 sends answer to client1
      const answerPayload = { sdp: 'mock-sdp-answer', type: 'answer' };
      client2.send(JSON.stringify({
        type: 'answer',
        roomId: 'room1',
        targetId: 'user1',
        payload: answerPayload
      }));

      const answerMessage = await waitForMessage(client1);
      
      expect(answerMessage.type).toBe('answer');
      expect(answerMessage.userId).toBe('user2');
      expect(answerMessage.payload).toEqual(answerPayload);
    });

    it('should relay ICE candidates between participants', async () => {
      const client1 = createClient();
      const client2 = createClient();
      
      await waitForOpen(client1);
      await waitForOpen(client2);

      // Both join the same room
      client1.send(JSON.stringify({
        type: 'join-room',
        roomId: 'room1',
        userId: 'user1'
      }));

      await waitForMessage(client1);

      client2.send(JSON.stringify({
        type: 'join-room',
        roomId: 'room1',
        userId: 'user2'
      }));

      await waitForMessage(client1);
      await waitForMessage(client2);

      // Client1 sends ICE candidate to client2
      const candidatePayload = { 
        candidate: 'mock-ice-candidate',
        sdpMLineIndex: 0,
        sdpMid: 'audio'
      };
      client1.send(JSON.stringify({
        type: 'ice-candidate',
        roomId: 'room1',
        targetId: 'user2',
        payload: candidatePayload
      }));

      const candidateMessage = await waitForMessage(client2);
      
      expect(candidateMessage.type).toBe('ice-candidate');
      expect(candidateMessage.userId).toBe('user1');
      expect(candidateMessage.payload).toEqual(candidatePayload);
    });

    it('should return error when relaying to non-existent room', async () => {
      const client = createClient();
      await waitForOpen(client);

      client.send(JSON.stringify({
        type: 'join-room',
        roomId: 'room1',
        userId: 'user1'
      }));

      await waitForMessage(client);

      // Try to send offer to non-existent room
      client.send(JSON.stringify({
        type: 'offer',
        roomId: 'room2',
        targetId: 'user2',
        payload: { sdp: 'test' }
      }));

      const response = await waitForMessage(client);
      
      expect(response.type).toBe('error');
      expect(response.payload.message).toBe('Room not found');
    });
  });

  describe('Cleanup on Disconnect', () => {
    it('should notify other participants when a user disconnects', async () => {
      const client1 = createClient();
      const client2 = createClient();
      
      await waitForOpen(client1);
      await waitForOpen(client2);

      // Both join the same room
      client1.send(JSON.stringify({
        type: 'join-room',
        roomId: 'room1',
        userId: 'user1'
      }));

      await waitForMessage(client1);

      client2.send(JSON.stringify({
        type: 'join-room',
        roomId: 'room1',
        userId: 'user2'
      }));

      await waitForMessage(client1);
      await waitForMessage(client2);

      // Client2 disconnects
      client2.close();

      const notification = await waitForMessage(client1);
      
      expect(notification.type).toBe('participant-left');
      expect(notification.userId).toBe('user2');
      expect(notification.roomId).toBe('room1');
    });

    it('should clean up empty rooms after all participants leave', async () => {
      const client1 = createClient();
      const client2 = createClient();
      
      await waitForOpen(client1);
      await waitForOpen(client2);

      // Both join the same room
      client1.send(JSON.stringify({
        type: 'join-room',
        roomId: 'room1',
        userId: 'user1'
      }));

      await waitForMessage(client1);

      client2.send(JSON.stringify({
        type: 'join-room',
        roomId: 'room1',
        userId: 'user2'
      }));

      await waitForMessage(client1);
      await waitForMessage(client2);

      // Both clients disconnect
      client1.close();
      await waitForMessage(client2); // participant-left notification
      
      client2.close();

      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));

      // Room should be cleaned up (we can't directly test this without exposing internal state,
      // but we can verify by checking health endpoint)
      const response = await fetch(`http://localhost:${port}/health`);
      const health = await response.json();
      
      expect(health.rooms).toBe(0);
      expect(health.connections).toBe(0);
    });

    it('should handle explicit leave-room message', async () => {
      const client1 = createClient();
      const client2 = createClient();
      
      await waitForOpen(client1);
      await waitForOpen(client2);

      // Both join the same room
      client1.send(JSON.stringify({
        type: 'join-room',
        roomId: 'room1',
        userId: 'user1'
      }));

      await waitForMessage(client1);

      client2.send(JSON.stringify({
        type: 'join-room',
        roomId: 'room1',
        userId: 'user2'
      }));

      await waitForMessage(client1);
      await waitForMessage(client2);

      // Client2 explicitly leaves
      client2.send(JSON.stringify({
        type: 'leave-room',
        roomId: 'room1',
        userId: 'user2'
      }));

      const notification = await waitForMessage(client1);
      
      expect(notification.type).toBe('participant-left');
      expect(notification.userId).toBe('user2');
    });

    it('should handle multiple participants leaving sequentially', async () => {
      const client1 = createClient();
      const client2 = createClient();
      const client3 = createClient();
      
      await waitForOpen(client1);
      await waitForOpen(client2);
      await waitForOpen(client3);

      // All join the same room
      client1.send(JSON.stringify({
        type: 'join-room',
        roomId: 'room1',
        userId: 'user1'
      }));

      await waitForMessage(client1);

      client2.send(JSON.stringify({
        type: 'join-room',
        roomId: 'room1',
        userId: 'user2'
      }));

      await waitForMessage(client1);
      await waitForMessage(client2);

      client3.send(JSON.stringify({
        type: 'join-room',
        roomId: 'room1',
        userId: 'user3'
      }));

      await waitForMessage(client1);
      await waitForMessage(client2);
      await waitForMessage(client3);

      // Client2 leaves
      client2.close();
      
      const notification1 = await waitForMessage(client1);
      const notification3 = await waitForMessage(client3);
      
      expect(notification1.type).toBe('participant-left');
      expect(notification1.userId).toBe('user2');
      expect(notification3.type).toBe('participant-left');
      expect(notification3.userId).toBe('user2');

      // Client3 leaves
      client3.close();
      
      const notification2 = await waitForMessage(client1);
      
      expect(notification2.type).toBe('participant-left');
      expect(notification2.userId).toBe('user3');
    });
  });
});
