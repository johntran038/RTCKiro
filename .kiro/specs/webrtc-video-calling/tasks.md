# Implementation Plan: WebRTC Video and Voice Calling

## Overview

This implementation plan breaks down the WebRTC video calling feature into incremental coding tasks. Each task builds on previous work, starting with the signaling server, then Redux state management, core WebRTC services, React hooks, and finally the UI components. The plan includes property-based tests and unit tests as sub-tasks to validate functionality early.

## Tasks

- [x] 1. Set up signaling server infrastructure
  - Create `server/` directory in project root
  - Create `server/signaling-server.js` with WebSocket server using `ws` library
  - Implement room management (in-memory Map for rooms and participants)
  - Implement message handlers: join-room, leave-room, offer, answer, ice-candidate
  - Add connection/disconnection handling and cleanup
  - Create `server/package.json` with dependencies (ws, express for optional health checks)
  - Add npm scripts to start signaling server
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 1.1 Write unit tests for signaling server
  - Test room creation and participant tracking
  - Test message relay between participants
  - Test cleanup on disconnect
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 2. Create Redux slice for WebRTC state management
  - [ ] 2.1 Create `src/redux/slices/webrtcSlice.js`
    - Define initial state structure (room, localStream, remoteStreams, signaling, errors)
    - Implement reducers: joinRoom, leaveRoom, setLocalStream, toggleAudio, toggleVideo
    - Implement reducers: addRemoteStream, removeRemoteStream, addParticipant, removeParticipant
    - Implement reducers: updateParticipant, setSignalingConnected, addError
    - Export actions and selectors
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ]* 2.2 Write property test for Redux state structure
    - **Property 31: Redux State Structure**
    - **Validates: Requirements 10.1, 10.2, 10.3**

  - [ ]* 2.3 Write property test for Redux action dispatching
    - **Property 32: Redux Action Dispatching**
    - **Validates: Requirements 10.4**

  - [ ]* 2.4 Write unit tests for Redux slice
    - Test each reducer with specific examples
    - Test selectors return correct data
    - Test initial state
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 3. Integrate WebRTC slice into Redux store
  - Update `src/redux/rootReducer.js` to include webrtcSlice
  - Verify store configuration in `src/redux/store.js`
  - _Requirements: 10.1_

- [ ] 4. Implement SignalingClient service
  - [ ] 4.1 Create `src/services/SignalingClient.js`
    - Implement WebSocket connection management
    - Implement connect() and disconnect() methods
    - Implement message sending methods: joinRoom, leaveRoom, sendOffer, sendAnswer, sendIceCandidate
    - Implement event emitter pattern for received messages
    - Add automatic reconnection logic with exponential backoff
    - Handle connection errors and emit error events
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 9.2_

  - [ ]* 4.2 Write property test for signaling message processing
    - **Property 21: Signaling Message Processing**
    - **Validates: Requirements 6.1, 6.2, 6.3**

  - [ ]* 4.3 Write unit tests for SignalingClient
    - Test connection establishment
    - Test message sending and receiving
    - Test reconnection logic
    - Test error handling
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 9.2_

- [ ] 5. Implement MediaStreamManager service
  - [ ] 5.1 Create `src/services/MediaStreamManager.js`
    - Implement requestMediaAccess() with getUserMedia
    - Define default media constraints (audio: echoCancellation, noiseSuppression; video: 1280x720)
    - Implement stopMediaStream() to stop all tracks
    - Implement toggleAudioTrack() and toggleVideoTrack()
    - Implement getAvailableDevices() for device enumeration
    - Add error handling for permission denied, device not found, device in use
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 5.1, 5.2, 5.3, 5.4, 9.1_

  - [ ]* 5.2 Write property test for media access request
    - **Property 5: Media Access Request**
    - **Validates: Requirements 2.1**

  - [ ]* 5.3 Write property test for successful media capture
    - **Property 6: Successful Media Capture**
    - **Validates: Requirements 2.2**

  - [ ]* 5.4 Write property test for audio track toggle
    - **Property 18: Audio Track Toggle**
    - **Validates: Requirements 5.1, 5.2**

  - [ ]* 5.5 Write property test for video track toggle
    - **Property 19: Video Track Toggle**
    - **Validates: Requirements 5.3, 5.4**

  - [ ]* 5.6 Write unit tests for MediaStreamManager
    - Test permission denial handling
    - Test device error handling
    - Test audio-only mode
    - _Requirements: 2.3, 2.4, 2.5, 9.1_

