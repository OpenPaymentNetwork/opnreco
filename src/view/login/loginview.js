
/* global process: false */

import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { setStateToken } from '../../reducer/oauth';


class LoginView extends React.Component {

  componentDidMount() {
    this.props.setStateToken();
  }

  render() {
    if (!this.props.deviceUUID || !this.props.stateToken) {
      return <div>Setting up login...</div>;
    }

    const url = (
      process.env.REACT_APP_OPN_PUBLIC_URL +
      '/authorize?client_id=' +
      encodeURIComponent(process.env.REACT_APP_OPN_CLIENT_ID) +
      '&response_type=token' +
      '&redirect_uri=' +
      process.env.REACT_APP_URL + '/oauth2cb' +
      '&scope=' +
      encodeURIComponent(
        'mobile_device select_profile view_wallet ' +
        'view_history view_full_history') +
      '&name=OPNReport' +
      '&uuid=' +
      encodeURIComponent(this.props.deviceUUID) +
      '&state=' +
      encodeURIComponent(this.props.stateToken));

    return (
      <p>
        <a href={url}>Log in</a>
      </p>
    );
  }
}

LoginView.propTypes = {
  setStateToken: PropTypes.func.isRequired,
  deviceUUID: PropTypes.string,
  stateToken: PropTypes.string,
};

function mapStateToProps(state) {
  return {
    deviceUUID: state.deviceuuid,
    stateToken: state.oauth.stateToken,
  };
}

const dispatchToProps = {
  setStateToken,
};

export default connect(mapStateToProps, dispatchToProps)(LoginView);
