
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fetchcache } from '../../reducer/fetchcache';
import { fOPNReco, filesURL } from '../../util/fetcher';
import { injectIntl, intlShape } from 'react-intl';
import { isSimpleClick } from '../../util/click';
import { renderPeriodDateString } from '../../util/reportrender';
import { toggleDrawer } from '../../reducer/app';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import AppBar from '@material-ui/core/AppBar';
import CircularProgress from '@material-ui/core/CircularProgress';
import IconButton from '@material-ui/core/IconButton';
import LayoutConfig from '../app/LayoutConfig';
import MenuIcon from '@material-ui/icons/Menu';
import PeriodSelector from './PeriodSelector';
import PeriodTabContent from './PeriodTabContent';
import PropTypes from 'prop-types';
import React from 'react';
import Require from '../../util/Require';
import Tab from '@material-ui/core/Tab';
import Tabs from '@material-ui/core/Tabs';


const styles = {
  root: {
  },
  appbar: {
    minHeight: '100px',
    position: 'relative',
  },
  periodSelectorBox: {
    position: 'absolute',
    right: '16px',
    top: '8px',
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
  waitContainer: {
    padding: '16px',
    textAlign: 'center',
  },
};


class PeriodTabs extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    defaultFileId: PropTypes.string,
    dispatch: PropTypes.func.isRequired,
    gotAllFiles: PropTypes.bool,
    history: PropTypes.object.isRequired,
    intl: intlShape.isRequired,
    match: PropTypes.object.isRequired,
    period: PropTypes.object,
    periodId: PropTypes.string,
    file: PropTypes.object,
    files: PropTypes.object,
    fileOrder: PropTypes.array,
    filesURLMod: PropTypes.string.isRequired,
    loading: PropTypes.bool,
    loadError: PropTypes.bool,
    syncProgress: PropTypes.any,
    statementId: PropTypes.string,
    statementPeriodId: PropTypes.string,
    transferId: PropTypes.string,
  };

  componentDidMount() {
    this.fixURL();
  }

  componentDidUpdate() {
    this.fixURL();
  }

  handleToggleDrawer = () => {
    this.props.dispatch(toggleDrawer());
  }

  fixURL() {
    let {period, file} = this.props;
    if (period && file) {
      // The URL is good.
      return;
    }

    const {
      gotAllFiles,
      fileOrder,
      defaultFileId,
      files,
    } = this.props;

    if (!gotAllFiles || !fileOrder || !fileOrder.length) {
      // Not all the files are loaded yet or
      // the owner has no available files.
      return;
    }

    if (!file) {
      // Fall back to the default file.
      if (defaultFileId) {
        file = files[defaultFileId];
      }
    }

    if (file.period_order && file.period_order.length) {
      period = file.periods[file.period_order[0]];
    }

    if (period) {
      // Found a default period.
      // Redirect to the current tab in the default period.
      this.redirectToPeriod(period.id);
    }
  }

  redirectToPeriod = (periodId) => {
    let path = null;

    if (periodId) {
      // Redirect to the same tab in a different period.
      const {match} = this.props;
      const {tab} = match.params;
      const tabs = this.getTabs(periodId);
      for (const tabinfo of tabs) {
        if (tab === tabinfo.value) {
          path = tabinfo.path;
          break;
        }
      }
      if (!path) {
        path = tabs[0].path;
      }

    } else {
      // Redirect to the period list for the file.
      const {file} = this.props;
      path = `/file/${encodeURIComponent(file.id)}/periods`;
    }

    if (path) {
      window.setTimeout(() => {
        this.props.history.push(path);
      }, 0);
    }
  }

  redirectToFile = (fileId) => {
    let path = null;

    if (fileId) {
      path = `/file/${encodeURIComponent(fileId)}`;
    } else {
      path = '/file';
    }

    window.setTimeout(() => {
      this.props.history.push(path);
    }, 0);
  }

  getTabs(periodId) {
    const {statementPeriodId} = this.props;

    if (!periodId) {
      periodId = this.props.periodId;
    }

    const encPeriodId = encodeURIComponent(periodId);

    // Use the transferId in the path whenever it is set. Transfers can
    // be seen in any period.
    const {transferId} = this.props;
    const transferPath = (transferId ?
      `/period/${encPeriodId}/t/${encodeURIComponent(transferId)}` :
      `/period/${encPeriodId}/t`);

    // Use the statementId in the path only when the statementId is set and
    // the statement is for the right period.
    const {statementId} = this.props;
    const statementPath = (statementId && statementPeriodId === periodId ?
      `/period/${encPeriodId}/statement/${encodeURIComponent(statementId)}` :
      `/period/${encPeriodId}/statement`);

    return [
      {
        value: 'reco',
        label: 'Reconciliation',
        path: `/period/${encPeriodId}/reco`,
      },
      {
        value: 'transactions',
        label: 'Transactions',
        path: `/period/${encPeriodId}/transactions`,
      },
      {
        value: 't',
        label: 'Transfer',
        path: transferPath,
        titlePart: transferId ? 'Transfer ' + transferId : 'Transfer',
      },
      {
        value: 'statement',
        label: 'Statements',
        path: statementPath,
      },
      {
        value: 'overview',
        label: 'Period Overview',
        path: `/period/${encPeriodId}/overview`,
      },
      {
        value: 'internal',
        label: 'Internal Reconciliations',
        path: `/period/${encPeriodId}/internal`,
        invisible: true,
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
      period,
      match,
      file,
      files,
      filesURLMod,
      fileOrder,
      loading,
      loadError,
      syncProgress,
      intl,
    } = this.props;

    const tab = match.params.tab || 'reco';
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

    const selectorBox = (
      <div className={classes.periodSelectorBox}>
        <PeriodSelector
          period={period}
          file={file}
          files={files}
          fileOrder={fileOrder}
          loading={loading}
          loadError={loadError}
          syncProgress={syncProgress}
          redirectToFile={this.redirectToFile}
          redirectToPeriod={this.redirectToPeriod}
          />
      </div>
    );

    let tabContent;

    if (file && period) {
      tabContent = <PeriodTabContent tab={tab} file={file} period={period} />;

      titleParts.push('-');
      titleParts.push(renderPeriodDateString(period, intl));
      titleParts.push('-');
      titleParts.push(file.title);
      titleParts.push('-');
      titleParts.push(file.currency);

    } else if (loading || syncProgress !== null) {
      tabContent = (
        <div className={classes.waitContainer}>
          <CircularProgress size={24} className={classes.waitSpinner}/>
        </div>
      );
    } else {
      // Not syncing and no accounts are available for the profile owner.
      tabContent = null;
    }

    return (
      <div className={classes.root}>
        <Require fetcher={fOPNReco} urls={[filesURL, filesURLMod]} />
        <LayoutConfig title={titleParts.join(' ')} />

        <AppBar position="static" classes={{root: classes.appbar}}>

          <IconButton
            className={classes.menuButton}
            color="inherit"
            aria-label="Menu"
            onClick={this.handleToggleDrawer}
          >
            <MenuIcon />
          </IconButton>

          {selectorBox}

          {tabs}

        </AppBar>

        {tabContent}
      </div>
    );
  }
}


