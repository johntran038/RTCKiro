# Design Document: WebRTC Video and Voice Calling

## Overview

This design implements a WebRTC-based video and voice calling system for a React application. The system enables multiple users to join virtual rooms and communicate via real-time audio and video streams using peer-to-peer connections.

The implementation follows a mesh topology where each participant maintains direct peer connections with all other participants in the room. For signaling (the coordination mechanism needed to establish WebRTC connections), we'll use a WebSocket-based signaling server that relays connection metadata between peers.

### Key Design Decisions

1. **Mesh Topology**: Each peer connects directly to every other peer. This is simple to implement and works well for small groups (2-6 participants). For larger groups, a Selective Forwarding Unit (SFU) would be more appropriate, but that's beyond the scope of this initial implementation.

2. **WebSocket Signaling**: We'll use WebSocket for real-time bidirectional communication between clients and the signaling server. This is the standard approach for WebRTC signaling.

3. **Simple Signaling Server**: For this implementation, we'll use a lightweight Node.js WebSocket server (using `ws` library) that can be deployed alongside the React app or separately. For production, this could be replaced with a more robust solution.

4. **Redux State Management**: All WebRTC state (room info, participants, media streams, connection states) will be managed through Redux for predictable state updates and easy debugging.

5. **React Hooks for WebRTC Logic**: We'll encapsulate WebRTC logic in custom React hooks that interact with Redux, keeping components clean and focused on presentation.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React Application                        │
│  ┌────────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │  Room UI       │  │  Video Grid  │  │  Media Controls │ │
│  │  Component     │  │  Component   │  │  Component      │ │
│  └────────┬───────┘  └──────┬───────┘  └────────┬────────┘ │
│           │                  │                    │          │
│           └──────────────────┼────────────────────┘          │
│                              │                               │
│  ┌───────────────────────────▼────────────────────────────┐ │
│  │              Redux Store (WebRTC Slice)                │ │
│  │  - Room state                                          │ │
│  │  - Participants list                                   │ │
│  │  - Local/remote streams                                │ │
│  │  - Connection states                                   │ │
│  └───────────────────────────┬────────────────────────────┘ │
│                              │                               │
│  ┌───────────────────────────▼────────────────────────────┐ │
│  │         Custom Hooks (WebRTC Logic)                    │ │
│  │  - useWebRTC()                                         │ │
│  │  - useMediaDevices()                                   │ │
│  │  - usePeerConnection()                                 │ │
│  └───────────────────────────┬────────────────────────────┘ │
│                              │                               │
│  ┌───────────────────────────▼────────────────────────────┐ │
│  │         WebRTC Service Layer                           │ │
│  │  - SignalingClient (WebSocket)                         │ │
│  │  - PeerConnectionManager                               │ │
│  │  - MediaStreamManager                                  │ │
│  └───────────────────────────┬────────────────────────────┘ │
└────────────────────────────────┼────────────────────────────┘
                                 │
                                 │ WebSocket
                                 │
                    ┌────────────▼─────────────┐
                    │   Signaling Server       │
                    │   (Node.js + ws)         │
                    │                          │
                    │  - Room management       │
                    │  - Message relay         │
                    │  - Participant tracking  │
                    └──────────────────────────┘
