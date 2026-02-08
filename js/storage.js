/* Storage Manager - localStorage wrapper for exam state persistence (mockId-based) */

var StorageManager = {
  KEYS: {
    examState: function(mockId) { return 'examState_' + mockId; },
    examResult: function(mockId) { return 'examResult_' + mockId; }
  },

  saveExamState: function(mockId, state) {
    try {
      localStorage.setItem(this.KEYS.examState(mockId), JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save exam state:', e);
    }
  },

  loadExamState: function(mockId) {
    try {
      var data = localStorage.getItem(this.KEYS.examState(mockId));
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Failed to load exam state:', e);
      return null;
    }
  },

  clearExamState: function(mockId) {
    try {
      localStorage.removeItem(this.KEYS.examState(mockId));
    } catch (e) {
      console.error('Failed to clear exam state:', e);
    }
  },

  saveResult: function(mockId, result) {
    try {
      localStorage.setItem(this.KEYS.examResult(mockId), JSON.stringify(result));
    } catch (e) {
      console.error('Failed to save result:', e);
    }
  },

  loadResult: function(mockId) {
    try {
      var data = localStorage.getItem(this.KEYS.examResult(mockId));
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Failed to load result:', e);
      return null;
    }
  },

  clearResult: function(mockId) {
    try {
      localStorage.removeItem(this.KEYS.examResult(mockId));
    } catch (e) {
      console.error('Failed to clear result:', e);
    }
  },

  loadAllResults: function(mockIds) {
    var results = {};
    (mockIds || []).forEach(function(mockId) {
      var result = StorageManager.loadResult(mockId);
      if (result) results[mockId] = result;
    });
    return results;
  },

  isExamInProgress: function(mockId) {
    var state = this.loadExamState(mockId);
    return state && state.status === 'in_progress';
  },

  clearAll: function(mockIds) {
    (mockIds || []).forEach(function(mockId) {
      StorageManager.clearExamState(mockId);
      localStorage.removeItem(StorageManager.KEYS.examResult(mockId));
    });
  }
};
