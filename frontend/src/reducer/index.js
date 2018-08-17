
import app from './app';
import deviceuuid from './deviceuuid';
import login from './login';
import { combineReducers } from 'redux';

export default combineReducers({
  app,
  deviceuuid,
  login,
});