```

### Component Interaction Flow

1. **User joins room**: UI component dispatches Redux action → WebRTC hook initiates connection to signaling server → Requests media devices
2. **Media access granted**: MediaStreamManager captures local stream → Dispatches action to store in Redux → UI displays local video
3. **Signaling connection established**: SignalingClient sends "join-room" message → Server notifies existing participants
4. **Peer connection setup**: For each existing participant, PeerConnectionManager creates RTCPeerConnection → Exchanges SDP and ICE candidates via signaling
5. **Media streaming**: Once peer connection is established, local stream is added → Remote stream received → UI displays remote video

## Components and Interfaces

### 1. Redux Slice: webrtcSlice.js

**State Shape:**
```javascript
{
  room: {
    id: string | null,
    joined: boolean,
    participants: Array<{
      id: string,
      name: string,
      connectionState: 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed'
    }>
  },
  localStream: {
    stream: MediaStream | null,
    audioEnabled: boolean,
    videoEnabled: boolean
  },
  remoteStreams: {
    [participantId: string]: MediaStream
  },
  signaling: {
    connected: boolean,
    error: string | null
  },
  errors: Array<{
    type: string,
    message: string,
    timestamp: number
  }>
}
```

**Actions:**
- `joinRoom(roomId)`: Initiates room join process
- `leaveRoom()`: Leaves current room and cleans up connections
- `setLocalStream(stream)`: Stores local media stream
- `toggleAudio()`: Toggles local audio track
- `toggleVideo()`: Toggles local video track
- `addRemoteStream(participantId, stream)`: Adds remote participant stream
- `removeRemoteStream(participantId)`: Removes remote participant stream
- `updateParticipant(participantId, updates)`: Updates participant state
- `addParticipant(participant)`: Adds new participant to room
- `removeParticipant(participantId)`: Removes participant from room
- `setSignalingConnected(connected)`: Updates signaling connection state
- `addError(error)`: Adds error to error log

### 2. SignalingClient Service

**Purpose**: Manages WebSocket connection to signaling server and handles message exchange.

**Interface:**
```javascript
class SignalingClient {
  constructor(serverUrl, dispatch)
  
  connect(): Promise<void>
  disconnect(): void
  
  joinRoom(roomId, userId): void
  leaveRoom(roomId, userId): void
  
  sendOffer(targetId, offer): void
  sendAnswer(targetId, answer): void
  sendIceCandidate(targetId, candidate): void
  
  on(event, handler): void
  off(event, handler): void
}
```

**Events Emitted:**
- `participant-joined`: When a new participant joins the room
- `participant-left`: When a participant leaves the room
- `offer`: When receiving an SDP offer from a peer
- `answer`: When receiving an SDP answer from a peer
- `ice-candidate`: When receiving an ICE candidate from a peer
- `error`: When a signaling error occurs

**Message Protocol:**
```javascript
// Client → Server
{
  type: 'join-room' | 'leave-room' | 'offer' | 'answer' | 'ice-candidate',
  roomId: string,
  userId: string,
  targetId?: string,  // For peer-to-peer messages
  payload: any
}

// Server → Client
{
  type: 'participant-joined' | 'participant-left' | 'offer' | 'answer' | 'ice-candidate' | 'error',
  roomId: string,
  userId: string,
  payload: any
}
```

### 3. PeerConnectionManager Service

**Purpose**: Manages RTCPeerConnection instances for each remote peer.

**Interface:**
```javascript
class PeerConnectionManager {
  constructor(localStream, dispatch, signalingClient)
  
  createPeerConnection(participantId): RTCPeerConnection
  closePeerConnection(participantId): void
  closeAllConnections(): void
  
  createOffer(participantId): Promise<RTCSessionDescriptionInit>
  createAnswer(participantId, offer): Promise<RTCSessionDescriptionInit>
  setRemoteDescription(participantId, description): Promise<void>
  addIceCandidate(participantId, candidate): Promise<void>
  
  getPeerConnection(participantId): RTCPeerConnection | null
}
```

**RTCPeerConnection Configuration:**
```javascript
{
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ],
  iceCandidatePoolSize: 10
}
```

**Connection Lifecycle:**
1. Create RTCPeerConnection with ICE servers
2. Add local stream tracks to connection
3. Set up event handlers (onicecandidate, ontrack, onconnectionstatechange)
4. Create and exchange SDP offer/answer
5. Exchange ICE candidates
6. Monitor connection state
7. Clean up on disconnect

### 4. MediaStreamManager Service

**Purpose**: Handles media device access and stream management.

**Interface:**
```javascript
class MediaStreamManager {
  constructor(dispatch)
  
  requestMediaAccess(constraints): Promise<MediaStream>
  stopMediaStream(stream): void
  toggleAudioTrack(stream, enabled): void
  toggleVideoTrack(stream, enabled): void
  
