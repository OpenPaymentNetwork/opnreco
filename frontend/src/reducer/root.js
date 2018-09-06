
import app from './app';
import deviceuuid from './deviceuuid';
import login from './login';
import fetchcache from './fetchcache';
import { combineReducers } from 'redux';

export default combineReducers({
  app,
  deviceuuid,
  login,
  fetchcache,
});
