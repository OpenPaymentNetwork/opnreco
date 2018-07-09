
import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './view/app';
import registerServiceWorker from './registerServiceWorker';
import { store, persistor } from './store';
import { Provider } from 'react-redux';
import { HashRouter } from 'react-router-dom';
import { PersistGate } from 'redux-persist/integration/react';


const target = document.getElementById('root');

ReactDOM.render(
  (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <HashRouter>
          <App />
        </HashRouter>
      </PersistGate>
    </Provider>
  ), target
);

registerServiceWorker();
