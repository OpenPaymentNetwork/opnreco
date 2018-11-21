
import React from 'react';
import PropTypes from 'prop-types';
import { setCameFrom } from '../../reducer/login';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';


class LoginRedirect extends React.Component {
  static propTypes = {
    history: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
  };

  componentDidMount() {
    const { history } = this.props;
    if (history.location && history.location.pathname) {
      this.props.dispatch(setCameFrom(history.location.pathname));
    } else {
      this.props.dispatch(setCameFrom(''));
    }
    history.push('/login');
  }

  render() {
    return <p style={{opacity: 0.1}}>Redirecting&hellip;</p>;
  }
}

export default compose(
  withRouter,
  connect(),
)(LoginRedirect);
