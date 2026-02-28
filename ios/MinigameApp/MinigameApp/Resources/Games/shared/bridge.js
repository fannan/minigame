// GameBridge - Native bridge for minigame platform
// Games call these methods; native Swift handles them via WKScriptMessageHandler

window.GameBridge = {
  // Connection state
  _connected: false,
  _playerId: null,
  _roomId: null,
  _callbacks: {},

  /**
   * Register a callback for events from native.
   * @param {string} event - Event name (e.g. 'playerJoined', 'moveReceived', 'countdown')
   * @param {function} callback - Handler function receiving event data
   */
  on(event, callback) {
    if (!this._callbacks[event]) {
      this._callbacks[event] = [];
    }
    this._callbacks[event].push(callback);
  },

  /**
   * Remove a callback for an event.
   * @param {string} event - Event name
   * @param {function} callback - The exact function reference to remove
   */
  off(event, callback) {
    if (!this._callbacks[event]) return;
    this._callbacks[event] = this._callbacks[event].filter(cb => cb !== callback);
  },

  /**
   * Emit an event to all registered callbacks.
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  _emit(event, data) {
    const handlers = this._callbacks[event];
    if (!handlers) return;
    for (const handler of handlers) {
      try {
        handler(data);
      } catch (err) {
        console.error(`[GameBridge] Error in ${event} handler:`, err);
      }
    }
  },

  // --- Multiplayer ---

  /**
   * Connect to a game room for multiplayer.
   * @param {string} roomId - The room identifier
   */
  connect(roomId) {
    this._roomId = roomId;
    this._postMessage('connect', { roomId });
  },

  /**
   * Send a move/action to other players.
   * @param {object} data - Arbitrary move data
   */
  sendMove(data) {
    this._postMessage('sendMove', { roomId: this._roomId, data });
  },

  // --- Native Features ---

  /**
   * Trigger haptic feedback on device.
   * @param {'light'|'medium'|'heavy'|'success'|'error'} style
   */
  haptic(style) {
    this._postMessage('haptic', { style });
  },

  /**
   * Play a named sound asset.
   * @param {string} name - Sound identifier
   */
  playSound(name) {
    this._postMessage('playSound', { name });
  },

  // --- Scoring ---

  /**
   * Submit a score during or after the game.
   * @param {number} score - The player's score
   */
  submitScore(score) {
    this._postMessage('submitScore', { score });
  },

  /**
   * Signal that the game is over and submit final results.
   * @param {object} result - { score: number, placement: number, data: object }
   */
  gameOver(result) {
    this._postMessage('gameOver', result);
  },

  // --- Internal ---

  /**
   * Post a message to the native Swift layer via WKWebView.
   * Falls back to console.log when not running in a native container.
   * @param {string} handler - The WKScriptMessageHandler name
   * @param {object} data - Payload to send
   */
  _postMessage(handler, data) {
    try {
      if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers[handler]) {
        window.webkit.messageHandlers[handler].postMessage(data);
      } else {
        console.log(`[GameBridge] ${handler}:`, JSON.stringify(data));
      }
    } catch (err) {
      console.error(`[GameBridge] Failed to post to ${handler}:`, err);
    }
  },

  /**
   * Called by the native layer to deliver messages into the game.
   * @param {string} type - Message type (maps to event name)
   * @param {*} data - Message payload
   */
  _receiveMessage(type, data) {
    // Handle built-in connection events
    if (type === 'connected') {
      this._connected = true;
      this._playerId = data.playerId;
    } else if (type === 'disconnected') {
      this._connected = false;
    }

    this._emit(type, data);
  }
};
