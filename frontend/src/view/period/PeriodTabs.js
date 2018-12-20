
import { binder } from '../../util/binder';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fetchcache } from '../../reducer/fetchcache';
import { fOPNReco, ploopsURL } from '../../util/fetcher';
import { injectIntl, intlShape } from 'react-intl';
import { renderPeriodDateString } from '../../util/reportrender';
import { toggleDrawer } from '../../reducer/app';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import CircularProgress from '@material-ui/core/CircularProgress';
import Hidden from '@material-ui/core/Hidden';
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


const styles = theme => ({
  root: {
  },
  topLine: {
    [theme.breakpoints.up('md')]: {
      display: 'flex',
      alignItems: 'flex-end',
    },
    backgroundColor: theme.palette.primary.main,
    color: '#fff',
    paddingLeft: 32,
    minHeight: '94px',
    position: 'relative',
  },
  periodSelectorBox: {
    padding: 16,
  },
  tabs: {
    flexGrow: '1',
  },
  menuButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    color: '#fff',
  },
  waitContainer: {
    padding: '16px',
    textAlign: 'center',
  },
});


class PeriodTabs extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    defaultPloop: PropTypes.string,
    dispatch: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
    intl: intlShape.isRequired,
    match: PropTypes.object.isRequired,
    period: PropTypes.object,
    periodId: PropTypes.string,
    ploop: PropTypes.object,
    ploops: PropTypes.object,
    ploopOrder: PropTypes.array,
    ploopsURLMod: PropTypes.string.isRequired,
    loading: PropTypes.bool,
    loadError: PropTypes.bool,
    syncProgress: PropTypes.any,
    transferId: PropTypes.string,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
  }

  componentDidMount() {
    this.fixURL();
  }

  componentDidUpdate() {
    this.fixURL();
  }

  handleToggleDrawer() {
    this.props.dispatch(toggleDrawer());
  }

  fixURL() {
    let {period, ploop} = this.props;
    if (period && ploop) {
      // The URL is good.
      return;
    }

    const {
      ploopOrder,
      defaultPloop,
      ploops,
    } = this.props;

    if (!ploopOrder || !ploopOrder.length) {
      // The ploops aren't loaded yet or the owner has no available ploops.
      return;
    }

    if (!ploop) {
      // Fall back to the default ploop.
      if (defaultPloop) {
        ploop = ploops[defaultPloop];
      }
    }

    if (ploop.period_order && ploop.period_order.length) {
      period = ploop.periods[ploop.period_order[0]];
    }

    if (period) {
      // Found a default period.
      // Redirect to the current tab in the default period.
      this.redirectToPeriod(period.id);
    }
  }

  redirectToPeriod(periodId) {
    let path = null;

    if (periodId === 'periods') {
      // Redirect to the period list for the current ploop.
      const {ploop} = this.props;
      path = `/periods/${encodeURIComponent(ploop.ploop_key)}`;

    } else {
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
    }

    if (path) {
      window.setTimeout(() => {
        this.props.history.push(path);
      }, 0);
    }
  }

  getTabs(periodId) {
    if (!periodId) {
      periodId = this.props.periodId;
    }

    const {transferId} = this.props;
    const encPeriodId = encodeURIComponent(periodId);
    const transferPath = (transferId ?
      `/period/${encPeriodId}/t/${encodeURIComponent(transferId)}` :
      `/period/${encPeriodId}/t`);

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
        value: 'overview',
        label: 'Period',
        path: `/period/${encPeriodId}/overview`,
        titlePart: 'Period Overview',
      },
    ];
  }

  handleTabChange(event, value) {
    for (const tabinfo of this.getTabs()) {
      if (value === tabinfo.value) {
        this.props.history.push(tabinfo.path);
      }
    }
  }

  handleTabClick(event) {
    if (event.button === 0) {
      event.preventDefault();
    }
  }

  render() {
    const {
      classes,
      period,
      match,
      ploop,
      ploops,
      ploopsURLMod,
      ploopOrder,
      loading,
      loadError,
      syncProgress,
      intl,
    } = this.props;

    const tab = match.params.tab || 'reco';
    const handleTabClick = this.binder(this.handleTabClick);
    const titleParts = [];

    const tabs = (
      <Tabs
        className={classes.tabs}
        value={tab}
        scrollable
        scrollButtons="auto"
        onChange={this.binder(this.handleTabChange)}
      >
        {this.getTabs().map(tabinfo => {
          if (tabinfo.value === tab) {
            titleParts.push(tabinfo.titlePart || tabinfo.label);
          }
          return (
            <Tab
              key={tabinfo.value}
              value={tabinfo.value}
              label={tabinfo.label}
              href={tabinfo.path}
              onClick={handleTabClick} />
          );
        })}
      </Tabs>
    );

    const selectorBox = (
      <div className={classes.periodSelectorBox}>
        <PeriodSelector
          period={period}
          ploop={ploop}
          ploops={ploops}
          ploopOrder={ploopOrder}
          loading={loading}
          loadError={loadError}
          syncProgress={syncProgress}
          redirectToPeriod={this.binder(this.redirectToPeriod)}
          />
      </div>
    );

    let tabContent;

    if (ploop && period) {
      tabContent = <PeriodTabContent tab={tab} ploop={ploop} period={period} />;

      let peerType;
      if (ploop.peer_id === 'c') {
        peerType = 'Circulation';
      } else if (ploop.peer_is_dfi_account) {
        peerType = 'DFI Account';
      } else {
        peerType = 'Wallet';
      }

      titleParts.push('-');
      titleParts.push(renderPeriodDateString(period, intl));
      titleParts.push('-');
      titleParts.push(ploop.peer_title);
      titleParts.push(`(${peerType})`);
      titleParts.push('-');
      titleParts.push(ploop.currency);
      titleParts.push(
        ploop.loop_id === '0' ? 'Open Loop' : ploop.loop_title);

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
        <Require fetcher={fOPNReco} urls={[ploopsURL, ploopsURLMod]} />
        <LayoutConfig title={titleParts.join(' ')} />

        <div className={classes.topLine}>

          <IconButton
            className={classes.menuButton}
            color="inherit"
            aria-label="Menu"
            onClick={this.binder(this.handleToggleDrawer)}
          >
            <MenuIcon />
          </IconButton>

          <Hidden mdUp>
            {selectorBox}
            {tabs}
          </Hidden>

          <Hidden smDown>
            {tabs}
            {selectorBox}
          </Hidden>

        </div>

        {tabContent}
      </div>
    );
  }
}