- [ ] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement PeerConnectionManager service
  - [ ] 7.1 Create `src/services/PeerConnectionManager.js`
    - Implement createPeerConnection() with ICE server configuration (Google STUN servers)
    - Set up RTCPeerConnection event handlers: onicecandidate, ontrack, onconnectionstatechange
    - Implement createOffer() and createAnswer() for SDP exchange
    - Implement setRemoteDescription() and addIceCandidate()
    - Implement closePeerConnection() and closeAllConnections() for cleanup
    - Add local stream tracks to peer connections
    - Handle connection state changes and dispatch Redux actions
    - Implement retry logic for failed connections
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 7.2 Write property test for peer connection creation
    - **Property 10: Peer Connection Creation for All Participants**
    - **Validates: Requirements 3.1**

  - [ ]* 7.3 Write property test for local stream transmission
    - **Property 13: Local Stream Transmission**
    - **Validates: Requirements 3.4**

  - [ ]* 7.4 Write property test for connection state updates
    - **Property 24: Connection State Updates**
    - **Validates: Requirements 7.1, 7.2**

  - [ ]* 7.5 Write unit tests for PeerConnectionManager
    - Test SDP exchange flow
    - Test ICE candidate handling
    - Test connection failure and retry
    - Test cleanup on close
    - _Requirements: 3.2, 3.3, 3.5, 7.3, 7.4, 7.5_

- [ ] 8. Create useWebRTC custom hook
  - [ ] 8.1 Create `src/hooks/useWebRTC.js`
    - Initialize SignalingClient, MediaStreamManager, and PeerConnectionManager
    - Implement joinRoom() function that requests media, connects to signaling, and dispatches actions
    - Implement leaveRoom() function that cleans up connections and stops streams
    - Implement toggleAudio() and toggleVideo() functions
    - Set up signaling event handlers: participant-joined, participant-left, offer, answer, ice-candidate
    - Handle participant-joined: create peer connection, create offer, send via signaling
    - Handle offer: create peer connection, set remote description, create answer, send via signaling
    - Handle answer: set remote description on existing peer connection
    - Handle ice-candidate: add candidate to peer connection
    - Handle participant-left: close peer connection, remove from state
    - Use Redux dispatch to update state throughout
    - Return state and functions for components to use
    - _Requirements: 1.1, 1.3, 1.4, 2.1, 2.2, 3.1, 3.2, 3.3, 4.1, 5.1, 5.2, 6.4, 6.5_

  - [ ]* 8.2 Write property test for room join with valid ID
    - **Property 1: Room Join with Valid ID**
    - **Validates: Requirements 1.1, 1.3**

  - [ ]* 8.3 Write property test for room leave cleanup
    - **Property 3: Room Leave Cleanup**
    - **Validates: Requirements 1.4**

  - [ ]* 8.4 Write property test for participant joined event handling
    - **Property 22: Participant Joined Event Handling**
    - **Validates: Requirements 6.4**

  - [ ]* 8.5 Write property test for participant left event handling
    - **Property 23: Participant Left Event Handling**
    - **Validates: Requirements 6.5**

  - [ ]* 8.6 Write unit tests for useWebRTC hook
    - Test hook initialization
    - Test error scenarios
    - Test state updates
    - _Requirements: 1.1, 1.4, 2.1, 3.1_

- [ ] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Create UI components for video calling
  - [ ] 10.1 Create `src/components/VideoTile.jsx`
    - Accept props: stream, participantName, connectionState, isMuted, isVideoOff
    - Render video element with srcObject set to stream
    - Display participant name overlay
    - Show connection state indicator (connected/disconnected/connecting)
    - Show muted/video-off icons when applicable
    - Add CSS for styling and responsive layout
    - _Requirements: 4.1, 4.3, 7.1, 8.5_

  - [ ] 10.2 Create `src/components/VideoGrid.jsx`
    - Accept props: localStream, remoteStreams, participants
    - Render VideoTile for local stream (self-view)
    - Render VideoTile for each remote stream
    - Implement responsive grid layout (1, 2, 4, 6, 9 grid patterns based on participant count)
    - Add CSS for grid layout and spacing
    - _Requirements: 4.1, 4.3, 4.4, 8.2_

  - [ ] 10.3 Create `src/components/MediaControls.jsx`
    - Accept props: audioEnabled, videoEnabled, onToggleAudio, onToggleVideo, onLeaveRoom
    - Render mute/unmute button with icon (use react-icons)
    - Render video on/off button with icon
    - Render leave room button
    - Show visual state (button color/icon changes based on enabled state)
    - Add CSS for button styling and layout
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 8.3_

  - [ ] 10.4 Create `src/components/RoomJoin.jsx`
    - Create form with room ID input field
    - Add join button
    - Implement input validation (non-empty, no whitespace-only)
    - Display error message if validation fails
    - Call onJoinRoom callback with room ID on submit
    - Add CSS for form styling
    - _Requirements: 1.1, 1.2, 8.1_

  - [ ]* 10.5 Write property test for invalid room ID rejection
    - **Property 2: Invalid Room ID Rejection**
    - **Validates: Requirements 1.2**