  getAvailableDevices(): Promise<Array<MediaDeviceInfo>>
  switchCamera(stream, deviceId): Promise<MediaStream>
  switchMicrophone(stream, deviceId): Promise<MediaStream>
}
```

**Default Media Constraints:**
```javascript
{
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  },
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 }
  }
}
```

### 5. Custom React Hooks

**useWebRTC Hook:**
```javascript
function useWebRTC(roomId) {
  // Returns:
  return {
    joinRoom: () => void,
    leaveRoom: () => void,
    toggleAudio: () => void,
    toggleVideo: () => void,
    localStream: MediaStream | null,
    remoteStreams: Map<string, MediaStream>,
    participants: Array<Participant>,
    isConnected: boolean,
    errors: Array<Error>
  }
}
```

**useMediaDevices Hook:**
```javascript
function useMediaDevices() {
  // Returns:
  return {
    devices: Array<MediaDeviceInfo>,
    requestPermissions: () => Promise<void>,
    switchDevice: (type, deviceId) => Promise<void>
  }
}
```

### 6. React Components

**RoomPage Component:**
- Main page component for video calling
- Handles room join/leave UI
- Displays VideoGrid and MediaControls
- Uses useWebRTC hook

**VideoGrid Component:**
- Displays all participant video streams in a grid layout
- Responsive layout (1, 2, 4, 6, 9 grid patterns)
- Shows participant names/IDs
- Highlights active speaker (optional enhancement)

**VideoTile Component:**
- Displays a single video stream
- Shows participant name
- Shows connection state indicator
- Shows muted/video-off indicators

**MediaControls Component:**
- Mute/unmute button
- Video on/off button
- Leave room button
- Device selection dropdown (optional)

**RoomJoin Component:**
- Room ID input field
- Join button
- Validation and error display

## Data Models

### Participant Model
```javascript
{
  id: string,              // Unique participant identifier
  name: string,            // Display name
  connectionState: string, // 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed'
  joinedAt: number        // Timestamp
}
```

### MediaStream Model
```javascript
{
  stream: MediaStream,     // Browser MediaStream object
  audioEnabled: boolean,   // Audio track enabled state
  videoEnabled: boolean,   // Video track enabled state
  participantId: string    // Owner of the stream
}
```

### SignalingMessage Model
```javascript
{
  type: string,           // Message type
  roomId: string,         // Target room
  userId: string,         // Sender ID
  targetId?: string,      // Recipient ID (for peer messages)
  payload: any,           // Message-specific data
  timestamp: number       // Message timestamp
}
```

### Error Model
```javascript
{
  type: string,           // 'media' | 'signaling' | 'peer-connection' | 'network'
  message: string,        // Human-readable error message
  details: any,           // Technical error details
  timestamp: number       // When error occurred
}
```

## Signaling Server Implementation

### Technology Stack
- **Node.js**: Runtime environment
- **ws**: WebSocket library
- **Express** (optional): For health checks and static file serving

### Server Structure
```javascript
// Simple in-memory room management
const rooms = new Map(); // roomId → Set<WebSocket>
const participants = new Map(); // WebSocket → { userId, roomId }

// Message handlers
function handleJoinRoom(ws, message) {
  // Add participant to room
  // Notify existing participants
  // Send current participants list to new joiner
}

function handleLeaveRoom(ws, message) {
  // Remove participant from room
  // Notify remaining participants
  // Clean up empty rooms
}

function handleOffer(ws, message) {
  // Forward offer to target participant
}

function handleAnswer(ws, message) {
  // Forward answer to target participant
}

