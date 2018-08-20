import App from '../app';
import React from 'react';
import ReactDOM from 'react-dom';
import rootReducer from '../../reducer';
import { createStore } from 'redux';
import { MemoryRouter } from 'react-router';
import { Provider } from 'react-redux';

it('renders without crashing', () => {
  const div = document.createElement('div');
  const store = createStore(rootReducer);
  ReactDOM.render(
    <Provider store={store}>
      <MemoryRouter>
        <App />
      </MemoryRouter>
    </Provider>, div);
  ReactDOM.unmountComponentAtNode(div);
});
