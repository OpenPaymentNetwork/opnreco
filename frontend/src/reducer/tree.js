
import { createReducer } from './common';

const TOGGLE_NODE = 'tree/TOGGLE_NODE';

const initialState = {};

export const toggleNode = (treeName, nodeName) => ({
  type: TOGGLE_NODE, payload: {treeName, nodeName}});

const actionHandlers = {

  [TOGGLE_NODE]: (state, {payload: {treeName, nodeName}}) => {
    const tree = new Map(state[treeName]);
    if (tree.get(nodeName)) {
      tree.delete(nodeName);
    } else {
      tree.set(nodeName, true);
    }
    return {...state, [treeName]: tree};
  },

};

export default createReducer(initialState, actionHandlers);


/* global process */
if (process.env.NODE_ENV !== 'production' && !Map.prototype.toJSON) {
  // Make the tree nodes visible to redux-devtools.
  /* eslint {"no-extend-native": 0} */
  Map.prototype.toJSON = function() {
    var obj = {};
    this.forEach((value, key) => obj[key] = value);
    return obj;
  };
}