- [ ] 11. Create RoomPage component
  - [ ] 11.1 Create `src/pages/RoomPage.jsx`
    - Use useWebRTC hook to get state and functions
    - Use useSelector to get Redux state
    - Show RoomJoin component when not joined
    - Show VideoGrid and MediaControls when joined
    - Display error messages from errors array
    - Handle loading states (requesting media, connecting)
    - Add CSS for page layout
    - _Requirements: 1.1, 1.3, 1.4, 4.1, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 8.1, 8.2, 8.3, 9.1, 9.2, 9.3, 9.4_

  - [ ]* 11.2 Write property test for error state management
    - **Property 29: Error State Management**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4**

  - [ ]* 11.3 Write unit tests for RoomPage
    - Test rendering in different states (not joined, joined, error)
    - Test user interactions (join, leave, toggle controls)
    - _Requirements: 1.1, 1.3, 1.4, 8.1_

- [ ] 12. Add routing for RoomPage
  - Update `src/App.jsx` to add route for RoomPage (e.g., `/room` or `/room/:roomId`)
  - Use lazy loading pattern for RoomPage
  - Add navigation link or update home page to link to room
  - _Requirements: 1.1_

- [ ] 13. Create error handling utilities
  - [ ] 13.1 Create `src/utils/errorHandlers.js`
    - Implement getErrorMessage() to convert error codes to user-friendly messages
    - Implement error categorization (media, signaling, peer-connection, network)
    - Add troubleshooting suggestions for common errors
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]* 13.2 Write property test for graceful error handling
    - **Property 30: Graceful Error Handling**
    - **Validates: Requirements 9.5**

- [ ] 14. Add CSS styling for WebRTC components
  - Create `src/components/VideoTile.css` with tile styling
  - Create `src/components/VideoGrid.css` with responsive grid layouts
  - Create `src/components/MediaControls.css` with button styling
  - Create `src/components/RoomJoin.css` with form styling
  - Create `src/pages/RoomPage.css` with page layout
  - Ensure responsive design for mobile and desktop
  - Add dark mode support (optional)
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [ ] 15. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 16. Install required dependencies
  - Run `npm install ws` for signaling server
  - Run `npm install --save-dev fast-check` for property-based testing
  - Run `npm install --save-dev @testing-library/react @testing-library/jest-dom` if not already installed
  - Update package.json with signaling server start script
  - _Requirements: All_

- [ ] 17. Create development documentation
  - Create `docs/WEBRTC_SETUP.md` with setup instructions
  - Document how to start signaling server
  - Document how to test locally (multiple browser tabs)
  - Document WebRTC architecture and data flow
  - Add troubleshooting section for common issues
  - _Requirements: All_

- [ ] 18. Final integration and testing
  - [ ] 18.1 Test complete flow: join room → grant permissions → see local video → second user joins → see remote video
    - Test in multiple browser tabs
    - Test audio and video controls
    - Test leaving and rejoining
    - Test error scenarios (deny permissions, disconnect signaling)
    - _Requirements: All_

  - [ ]* 18.2 Write integration tests for complete user flows
    - Test room join flow end-to-end
    - Test multi-participant scenarios
    - Test error recovery flows
    - _Requirements: All_

- [ ] 19. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The signaling server can run locally during development (localhost:8080)
- For production deployment, the signaling server needs to be deployed separately (Heroku, AWS, etc.)
- WebRTC requires HTTPS in production (except localhost)
- STUN servers are free but may not work in all network configurations; TURN servers may be needed for production
- Property-based tests use fast-check library with minimum 100 iterations
- Each property test references its corresponding design document property
- Testing strategy balances unit tests (specific examples) with property tests (universal properties)
