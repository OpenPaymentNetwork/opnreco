import { FormattedRelative } from 'react-intl';
import { binder } from '../../util/binder';
import { clearMost } from '../../reducer/clearmost';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPNReport } from '../../util/fetcher';
import { openDrawer, closeDrawer, setSyncProgress, setLoggingOut } from '../../reducer/app';
import { withStyles } from '@material-ui/core/styles';
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
import SwipeableDrawer from '@material-ui/core/SwipeableDrawer';
import Sync from '@material-ui/icons/Sync';
import Toolbar from '@material-ui/core/Toolbar';


/* global process: false */


const drawerWidth = 240;

const styles = {
  drawerPaper: {
    width: drawerWidth,
  },
};


const iOS = process.browser && /iPad|iPhone|iPod/.test(navigator.userAgent);


class OPNDrawer extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    drawerOpen: PropTypes.bool,
    syncedAt: PropTypes.any,
    syncProgress: PropTypes.any,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
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
      window.setTimeout(() => this.handleSync(), 0);
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

  handleSync() {
    const {
      dispatch,
      syncProgress,
    } = this.props;

    if (syncProgress !== null) {
      // Already syncing.
      return;
    }

    const syncBatch = () => {
      const action = fOPNReport.fetchPath('/sync', {method: 'post'});
      dispatch(action).then(status => {
        if (status.more) {
          dispatch(setSyncProgress(status.progress_percent));
          syncBatch();
        } else {
          // Done.
          dispatch(setSyncProgress(null, new Date()));
          dispatch(clearMost());
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

  handleSignOut() {
    this.props.dispatch(setLoggingOut(true));
    this.props.dispatch(closeDrawer());
  }

  handleOpenDrawer() {
    this.props.dispatch(openDrawer());
  }

  handleCloseDrawer() {
    this.props.dispatch(closeDrawer());
  }

  renderContent() {
    const syncUI = this.getSyncUI();
    return (<div>
      <Toolbar>
        <ProfileSelector />
      </Toolbar>
      <Divider style={{marginTop: -1}} />
      <List component="nav">
        <ListItem
          button
          onClick={this.binder(this.handleSync)}
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
          onClick={this.binder(this.handleSignOut)}
        >
          <ListItemIcon>
            <ExitToApp />
          </ListItemIcon>
          <ListItemText primary="Sign Out" />
        </ListItem>

      </List>
    </div>);
  }

  render() {
    const { classes, drawerOpen } = this.props;
    const drawerContent = this.renderContent();
    return (
      <div>
        <SwipeableDrawer
          open={drawerOpen}
          onOpen={this.binder(this.handleOpenDrawer)}
          onClose={this.binder(this.handleCloseDrawer)}
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
  withStyles(styles),
  connect(mapStateToProps),
)(OPNDrawer);
