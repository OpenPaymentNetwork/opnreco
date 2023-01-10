
/* global process */

import './index.css';
import App from './view/app/App';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { IntlProvider } from 'react-intl';
import { MemoryRouter } from 'react-router';
import { PersistGate } from 'redux-persist/integration/react';
import { Provider } from 'react-redux';
import { store, persistor } from './store';
import reportWebVitals from './reportWebVitals';

function getRouterClass() {
  if (process.env.REACT_APP_MEMORY_ROUTER) {
    return MemoryRouter;
  } else {
    return BrowserRouter;
  }
}

const RouterClass = getRouterClass();
const target = document.getElementById('root');

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  (
    <React.StrictMode>
      <Provider store={store}>
        <IntlProvider locale="en-US">
          <PersistGate loading={null} persistor={persistor}>
            <RouterClass>
              <App />
            </RouterClass>
          </PersistGate>
        </IntlProvider>
      </Provider>
    </React.StrictMode>
  )
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
