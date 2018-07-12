

// Create a Redux reducer from an initial state and an action handler object.
export default function createReducer(initialState, actionHandlers) {
  return (state = initialState, action) => {
    const reduceFn = actionHandlers[action.type];
    if (!reduceFn) {
      return state;
    }
    return { ...state, ...reduceFn(state, action) };
  };
}
