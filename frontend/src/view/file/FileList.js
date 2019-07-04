
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fetchcache } from '../../reducer/fetchcache';
import { fOPNReco, filesURL } from '../../util/fetcher';
import { isSimpleClick } from '../../util/click';
import { toggleDrawer } from '../../reducer/app';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import AppBar from '@material-ui/core/AppBar';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import CircularProgress from '@material-ui/core/CircularProgress';
import IconButton from '@material-ui/core/IconButton';
import LayoutConfig from '../app/LayoutConfig';
import MenuIcon from '@material-ui/icons/Menu';
import PropTypes from 'prop-types';
import React from 'react';
import Require from '../../util/Require';
import Tab from '@material-ui/core/Tab';
import Tabs from '@material-ui/core/Tabs';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';


const styles = {
  root: {
  },
  appbar: {
    minHeight: '100px',
    position: 'relative',
  },
  menuButton: {
    marginLeft: -12,
    marginRight: 20,
  },
  tabs: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: '100%',
  },
  content: {
    padding: '16px',
    textAlign: 'center',
  },
};


class FileList extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
    match: PropTypes.object.isRequired,
    files: PropTypes.object,
    loading: PropTypes.bool,
    loadError: PropTypes.bool,
    syncProgress: PropTypes.any,
  };

  handleToggleDrawer = () => {
    this.props.dispatch(toggleDrawer());
  }

  getTabs() {
    return [
      {
        value: 'list',
        label: 'List',
        path: '/file/list',
      },
      {
        value: 'add',
        label: 'Add',
        path: '/file/add',
      },
      {
        value: 'removed',
        label: 'Removed',
        path: '/file/removed',
      },
    ];
  }

  handleTabChange = (event, value) => {
    for (const tabinfo of this.getTabs()) {
      if (value === tabinfo.value) {
        this.props.history.push(tabinfo.path);
      }
    }
  }

  handleTabClick = (event) => {
    if (isSimpleClick(event)) {
      event.preventDefault();
    }
  }

  render() {
    const {
      classes,
      match,
      files,
      loading,
      syncProgress,
    } = this.props;

    const tab = match.params.tab || 'list';
    const handleTabClick = this.handleTabClick;

    const tabs = (
      <Tabs
        className={classes.tabs}
        value={tab}
        variant="scrollable"
        scrollButtons="auto"
        onChange={this.handleTabChange}
      >
        {this.getTabs().map(tabinfo => (
          <Tab
            key={tabinfo.value}
            value={tabinfo.value}
            label={tabinfo.label}
            href={tabinfo.path}
            onClick={handleTabClick} />
        ))}
      </Tabs>
    );

    let tabContent;

    if (files) {
      tabContent = '';  // <FileTabContent tab={tab} file={file} />;

    } else if (loading || syncProgress !== null) {
      tabContent = (
        <div className={classes.content}>
          <CircularProgress size={24} className={classes.waitSpinner}/>
        </div>
      );
    } else {
      tabContent = (
        <div className={classes.content}>
          <Card className={classes.card}>
            <CardContent>
              <Typography variant="h6" component="p">
                Unable to load the list of files.
              </Typography>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className={classes.root}>
        <Require fetcher={fOPNReco} urls={[filesURL]} />
        <LayoutConfig title="Files" />

        <AppBar position="static" classes={{root: classes.appbar}}>
          <Toolbar>
            <IconButton
              className={classes.menuButton}
              color="inherit"
              aria-label="Menu"
              onClick={this.handleToggleDrawer}
            >
              <MenuIcon />
            </IconButton>

            <Typography variant="h6" color="inherit" className={classes.title}>
              Files
            </Typography>
          </Toolbar>

          {tabs}

        </AppBar>

        {tabContent}
      </div>
    );
  }
}


function mapStateToProps(state) {
  const files = fetchcache.get(state, filesURL);
  const loading = fetchcache.fetching(state, filesURL);
  const loadError = !!fetchcache.getError(state, filesURL);

  return {
    files,
    syncProgress: state.app.syncProgress,
    loading,
    loadError,
  };
}


export default compose(
  withStyles(styles),
  withRouter,
  connect(mapStateToProps),
)(FileList);
