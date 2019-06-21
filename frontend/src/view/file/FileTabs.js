
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fetchcache } from '../../reducer/fetchcache';
import { fOPNReco } from '../../util/fetcher';
import { isSimpleClick } from '../../util/click';
import { toggleDrawer } from '../../reducer/app';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import CircularProgress from '@material-ui/core/CircularProgress';
import FileTabContent from './FileTabContent';
import IconButton from '@material-ui/core/IconButton';
import LayoutConfig from '../app/LayoutConfig';
import MenuIcon from '@material-ui/icons/Menu';
import PropTypes from 'prop-types';
import React from 'react';
import Require from '../../util/Require';
import Tab from '@material-ui/core/Tab';
import Tabs from '@material-ui/core/Tabs';
import Typography from '@material-ui/core/Typography';


const styles = theme => ({
  root: {
  },
  appbar: {
    backgroundColor: theme.palette.primary.main,
    color: '#fff',
    paddingLeft: 32,
    minHeight: '100px',
    position: 'relative',
  },
  menuButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    color: '#fff',
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
});


class FileTabs extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
    match: PropTypes.object.isRequired,
    file: PropTypes.object,
    fileURL: PropTypes.string.isRequired,
    loading: PropTypes.bool,
    loadError: PropTypes.bool,
    syncProgress: PropTypes.any,
  };

  handleToggleDrawer = () => {
    this.props.dispatch(toggleDrawer());
  }

  getTabs(fileId) {

    const encFileId = encodeURIComponent(fileId);

    return [
      {
        value: 'edit',
        label: 'Edit',
        path: `/file/${encFileId}/edit`,
      },
      {
        value: 'rules',
        label: 'Rules',
        path: `/file/${encFileId}/rules`,
      },
      {
        value: 'periods',
        label: 'Periods',
        path: `/file/${encFileId}/periods`,
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
      file,
      fileURL,
      loading,
      syncProgress,
    } = this.props;

    const tab = match.params.tab || 'edit';
    const handleTabClick = this.handleTabClick;
    const titleParts = [];

    const displayTabs = [];
    for (const tabinfo of this.getTabs()) {
      if (tabinfo.value === tab) {
        titleParts.push(tabinfo.titlePart || tabinfo.label);
      }
      if (!tabinfo.invisible) {
        displayTabs.push(tabinfo);
      }
    }

    const tabs = (
      <Tabs
        className={classes.tabs}
        value={tab}
        variant="scrollable"
        scrollButtons="auto"
        onChange={this.handleTabChange}
      >
        {displayTabs.map(tabinfo => (
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

    if (file) {
      tabContent = <FileTabContent tab={tab} file={file} />;

      titleParts.push('-');
      titleParts.push(file.title);
      titleParts.push('-');
      titleParts.push(file.currency);

    } else if (loading || syncProgress !== null) {
      tabContent = (
        <div className={classes.content}>
          <CircularProgress size={24} className={classes.waitSpinner}/>
        </div>
      );
    } else {
      // Not loading and the file is not available.
      tabContent = (
        <div className={classes.content}>
          <Card className={classes.card}>
            <CardContent>
              <Typography variant="h6" component="p">
                Unable to load the file.
              </Typography>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className={classes.root}>
        <Require fetcher={fOPNReco} urls={[fileURL]} />
        <LayoutConfig title={titleParts.join(' ')} />

        <div className={classes.appbar}>

          <IconButton
            className={classes.menuButton}
            color="inherit"
            aria-label="Menu"
            onClick={this.handleToggleDrawer}
          >
            <MenuIcon />
          </IconButton>

          {tabs}

        </div>

        {tabContent}
      </div>
    );
  }
}


function mapStateToProps(state, ownProps) {
  const fileId = ownProps.match.params.fileId;
  const fileURL = fOPNReco.pathToURL(`/file/${encodeURIComponent(fileId)}`);
  const file = fetchcache.get(fileURL);
  const loading = fetchcache.fetching(state, fileURL);
  const loadError = !!fetchcache.getError(state, fileURL);

  return {
    fileId,
    fileURL,
    file,
    syncProgress: state.app.syncProgress,
    loading,
    loadError,
  };
}


export default compose(
  withStyles(styles, {withTheme: true}),
  withRouter,
  connect(mapStateToProps),
)(FileTabs);
