
import PropTypes from 'prop-types';
import React from 'react';
import { OPNAPI } from '../../util/fetcher';
import { connect } from 'react-redux';
import { logIn, setCameFrom, clearOAuthState } from '../../reducer/login';
import { parse } from 'query-string';
import { withRouter } from 'react-router';
import { compose } from '../../util/functional';


class OAuth2CallbackView extends React.Component {
  static propTypes = {
    cameFrom: PropTypes.string,
    dispatch: PropTypes.func.isRequired,
    deviceUUID: PropTypes.string,
    history: PropTypes.object.isRequired,
    oauthState: PropTypes.string,
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
      // Set the token without a profile name, request info about the
      // profile, then set the token again with a profile name.

      // Note: grab refs to the props we need because the sequence below
      // may have a side effect of removing this component from the DOM,
      // possibly making the props no longer available.
      const cameFrom = this.props.cameFrom || '/';
      const dispatch = this.props.dispatch;
      const propsHistory = this.props.history;

      dispatch(clearOAuthState());
      dispatch(logIn(parsed.access_token, ''));
      const action = OPNAPI.fetchPath('/me', {disableRefresh: true});
      dispatch(action).then(profileInfo => {
        dispatch(logIn(parsed.access_token, profileInfo.title));
        dispatch(setCameFrom(''));
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

export default compose(
  withRouter,
  connect(mapStateToProps),
)(OAuth2CallbackView);