function handleIceCandidate(ws, message) {
  // Forward ICE candidate to target participant
}
```

### Deployment Options
1. **Development**: Run locally on localhost:8080
2. **Production**: Deploy to cloud service (Heroku, AWS, DigitalOcean)
3. **Alternative**: Use a managed signaling service (PeerJS, Socket.io)


## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Room Join with Valid ID

*For any* valid room ID and user ID, calling the join room function should result in the Redux state showing joined=true, the room ID stored, and the user added to the participants list.

**Validates: Requirements 1.1, 1.3**

### Property 2: Invalid Room ID Rejection

*For any* invalid room ID (empty string, whitespace-only, or null), attempting to join should be rejected, the joined state should remain false, and an error should be added to the errors array.

**Validates: Requirements 1.2**

### Property 3: Room Leave Cleanup

*For any* room state with active peer connections and media streams, calling leave room should result in all peer connections being closed, all media streams being stopped, joined state set to false, and participants list cleared.

**Validates: Requirements 1.4**

### Property 4: Multiple Participants Support

*For any* room with N existing participants, when a new participant joins, the participants list should contain N+1 participants with unique IDs.

**Validates: Requirements 1.5**

### Property 5: Media Access Request

*For any* room join attempt, the system should call getUserMedia with audio and video constraints.

**Validates: Requirements 2.1**

### Property 6: Successful Media Capture

*For any* successful getUserMedia call returning a MediaStream, the local stream should be stored in Redux state with audioEnabled=true and videoEnabled=true.

**Validates: Requirements 2.2**

### Property 7: Media Permission Denial Handling

*For any* getUserMedia call that is rejected with a permission error, an error should be added to state and the user should still be able to join the room (joined can be true even without localStream).

**Validates: Requirements 2.3**

### Property 8: Media Device Error Handling

*For any* getUserMedia call that fails with a device error, the error should be caught, added to the errors array, and the application should not crash.

**Validates: Requirements 2.4**

### Property 9: Audio-Only Mode Support

*For any* media request with video:false constraint, the system should successfully capture an audio-only stream and store it in state.

**Validates: Requirements 2.5**

### Property 10: Peer Connection Creation for All Participants

*For any* room with N existing participants, when a new participant joins, N peer connections should be created (one for each existing participant).

**Validates: Requirements 3.1**

### Property 11: SDP Exchange via Signaling

*For any* peer connection establishment, the system should call sendOffer on the signaling client, and when an answer is received, it should be set as the remote description.

**Validates: Requirements 3.2**

### Property 12: ICE Candidate Exchange

*For any* peer connection that generates ICE candidates, each candidate should be sent via the signaling client to the remote peer.

**Validates: Requirements 3.3**

### Property 13: Local Stream Transmission

*For any* peer connection with a local stream, all tracks from the local stream should be added to the peer connection.

**Validates: Requirements 3.4**

### Property 14: Connection Failure Retry

*For any* peer connection that enters the 'failed' state, a reconnection attempt should be initiated and an error should be logged.

**Validates: Requirements 3.5**

### Property 15: Remote Stream Storage

*For any* remote stream received via the ontrack event, the stream should be added to the remoteStreams map in Redux state with the participant ID as the key.

**Validates: Requirements 4.1**

### Property 16: Local Stream Display

*For any* successful media capture, the local stream should be available in Redux state for rendering in the UI.

**Validates: Requirements 4.3**

### Property 17: Multiple Remote Streams Storage

*For any* room with N remote participants, the remoteStreams map should contain N entries, one for each participant.

**Validates: Requirements 4.4**

### Property 18: Audio Track Toggle

*For any* local stream with an audio track, calling toggleAudio should flip the track's enabled property (true→false or false→true) and update audioEnabled in Redux state accordingly.

**Validates: Requirements 5.1, 5.2**

### Property 19: Video Track Toggle

*For any* local stream with a video track, calling toggleVideo should flip the track's enabled property (true→false or false→true) and update videoEnabled in Redux state accordingly.

**Validates: Requirements 5.3, 5.4**

### Property 20: Media State Visibility

*For any* media state change (audio or video toggle), the audioEnabled and videoEnabled flags in Redux state should accurately reflect the current track enabled states.

**Validates: Requirements 5.5**

### Property 21: Signaling Message Processing

*For any* signaling message received (offer, answer, or ICE candidate), the system should process it by calling the appropriate method on the peer connection manager (setRemoteDescription or addIceCandidate).

**Validates: Requirements 6.1, 6.2, 6.3**

### Property 22: Participant Joined Event Handling

*For any* participant-joined event received from the signaling server, a new participant should be added to the participants list in Redux state.

**Validates: Requirements 6.4**

### Property 23: Participant Left Event Handling

*For any* participant-left event received from the signaling server, the specified participant should be removed from the participants list and their remote stream should be removed from remoteStreams.

**Validates: Requirements 6.5**

### Property 24: Connection State Updates

*For any* peer connection state change event, the corresponding participant's connectionState in Redux should be updated to match the new state.

**Validates: Requirements 7.1, 7.2**

### Property 25: Disconnection Handling

*For any* peer connection that enters the 'disconnected' state, the participant's connectionState should be updated and a reconnection attempt should be initiated.

**Validates: Requirements 7.3**

### Property 26: Permanent Failure Cleanup

*For any* peer connection that enters the 'failed' state and fails reconnection, the participant should be removed from the participants list.

**Validates: Requirements 7.4**

### Property 27: Connection State Logging

*For any* peer connection state change, a log entry should be created (console.log or logging service).

**Validates: Requirements 7.5**

### Property 28: Participant Data Availability

*For any* participant in the room, their name/ID should be stored in the participants array in Redux state for UI rendering.

**Validates: Requirements 8.5**

### Property 29: Error State Management

*For any* error that occurs (media, signaling, peer connection, or network), an error object with type, message, and timestamp should be added to the errors array in Redux state.

**Validates: Requirements 9.1, 9.2, 9.3, 9.4**

### Property 30: Graceful Error Handling

*For any* WebRTC API call that throws an error, the error should be caught and handled without crashing the application (no unhandled promise rejections or uncaught exceptions).

**Validates: Requirements 9.5**

### Property 31: Redux State Structure

*For any* WebRTC operation (join room, add participant, add stream, update connection state), the Redux state should maintain the correct structure with room, localStream, remoteStreams, signaling, and errors properties.

**Validates: Requirements 10.1, 10.2, 10.3**

### Property 32: Redux Action Dispatching

*For any* WebRTC event (participant joined, stream received, connection state changed), a corresponding Redux action should be dispatched to update the state.

**Validates: Requirements 10.4**

### Property 33: Redux Selector Correctness

*For any* Redux selector function, it should return the correct data from the state without mutations.

**Validates: Requirements 10.5**

## Error Handling

### Error Categories

1. **Media Errors**
   - Permission denied: User denies camera/microphone access
   - Device not found: No camera or microphone available
   - Device in use: Another application is using the device
   - Constraint not satisfied: Requested resolution/framerate not available

2. **Signaling Errors**
   - Connection failed: Cannot connect to signaling server
   - Connection lost: WebSocket disconnected
   - Message format error: Invalid message received
   - Room full: Maximum participants reached (if implemented)

3. **Peer Connection Errors**
   - ICE connection failed: Cannot establish network connectivity
   - Connection timeout: Peer doesn't respond
   - Negotiation failed: SDP exchange failed
   - Track addition failed: Cannot add media track

4. **Network Errors**
   - No internet connection
   - Firewall blocking WebRTC traffic
   - NAT traversal failed

### Error Handling Strategy

**User-Facing Errors:**
- Display clear, actionable error messages in the UI
- Provide troubleshooting steps (e.g., "Check camera permissions in browser settings")
- Allow users to retry failed operations
- Gracefully degrade (e.g., audio-only if video fails)

**Developer-Facing Errors:**
- Log all errors with full details to console
- Include error codes and stack traces
- Track error frequency for monitoring
- Provide context (which participant, which operation)

**Recovery Strategies:**
- Automatic retry with exponential backoff for transient errors
- Reconnection logic for signaling and peer connections
- Fallback to audio-only if video fails
- Clear error state after successful recovery

**Error State Management:**
```javascript
// Error object structure
{
  type: 'media' | 'signaling' | 'peer-connection' | 'network',
  code: string,  // e.g., 'PERMISSION_DENIED', 'CONNECTION_FAILED'
  message: string,  // User-friendly message
  details: any,  // Technical details for debugging
  timestamp: number,
  participantId?: string,  // If error is participant-specific
  recoverable: boolean  // Whether automatic retry is possible
}
```

## Testing Strategy

### Dual Testing Approach

This implementation requires both unit tests and property-based tests for comprehensive coverage:

**Unit Tests** focus on:
- Specific examples of correct behavior
- Edge cases (empty room, single participant, maximum participants)
- Error conditions (permission denied, connection failed)
- Integration between components (Redux actions → state updates)
- Mock WebRTC APIs (getUserMedia, RTCPeerConnection)

**Property-Based Tests** focus on:
- Universal properties that hold for all inputs
- State consistency across operations
- Invariants (e.g., participants list always matches peer connections)
- Round-trip properties (e.g., serialize/deserialize signaling messages)

### Property-Based Testing Configuration

**Library Selection:**
- **JavaScript/TypeScript**: Use `fast-check` library for property-based testing
- Install: `npm install --save-dev fast-check`

**Test Configuration:**
- Minimum 100 iterations per property test
- Each test must reference its design document property
- Tag format: `// Feature: webrtc-video-calling, Property N: [property text]`

