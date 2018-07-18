

// Create a Redux reducer from an initial state and an action handler object.
export function createReducer(initialState, actionHandlers) {
  return (state = initialState, action) => {
    const reduceFn = actionHandlers[action.type];
    if (!reduceFn) {
      return state;
    }
    return { ...state, ...reduceFn(state, action) };
  };
}

// Generate a random UUID.
export function makeRandomUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : ((r & 0x3) | 0x8);
    return v.toString(16);
  });
}