function mapStateToProps(state, ownProps) {
  let file = null;
  let period = null;
  const periodId = ownProps.match.params.periodId;

  // Unlike filesURL, filesURLMod ensures the selected period is
  // included in the period selector (if it's available.)
  const filesURLMod = (
    filesURL + `?period_id=${encodeURIComponent(periodId)}`);

  let gotAllFiles = false;

  let fetched = fetchcache.get(state, filesURLMod);
  if (fetched) {
    // All the files requested have been loaded.
    gotAllFiles = true;
  } else {
    fetched = fetchcache.get(state, filesURL) || {};
  }

  if (fetched.file_order && fetched.file_order.length) {
    let fileId;
    fileId = fetched.period_to_file_id[periodId];
    if (fileId) {
      file = fetched.files[fileId];
      if (file && file.periods) {
        period = file.periods[periodId];
      }
    }
  }
  const loading = fetchcache.fetching(state, filesURL);
  const loadError = !!fetchcache.getError(state, filesURL);

  return {
    periodId,
    filesURLMod,
    files: fetched.files,
    fileOrder: fetched.file_order,
    defaultFileId: fetched.default_file_id,
    file,
    period,
    statementId: state.app.statementId,
    statementPeriodId: state.app.statementPeriodId,
    transferId: state.app.transferId,
    syncProgress: state.app.syncProgress,
    loading,
    loadError,
    gotAllFiles,
  };
}


export default compose(
  withStyles(styles),
  withRouter,
  injectIntl,
  connect(mapStateToProps),
)(PeriodTabs);
