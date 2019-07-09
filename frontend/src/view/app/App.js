
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { createMuiTheme, MuiThemeProvider } from '@material-ui/core/styles';
import { Switch, Route } from 'react-router';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import AuthenticatedHome from '../home/AuthenticatedHome';
import CssBaseline from '@material-ui/core/CssBaseline';
import FileListTabs from '../file/FileListTabs';
import FileTabs from '../file/FileTabs';
import Linger from '../../util/Linger';
import LoginRedirect from '../login/LoginRedirect';
import LoginView from '../login/LoginView';
import LogoutDialog from './LogoutDialog';
import NotFound from './NotFound';
import OAuth2CallbackView from '../login/OAuth2CallbackView';
import OPNDrawer from './OPNDrawer';
import PeriodTabs from '../period/PeriodTabs';
import PropTypes from 'prop-types';
import React from 'react';
import Redirecting from './Redirecting';
import ServerErrorDialog from './ServerErrorDialog';
import Settings from '../settings/Settings';
import TokenRefreshDialog from './TokenRefreshDialog';
import Verify from './Verify';

//import PeriodList from '../period/PeriodList';

/* Theme based on https://material.io/tools/color/#!/
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
  typography: {
    useNextVariants: true,
  },
});


const styles = theme => ({
  root: {
    position: 'relative',
    width: '100%',
    minWidth: '768px',
  },
  belowAppBar: {
    flexGrow: 1,
    backgroundColor: theme.palette.background.default,
  },
});


class App extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    loggingOut: PropTypes.bool.isRequired,
    serverErrorOpen: PropTypes.bool,
    personalTitle: PropTypes.string,
    tokenRefresh: PropTypes.bool.isRequired,
  };

  render() {
    if (!this.props.personalTitle) {
      return (
        <MuiThemeProvider theme={customTheme}>
          <CssBaseline />
          <Switch>
            <Route path="/login" component={LoginView} />
            <Route path="/oauth2cb" component={OAuth2CallbackView} />
            <Route component={LoginRedirect} />
          </Switch>
        </MuiThemeProvider>
      );
    }

    const {
      classes,
      tokenRefresh,
      loggingOut,
      serverErrorOpen,
    } = this.props;

    return (
      <MuiThemeProvider theme={customTheme}>
        <CssBaseline />
        <div className={classes.root}>
          <div className={classes.belowAppBar}>
            <OPNDrawer />
            <main className={classes.main}>
              <Switch>
                <Route path="/login" component={LoginView} />
                <Route path="/oauth2cb" component={Redirecting} />
                <Route path="/settings" component={Settings} />
                <Route path="/verify" component={Verify} />
                <Route path="/period/:periodId([0-9]+)/:tab(t)/:transferId" component={PeriodTabs} />
                <Route path="/period/:periodId([0-9]+)/:tab(statement)/:statementId" component={PeriodTabs} />
                <Route path="/period/:periodId([0-9]+)/:tab(|reco|transactions|t|overview|statement|internal)"
                  component={PeriodTabs} />
                <Route path="/period/:periodId([0-9]+)" component={PeriodTabs} />
                <Route path="/file/:fileId([0-9]+)/:tab(|edit|designs|periods)" component={FileTabs} />
                <Route path="/file/:fileId([0-9]+)" component={FileTabs} />
                <Route path="/file/:tab(|list|add|archived)" component={FileListTabs} />
                <Route path="/file" component={FileListTabs} />
                <Route path="/" component={AuthenticatedHome} exact />
                <Route component={NotFound} />
              </Switch>
            </main>
          </div>
          <Linger enabled={tokenRefresh}>
            <TokenRefreshDialog />
          </Linger>
          <Linger enabled={loggingOut}>
            <LogoutDialog />
          </Linger>
          <Linger enabled={serverErrorOpen}>
            <ServerErrorDialog />
          </Linger>
        </div>
      </MuiThemeProvider>
    );
  }
}


const mapStateToProps = (state) => {
  const {
    loggingOut,
    serverError,
    serverErrorOpen,
    tokenRefresh,
  } = state.app;
  const {personalProfile} = state.login;
  return {
    loggingOut: !!loggingOut,
    personalTitle: personalProfile ? personalProfile.title : null,
    serverError: serverError,
    serverErrorOpen: !!serverErrorOpen,
    tokenRefresh: !!tokenRefresh,
  };
};


// withRouter() seems to be required for any component containing Routes. See:
// https://github.com/ReactTraining/react-router/issues/4671
export default compose(
  withStyles(styles, { withTheme: true }),
  withRouter,
  connect(mapStateToProps),
)(App);
