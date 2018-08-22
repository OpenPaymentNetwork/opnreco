
import About from '../about';
import Home from '../home';
import Linger from '../../util/Linger';
import LoginRedirect from '../login/loginredirect';
import LoginView from '../login';
import LogoutDialog from './LogoutDialog';
import OAuth2CallbackView from '../login/oauth2cb';
import OPNAppBar from './OPNAppBar';
import OPNDrawer from './OPNDrawer';
import PropTypes from 'prop-types';
import React from 'react';
import ServerErrorDialog from './ServerErrorDialog';
import TokenRefreshDialog from './TokenRefreshDialog';
import { connect } from 'react-redux';
import { Switch, Route } from 'react-router';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';


const styles = theme => ({
  root: {
    position: 'relative',
    width: '100%',
  },
  belowAppBar: {
    flexGrow: 1,
    backgroundColor: theme.palette.background.default,
  },
  main: {
    padding: theme.spacing.unit * 2,
  },
});


class App extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    loggingOut: PropTypes.bool.isRequired,
    serverError: PropTypes.string,
    token: PropTypes.string,
    personalName: PropTypes.string,
    tokenRefresh: PropTypes.bool.isRequired,
  };

  render() {
    if (!this.props.token || !this.props.personalName) {
      return (
        <Switch>
          <Route path="/login" component={LoginView} />
          <Route path="/oauth2cb" component={OAuth2CallbackView} />
          <Route component={LoginRedirect} />
        </Switch>
      );
    }

    const { classes, tokenRefresh, loggingOut, serverError } = this.props;

    return (
      <div className={classes.root}>
        <OPNAppBar />
        <div className={classes.belowAppBar}>
          <OPNDrawer />
          <main className={classes.main}>
            <Route exact path="/" component={Home} />
            <Route exact path="/about-us" component={About} />
          </main>
        </div>
        <Linger enabled={!!tokenRefresh}>
          <TokenRefreshDialog />
        </Linger>
        <Linger enabled={!!loggingOut}>
          <LogoutDialog />
        </Linger>
        <Linger enabled={!!serverError}>
          <ServerErrorDialog />
        </Linger>
      </div>
    );
  }
}


const mapStateToProps = (state) => ({
  loggingOut: state.app.loggingOut,
  personalName: state.login.personalName,
  serverError: state.app.serverError,
  token: state.login.token,
  tokenRefresh: state.app.tokenRefresh,
});


// withRouter() seems to be required for any component containing Routes. See:
// https://github.com/ReactTraining/react-router/issues/4671
export default withStyles(styles, { withTheme: true })(
  withRouter(connect(mapStateToProps)(App)));
