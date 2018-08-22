
import PropTypes from 'prop-types';
import React from 'react';
import { callOPNAPI } from '../../util/callapi';
import { connect } from 'react-redux';
import { logIn, setCameFrom, clearOAuthState } from '../../reducer/login';
import { parse } from 'query-string';
import { withRouter } from 'react-router';


class OAuth2CallbackView extends React.Component {
  static propTypes = {
    callOPNAPI: PropTypes.func.isRequired,
    cameFrom: PropTypes.string,
    clearOAuthState: PropTypes.func.isRequired,
    deviceUUID: PropTypes.string,
    history: PropTypes.object.isRequired,
    logIn: PropTypes.func.isRequired,
    oauthState: PropTypes.string,
    setCameFrom: PropTypes.func.isRequired,
    token: PropTypes.string,
  };

  constructor(props) {
    super(props);
    this.state = {error: null};
  }

  componentDidMount() {
    if (this.props.token) {
      // Another instance of this view already set the token
      // and will finish asynchronously.
      return;
    }
    const parsed = parse(window.location.hash);
    if (parsed.access_token && parsed.state === this.props.oauthState) {
      // Set the token without a profile name, then request info about the
      // profile.

      // Note: grab refs to the props we need because the sequence below
      // may have a side effect of removing this component from the DOM,
      // possibly making the props no longer available.
      const cameFrom = this.props.cameFrom || '/';
      const propsSetCameFrom = this.props.setCameFrom;
      const propsHistory = this.props.history;
      const propsClearOAuthState = this.props.clearOAuthState;
      const propsLogIn = this.props.logIn;
      const propsCallOPNAPI = this.props.callOPNAPI;

      propsClearOAuthState();
      propsLogIn(parsed.access_token, '');
      propsCallOPNAPI('/me', {disableRefresh: true}).then(profileInfo => {
        propsLogIn(parsed.access_token, profileInfo.title);
        propsSetCameFrom('');
        window.setTimeout(() => propsHistory.push(cameFrom), 0);
      }).catch((error) => {
        this.setState({error: String(error)});
      });
    } else {
      this.setState({
        error: 'The server provided invalid authentication state.',
      });
    }
  }

  render() {
    const {error} = this.state;
    if (!error) {
      return (<p style={{opacity: '0.1'}}>Signing in&hellip;</p>);
    } else {
      return (
        <p>
          An error occurred while signing in:
          <strong>{error}</strong>
        </p>
      );
    }
  }
}

function mapStateToProps(state) {
  return {
    oauthState: state.login.oauthState,
    cameFrom: state.login.cameFrom,
    token: state.login.token,
  };
}

const dispatchToProps = {
  logIn,
  setCameFrom,
  clearOAuthState,
  callOPNAPI,
};

export default withRouter(
  connect(mapStateToProps, dispatchToProps)(OAuth2CallbackView));
