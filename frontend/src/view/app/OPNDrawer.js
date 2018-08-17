
import CircularProgress from '@material-ui/core/CircularProgress';
import Divider from '@material-ui/core/Divider';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import PropTypes from 'prop-types';
import React from 'react';
import SwipeableDrawer from '@material-ui/core/SwipeableDrawer';
import SyncIcon from '@material-ui/icons/Sync';
import Toolbar from '@material-ui/core/Toolbar';
import { connect } from 'react-redux';
import { openDrawer, closeDrawer, setSyncProgress } from '../../reducer/app';
import { runSync } from '../../util/sync';
import { withStyles } from '@material-ui/core/styles';
import { callAPI } from '../../util/callapi';


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
    drawerOpen: PropTypes.bool,
    openDrawer: PropTypes.func.isRequired,
    closeDrawer: PropTypes.func.isRequired,
    syncProgress: PropTypes.any,
    setSyncProgress: PropTypes.func.isRequired,
    callAPI: PropTypes.func.isRequired,
  };

  constructor(props) {
    super(props);
    this.bound = {
      handleSync: this.handleSync.bind(this),
    };
    this.state = {
      selectableProfiles: {},
    };
  }

  componentDidMount() {
    this.props.callAPI('/token/selectable').then(selectableProfiles => {
      return null;
    });
  }

  getSyncUI() {
    const { syncProgress } = this.props;
    if (syncProgress === null) {
      return {
        icon: <SyncIcon />,
        label: <span>Sync with OPN</span>,
      };
    }

    if (syncProgress < 0) {
      return {
        icon: <CircularProgress size={24} />,
        label: <span>Syncing</span>,
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
      label: <span>Syncing ({syncProgress}%)</span>,
      disabled: true,
    };
  }

  handleSync() {
    const { syncProgress } = this.props;
    if (syncProgress === null) {
      runSync(this.props.setSyncProgress);
    }
  }

  renderContent() {
    const syncUI = this.getSyncUI();
    return (<div>
      <Toolbar>
        (Profile selector here)
      </Toolbar>
      <Divider />
      <List component="nav">
        <ListItem
          button
          onClick={this.bound.handleSync}
          disabled={syncUI.disabled}
        >
          <ListItemIcon>
            {syncUI.icon}
          </ListItemIcon>
          <ListItemText primary={syncUI.label} />
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
          onOpen={this.props.openDrawer}
          onClose={this.props.closeDrawer}
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
  };
}

const dispatchToProps = {
  openDrawer,
  closeDrawer,
  setSyncProgress,
  callAPI,
};

export default withStyles(styles)(
  connect(mapStateToProps, dispatchToProps)(OPNDrawer));
