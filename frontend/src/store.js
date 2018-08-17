
/* global process: false */

import { createStore, applyMiddleware, compose } from 'redux';
import { persistReducer, persistStore } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import thunk from 'redux-thunk';
import rootReducer from './reducer';


const initialState = {};
const enhancers = [];
const middleware = [
  thunk,
];

if (process.env.NODE_ENV === 'development') {
  const devToolsExtension = window.__REDUX_DEVTOOLS_EXTENSION__;
  if (typeof devToolsExtension === 'function') {
    enhancers.push(devToolsExtension());
  }
}

const composedEnhancers = compose(
  applyMiddleware(...middleware),
  ...enhancers
);

// whitelist is the list of redux keys eligible for persistence.
const whitelist = [
  'login',
  'deviceuuid',
];

const persistConfig = {
  key: 'opnreport',
  storage,
  whitelist,
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = createStore(
  persistedReducer,
  initialState,
  composedEnhancers
);

export const persistor = persistStore(store);
