/* global test: false */

import App from './App';
import React from 'react';
import ReactDOM from 'react-dom';
import rootReducer from '../../reducer/root';
import { createStore } from 'redux';
import { MemoryRouter } from 'react-router';
import { Provider } from 'react-redux';
import { IntlProvider } from 'react-intl';

test('renders without crashing', () => {
  const div = document.createElement('div');
  const store = createStore(rootReducer);
  ReactDOM.render(
    <Provider store={store}>
      <IntlProvider locale="en-US">
        <MemoryRouter>
          <App />
        </MemoryRouter>
      </IntlProvider>
    </Provider>, div);
  ReactDOM.unmountComponentAtNode(div);
});
