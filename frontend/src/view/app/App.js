
import About from '../about';
import Home from '../home/Home';
import Linger from '../../util/Linger';
import LoginRedirect from '../login/LoginRedirect';
import LoginView from '../login/LoginView';
import LogoutDialog from './LogoutDialog';
import OAuth2CallbackView from '../login/OAuth2CallbackView';
import OPNAppBar from './OPNAppBar';
import OPNDrawer from './OPNDrawer';
import PropTypes from 'prop-types';
import React from 'react';
import ServerErrorDialog from './ServerErrorDialog';
import TokenRefreshDialog from './TokenRefreshDialog';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { createMuiTheme, MuiThemeProvider } from '@material-ui/core/styles';
import { Switch, Route } from 'react-router';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';


/* From https://material.io/tools/color/#!/
   ?view.left=0&view.right=0&primary.color=1B5E20&secondary.color=FDD835
*/
const customTheme = createMuiTheme({
  palette: {
    primary: {
      light: '#4c8c4a',
      main: '#1b5e20',
      dark: '#003300',
      contrastText: '#fff',
    },
    secondary: {
      light: '#ffff6b',
      main: '#fdd835',
      dark: '#c6a700',
      contrastText: '#000',
    },
  },
});


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
      <MuiThemeProvider theme={customTheme}>
        <div className={classes.root}>
          <OPNAppBar />
          <div className={classes.belowAppBar}>
            <OPNDrawer />
            <main className={classes.main}>
              <Switch>
                <Route path="/about-us" component={About} />
                <Route path="/:tab(|reco|transactions|liabilities)" component={Home} />
              </Switch>
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
      </MuiThemeProvider>
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
export default compose(
  withStyles(styles, { withTheme: true }),
  withRouter,
  connect(mapStateToProps),
)(App);