**Example Property Test Structure:**
```javascript
import fc from 'fast-check';

// Feature: webrtc-video-calling, Property 1: Room Join with Valid ID
test('joining with valid room ID updates state correctly', () => {
  fc.assert(
    fc.property(
      fc.string({ minLength: 1 }), // Valid room ID
      fc.uuid(), // User ID
      (roomId, userId) => {
        // Test implementation
        const result = joinRoom(roomId, userId);
        expect(result.joined).toBe(true);
        expect(result.room.id).toBe(roomId);
      }
    ),
    { numRuns: 100 }
  );
});
```

### Test Organization

**Unit Tests:**
- `src/redux/slices/__tests__/webrtcSlice.test.js` - Redux slice tests
- `src/services/__tests__/SignalingClient.test.js` - Signaling client tests
- `src/services/__tests__/PeerConnectionManager.test.js` - Peer connection tests
- `src/services/__tests__/MediaStreamManager.test.js` - Media stream tests
- `src/hooks/__tests__/useWebRTC.test.js` - Custom hook tests

**Property-Based Tests:**
- `src/redux/slices/__tests__/webrtcSlice.properties.test.js` - State management properties
- `src/services/__tests__/SignalingClient.properties.test.js` - Signaling properties
- `src/services/__tests__/PeerConnectionManager.properties.test.js` - Connection properties

