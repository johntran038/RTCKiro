import { WebSocketServer } from 'ws';
import express from 'express';
import { createServer } from 'http';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// In-memory storage for rooms and participants
const rooms = new Map(); // roomId -> Set of WebSocket connections
const participants = new Map(); // WebSocket -> { userId, roomId }

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
  console.log('New client connected');

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleMessage(ws, message);
    } catch (error) {
      console.error('Error parsing message:', error);
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
    console.error('WebSocket error:', error);
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

  // Store participant info
  participants.set(ws, { userId, roomId });

  // Create room if it doesn't exist
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }

  const room = rooms.get(roomId);
  
  // Notify existing participants about new joiner
  const existingParticipants = [];
  room.forEach((participantWs) => {
    const participant = participants.get(participantWs);
    if (participant) {
      existingParticipants.push({ userId: participant.userId });
      
      // Notify existing participant about new joiner
      participantWs.send(JSON.stringify({
        type: 'participant-joined',
        roomId,
        userId,
        payload: { userId }
      }));
    }
  });

  // Add new participant to room
  room.add(ws);

  // Send confirmation to new joiner with list of existing participants
  ws.send(JSON.stringify({
    type: 'room-joined',
    roomId,
    userId,
    payload: { 
      participants: existingParticipants 
    }
  }));

  console.log(`User ${userId} joined room ${roomId}. Room size: ${room.size}`);
}

// Leave room handler
function handleLeaveRoom(ws, message) {
  const { roomId, userId } = message;
  
  if (!roomId || !userId) {
    return;
  }

  removeParticipantFromRoom(ws, roomId, userId);
}

// Offer handler - relay to target participant
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

  // Find target participant in the room
  const room = rooms.get(roomId);
  if (!room) {
    ws.send(JSON.stringify({ 
      type: 'error', 
      payload: { message: 'Room not found' } 
    }));
    return;
  }

  // Relay offer to target
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

// Answer handler - relay to target participant
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

  // Find target participant in the room
  const room = rooms.get(roomId);
  if (!room) {
    ws.send(JSON.stringify({ 
      type: 'error', 
      payload: { message: 'Room not found' } 
    }));
    return;
  }

  // Relay answer to target
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

// ICE candidate handler - relay to target participant
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

  // Find target participant in the room
  const room = rooms.get(roomId);
  if (!room) {
    return; // Silently ignore if room doesn't exist
  }

  // Relay ICE candidate to target
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

// Handle disconnection and cleanup
function handleDisconnect(ws) {
  const participant = participants.get(ws);
  
  if (participant) {
    const { userId, roomId } = participant;
    console.log(`User ${userId} disconnected from room ${roomId}`);
    
    removeParticipantFromRoom(ws, roomId, userId);
  }
  
  participants.delete(ws);
}

// Remove participant from room and notify others
function removeParticipantFromRoom(ws, roomId, userId) {
  const room = rooms.get(roomId);
  
  if (room) {
    room.delete(ws);
    
    // Notify remaining participants
    room.forEach((participantWs) => {
      participantWs.send(JSON.stringify({
        type: 'participant-left',
        roomId,
        userId,
        payload: { userId }
      }));
    });
    
    // Clean up empty rooms
    if (room.size === 0) {
      rooms.delete(roomId);
      console.log(`Room ${roomId} deleted (empty)`);
    } else {
      console.log(`User ${userId} left room ${roomId}. Room size: ${room.size}`);
    }
  }
}

// Start server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
