import { binder } from '../../util/binder';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fetchcache } from '../../reducer/fetchcache';
import { fOPNReco } from '../../util/fetcher';
import { toggleDrawer } from '../../reducer/app';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import CircularProgress from '@material-ui/core/CircularProgress';
import Hidden from '@material-ui/core/Hidden';
import IconButton from '@material-ui/core/IconButton';
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


const ploopsURL = fOPNReco.pathToURL('/ploops');


class PeriodTabs extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
    match: PropTypes.object.isRequired,
    ploop: PropTypes.object,
    period: PropTypes.object,
    periodId: PropTypes.string.isRequired,
    transferId: PropTypes.string,
    ploopsLoaded: PropTypes.bool,
    syncing: PropTypes.bool,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
  }

  handleToggleDrawer() {
    this.props.dispatch(toggleDrawer());
  }

  getTabs() {
    const {periodId, transferId} = this.props;
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
      },
      {
        value: 'overview',
        label: 'Period',
        path: `/period/${encPeriodId}/overview`,
      },
    ];
  }

  handleTabChange(event, value) {
    this.getTabs().forEach(tabinfo => {
      if (value === tabinfo.value) {
        this.props.history.push(tabinfo.path);
      }
    });
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
      ploopsLoaded,
      syncing,
    } = this.props;

    const tab = match.params.tab || 'reco';
    const handleTabClick = this.binder(this.handleTabClick);

    const tabs = (
      <Tabs
        className={classes.tabs}
        value={tab}
        scrollable
        scrollButtons="auto"
        onChange={this.binder(this.handleTabChange)}
      >
        {this.getTabs().map(tabinfo => (
          <Tab
            key={tabinfo.value}
            value={tabinfo.value}
            label={tabinfo.label}
            href={tabinfo.path}
            onClick={handleTabClick} />))}
      </Tabs>
    );

    const filterBox = (
      <div className={classes.periodSelectorBox}>
        <PeriodSelector ploop={ploop} period={period} path={match.path} />
      </div>
    );

    let tabContent;

    if (ploop && period) {
      tabContent = <PeriodTabContent tab={tab} ploop={ploop} period={period} />;
    } else if (!ploopsLoaded || syncing) {
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
        <Require fetcher={fOPNReco} urls={[ploopsURL]} />

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
            {filterBox}
            {tabs}
          </Hidden>

          <Hidden smDown>
            {tabs}
            {filterBox}
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
  let periodId = ownProps.match.params.periodId;

  const fetched = fetchcache.get(state, ploopsURL);
  if (fetched && fetched.ploop_order.length) {
    let ploopKey;
    ploopKey = fetched.ploop_keys[periodId];
    if (ploopKey) {
      ploop = fetched.ploops[ploopKey];
      if (ploop && ploop.periods) {
        period = ploop.periods[periodId];
      }
    }
    if (!ploop) {
      // Fall back to the default ploop.
      if (fetched.default_ploop) {
        ploop = fetched.ploops[fetched.default_ploop];
      }
    }

    if (!period && ploop.period_order && ploop.period_order.length) {
      period = ploop.periods[ploop.period_order[0]];
    }

    if (period) {
      periodId = period.id;
    }
  }

  return {
    periodId,
    ploop,
    period,
    transferId: state.app.transferId,
    ploopsLoaded: !!fetchcache.get(state, ploopsURL),
    syncing: state.app.syncProgress !== null,
  };
}


export default compose(
  withStyles(styles, {withTheme: true}),
  withRouter,
  connect(mapStateToProps),
)(PeriodTabs);
