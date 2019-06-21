import { FormattedRelative } from 'react-intl';
import { clearWithFiles } from '../../reducer/clearmost';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPNReco } from '../../util/fetcher';
import { openDrawer, closeDrawer, setSyncProgress, setLoggingOut } from '../../reducer/app';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import CompareArrows from '@material-ui/icons/CompareArrows';
import CircularProgress from '@material-ui/core/CircularProgress';
import Divider from '@material-ui/core/Divider';
import ExitToApp from '@material-ui/icons/ExitToApp';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import ProfileSelector from './ProfileSelector';
import PropTypes from 'prop-types';
import React from 'react';
import Settings from '@material-ui/icons/Settings';
import SwipeableDrawer from '@material-ui/core/SwipeableDrawer';
import Sync from '@material-ui/icons/Sync';
import TableChart from '@material-ui/icons/TableChart';


/* global process: false */


const drawerWidth = 300;

const styles = theme => ({
  drawerPaper: {
    width: drawerWidth,
  },
  top: {
    backgroundColor: theme.palette.primary.main,
    color: '#fff',
    height: '100px',
  },
  appTitle: {
    fontWeight: 'bold',
    padding: '16px',
    textAlign: 'center',
  },
  versionLine: {
    display: 'block',
    color: '#000',
    opacity: '0.7',
    fontSize: '80%',
    padding: '16px',
    textAlign: 'right',
  },
});


const iOS = process.browser && /iPad|iPhone|iPod/.test(navigator.userAgent);


class OPNDrawer extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    drawerOpen: PropTypes.bool,
    history: PropTypes.object.isRequired,
    syncedAt: PropTypes.any,
    syncProgress: PropTypes.any,
  };

  constructor(props) {
    super(props);
    this.startingSync = false;
    this.state = {autoSyncOk: true};
  }

  componentDidMount() {
    this.autoSync();
  }

  componentDidUpdate() {
    this.autoSync();
  }

  autoSync() {
    if (this.state.autoSyncOk &&
        !this.startingSync &&
        !this.props.syncedAt &&
        !this.props.syncProgress) {
      // Start an automatic sync.
      this.startingSync = true;
      window.setTimeout(this.handleSync, 0);
    }
  }

  getSyncUI() {
    const { syncProgress, syncedAt } = this.props;
    if (syncProgress === null) {
      if (!syncedAt) {
        return {
          icon: <Sync />,
          primary: 'Sync with OPN',
          secondary: 'Not yet synced',
        };
      } else {
        return {
          icon: <Sync />,
          primary: 'Synced with OPN',
          secondary: <FormattedRelative value={syncedAt} />,
        };
      }
    }

    if (syncProgress < 0) {
      return {
        icon: <CircularProgress size={24} />,
        primary: 'Syncing',
        secondary: <span>Connecting&hellip;</span>,
        disabled: true,
      };
    }

    // We could use a determinate spinner here, but the moving
    // indeterminate spinner looks better.
    return {
      icon: (
        <CircularProgress
          size={24}
          variant="indeterminate"
          value={Math.min(syncProgress, 100)}
        />),
      primary: 'Syncing',
      secondary: <span>{syncProgress}%</span>,
      disabled: true,
    };
  }

  handleSync = () => {
    const {
      dispatch,
      syncProgress,
    } = this.props;

    if (syncProgress !== null) {
      // Already syncing.
      return;
    }

    let tzname;
    try {
      tzname = String(Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch(e) {
      // Intl isn't supported in every browser and getting the right
      // tzname is probably only important for high volume users.
      // There's a settings page that lets people choose the tzname.
      tzname = '';
    }

    let changeCount = 0;

    const syncBatch = () => {
      const action = fOPNReco.fetchPath('/sync', {data: {
        tzname,
      }});
      dispatch(action).then(status => {
        changeCount += (status.change_count || 0);
        if (status.more) {
          dispatch(setSyncProgress(status.progress_percent));
          syncBatch();
        } else {
          // Done.
          dispatch(setSyncProgress(null, new Date()));
          if (changeCount) {
            dispatch(clearWithFiles());
          }
          this.setState({autoSyncOk: true});
        }
      }).catch(() => {
        // An error occurred and has been shown to the user.
        this.setState({autoSyncOk: false});
        dispatch(setSyncProgress(null));
      });
    };

    dispatch(setSyncProgress(-1));
    this.startingSync = false;
    syncBatch();
  }

  handleSignOut = () => {
    this.props.dispatch(setLoggingOut(true));
    this.props.dispatch(closeDrawer());
  }

  handleOpenDrawer = () => {
    this.props.dispatch(openDrawer());
  }

  handleCloseDrawer = () => {
    this.props.dispatch(closeDrawer());
  }

  handleReports = () => {
    this.props.dispatch(closeDrawer());
    this.props.history.push('/');
  }

  handleSettings = () => {
    this.props.dispatch(closeDrawer());
    this.props.history.push('/settings');
  }

  handleVerify = () => {
    this.props.dispatch(closeDrawer());
    this.props.history.push('/verify');
  }

  renderContent() {
    const {classes} = this.props;
    const syncUI = this.getSyncUI();
    return (<div>
      <div className={classes.top}>
        <div className={classes.appTitle}>
          OPN Reconciliation
        </div>
        <div className={classes.profileSelector}>
          <ProfileSelector />
        </div>
      </div>
      <Divider style={{marginTop: -1}} />
      <List component="nav">

        <ListItem
          button
          onClick={this.handleReports}
        >
          <ListItemIcon><TableChart/></ListItemIcon>
          <ListItemText primary="Reports" />
        </ListItem>

        <ListItem
          button
          onClick={this.handleSettings}
        >
          <ListItemIcon><Settings/></ListItemIcon>
          <ListItemText primary="Settings" />
        </ListItem>

        <ListItem
          button
          onClick={this.handleSync}
          disabled={syncUI.disabled}
        >
          <ListItemIcon>
            {syncUI.icon}
          </ListItemIcon>
          <ListItemText
            primary={syncUI.primary}
            secondary={syncUI.secondary} />
        </ListItem>

        <ListItem
          button
          onClick={this.handleVerify}
        >
          <ListItemIcon><CompareArrows/></ListItemIcon>
          <ListItemText primary="Verify" />
        </ListItem>

        <ListItem
          button
          onClick={this.handleSignOut}
        >
          <ListItemIcon>
            <ExitToApp />
          </ListItemIcon>
          <ListItemText primary="Sign Out" />
        </ListItem>

      </List>

      <a href="https://github.com/wingcash/opnreco"
          target="_blank" rel="noopener noreferrer"
          className={classes.versionLine}>
        Version {process.env.REACT_APP_VERSION}
      </a>

    </div>);
  }

  render() {
    const { classes, drawerOpen } = this.props;
    const drawerContent = this.renderContent();
    return (
      <div>
        <SwipeableDrawer
          open={drawerOpen}
          onOpen={this.handleOpenDrawer}
          onClose={this.handleCloseDrawer}
          classes={{
            paper: classes.drawerPaper,
          }}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          // Optimizations recommended by the Material-UI docs:
          disableBackdropTransition={!iOS}
          disableDiscovery={iOS}
        >
          {drawerContent}
        </SwipeableDrawer>
      </div>
    );
  }
}


function mapStateToProps(state) {
  return {
    drawerOpen: state.app.drawerOpen,
    syncProgress: state.app.syncProgress,
    syncedAt: state.app.syncedAt,
  };
}

export default compose(
  withStyles(styles, {withTheme: true}),
  withRouter,
  connect(mapStateToProps),
)(OPNDrawer);
