
/* global process */

import './index.css';
import App from './view/app/App';
import React from 'react';
import ReactDOM from 'react-dom';
import registerServiceWorker from './registerServiceWorker';
import { BrowserRouter } from 'react-router-dom';
import { IntlProvider } from 'react-intl';
import { MemoryRouter } from 'react-router';
import { PersistGate } from 'redux-persist/integration/react';
import { Provider } from 'react-redux';
import { store, persistor } from './store';

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
      <IntlProvider locale="en-US">
        <PersistGate loading={null} persistor={persistor}>
          <RouterClass>
            <App />
          </RouterClass>
        </PersistGate>
      </IntlProvider>
    </Provider>
  ), target
);

registerServiceWorker();
