
import './index.css';
import App from './view/app/App';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { IntlProvider } from 'react-intl';
// import { MemoryRouter } from 'react-router';
import { PersistGate } from 'redux-persist/integration/react';
import { Provider } from 'react-redux';
import { store, persistor } from './store';

function getRouterClass() {
  // if (process.env.REACT_APP_MEMORY_ROUTER) {
  //   return MemoryRouter;
  // } else {
  return BrowserRouter;
  // }
}

const RouterClass = getRouterClass();
const container = document.getElementById('root');
const root = createRoot(container);

root.render(
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
  )
);

// We don't really want the extra caching done by a service worker for now.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then(registration => {
    registration.unregister();
  });
}
