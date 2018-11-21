
/* global process: false */

import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { startOAuth } from '../../reducer/login';


class LoginView extends React.Component {

  static propTypes = {
    deviceUUID: PropTypes.string,
    forceLogin: PropTypes.bool,
    oauthState: PropTypes.string,
    dispatch: PropTypes.func.isRequired,
  };

  componentDidMount() {
    this.startOAuth();
  }

  componentDidUpdate() {
    if (!this.props.oauthState) {
      // componentDidMount() should normally call startOAuth(),
      // sometimes after logout it doesn't work. Just fix it. :-)
      startOAuth();
    }
  }

  startOAuth() {
    this.props.dispatch(startOAuth());
  }

  render() {
    const {deviceUUID, oauthState, forceLogin} = this.props;

    if (!deviceUUID || !oauthState) {
      // The random strings haven't been generated yet.
      return <div style={{opacity: '0.1'}}>Preparing to log in&hellip;</div>;
    }

    const url = (
      process.env.REACT_APP_OPN_PUBLIC_URL +
      '/authorize?client_id=' +
      encodeURIComponent(process.env.REACT_APP_OPN_CLIENT_ID) +
      '&response_type=token' +
      '&redirect_uri=' +
      encodeURIComponent(process.env.REACT_APP_URL + '/oauth2cb') +
      '&scope=' +
      encodeURIComponent(
        'mobile_device select_profile view_wallet ' +
        'view_history view_full_history') +
      '&name=OPNReport' +
      '&uuid=' + encodeURIComponent(deviceUUID) +
      '&state=' + encodeURIComponent(oauthState) +
      (forceLogin ? '&force_login=true' : ''));

    return (
      <p>
        <a href={url}>Sign In</a>
      </p>
    );
  }
}

function mapStateToProps(state) {
  return {
    deviceUUID: state.deviceuuid,
    oauthState: state.login.oauthState,
    forceLogin: state.login.forceLogin,
  };
}

export default connect(mapStateToProps)(LoginView);
