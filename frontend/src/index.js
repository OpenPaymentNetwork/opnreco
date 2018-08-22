
/* global process */

import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './view/app/App';
import registerServiceWorker from './registerServiceWorker';
import { store, persistor } from './store';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { MemoryRouter } from 'react-router';
import { PersistGate } from 'redux-persist/integration/react';

function getRouterClass() {
  if (process.env.REACT_APP_MEMORY_ROUTER) {
    return MemoryRouter;
  } else {
    return BrowserRouter;
  }
}

const RouterClass = getRouterClass();
const target = document.getElementById('root');

ReactDOM.render(
  (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <RouterClass>
          <App />
        </RouterClass>
      </PersistGate>
    </Provider>
  ), target
);

registerServiceWorker();