### Mocking Strategy

**WebRTC APIs to Mock:**
- `navigator.mediaDevices.getUserMedia()` - Return mock MediaStream
- `RTCPeerConnection` - Mock peer connection with event emitters
- `MediaStream` - Mock with getTracks(), getAudioTracks(), getVideoTracks()
- `MediaStreamTrack` - Mock with enabled property and stop() method

**Signaling to Mock:**
- WebSocket connection - Use mock WebSocket or in-memory event emitter
- Signaling messages - Generate test messages with correct format

**Redux Testing:**
- Use Redux Toolkit's `configureStore` with test reducers
- Test actions and selectors independently
- Test async thunks with mock services

### Integration Testing

**Key Integration Points:**
1. User joins room → Media access → Signaling connection → Peer connections established
2. Remote participant joins → Signaling notification → Peer connection created → Stream received
3. User toggles audio → Track disabled → State updated → UI reflects change
4. Connection lost → Error detected → Reconnection attempted → State updated

### Testing Priorities

**High Priority (Must Test):**
- Redux state management (all properties)
- Media device access and error handling
- Signaling message processing
- Peer connection lifecycle
- Error handling and recovery

**Medium Priority (Should Test):**
- UI component rendering with different states
- Media controls functionality
- Connection state transitions
- Multiple participants scenarios

**Low Priority (Nice to Have):**
- Performance under load
- Network condition simulation
- Browser compatibility
- Accessibility features

### Continuous Testing

- Run unit tests on every commit
- Run property tests in CI/CD pipeline
- Monitor test coverage (aim for >80% for critical paths)
- Regular manual testing with real WebRTC connections
- Cross-browser testing (Chrome, Firefox, Safari, Edge)