function mapStateToProps(state, ownProps) {
  let ploop = null;
  let period = null;
  const periodId = ownProps.match.params.periodId;

  // Unlike ploopsURL, ploopsURLMod ensures the selected period is
  // included in the period selector (if it's available.)
  const ploopsURLMod = (
    ploopsURL + `?period_id=${encodeURIComponent(periodId)}`);

  const fetched = (
    fetchcache.get(state, ploopsURLMod) ||
    fetchcache.get(state, ploopsURL) ||
    {});
  if (fetched.ploop_order && fetched.ploop_order.length) {
    let ploopKey;
    ploopKey = fetched.ploop_keys[periodId];
    if (ploopKey) {
      ploop = fetched.ploops[ploopKey];
      if (ploop && ploop.periods) {
        period = ploop.periods[periodId];
      }
    }
  }
  const loading = fetchcache.fetching(state, ploopsURL);
  const loadError = !!fetchcache.getError(state, ploopsURL);

  return {
    periodId,
    ploopsURLMod,
    ploops: fetched.ploops,
    ploopOrder: fetched.ploop_order,
    defaultPloop: fetched.default_ploop,
    ploop,
    period,
    transferId: state.app.transferId,
    syncProgress: state.app.syncProgress,
    loading,
    loadError,
  };
}


export default compose(
  withStyles(styles, {withTheme: true}),
  withRouter,
  injectIntl,
  connect(mapStateToProps),
)(PeriodTabs);
