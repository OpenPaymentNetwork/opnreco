import { binder } from '../../util/binder';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPNReport } from '../../util/fetcher';
import { fetchcache } from '../../reducer/fetchcache';
import { withStyles } from '@material-ui/core/styles';
import CircularProgress from '@material-ui/core/CircularProgress';
import Paper from '@material-ui/core/Paper';
import PropTypes from 'prop-types';
import React from 'react';
import Require from '../../util/Require';


const styles = {
  root: {
  },
  tablePaper: {
    margin: '16px auto',
    maxWidth: 800,
  },
  table: {
    width: '100%',
  },
};


class RecoReport extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    recoReportURL: PropTypes.string,
    recoReport: PropTypes.object,
    loading: PropTypes.bool,
    file: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
  }

  render() {
    const {classes, recoReportURL, recoReport, loading, file} = this.props;
    if (!recoReportURL) {
      // No account selected.
      return null;
    }

    const require = <Require fetcher={fOPNReport} urls={[recoReportURL]} />;

    if (!recoReport) {
      if (loading) {
        return (
          <div className={classes.root}>
            {require}
            <CircularProgress />
          </div>);
      }
      return <div className={classes.root}>{require}</div>;
    }

    const {mirror} = recoReport;
    if (!mirror) {
      return 'No account data found';
    }

    let file_date;
    if (file) {
      file_date = file.end_date;
    } else {
      file_date = (new Date()).toLocaleDateString() + ' (unclosed)';
    }

    return (
      <div className={classes.root}>
        {require}
        <Paper className={classes.tablePaper}>
          <table className={classes.table}>
            <thead>
              <tr>
                <th colSpan="4">
                  {mirror.target_title} Reconciliation Report -
                  {' '}{mirror.currency}
                  {' '}{mirror.loop_id === '0' ? 'Open Loop' : mirror.loop_title}
                  {' - '}{file_date}
                </th>
              </tr>
            </thead>
          </table>
        </Paper>
        <div style={{height: 1}}></div>
      </div>
    );
  }

}

function mapStateToProps(state, ownProps) {
  const {account, file} = ownProps;
  if (account) {
    const recoReportURL = fOPNReport.pathToURL(
      `/reco-report/${account.target_id}/${account.loop_id}/` +
      `${account.currency}/${file ? file.id : ''}`);
    const recoReport = fetchcache.get(state, recoReportURL);
    const loading = fetchcache.fetching(state, recoReportURL);
    const loadError = !!fetchcache.getError(state, recoReportURL);
    return {
      recoReportURL,
      recoReport,
      loading,
      loadError,
    };
  } else {
    return {};
  }
}


export default compose(
  withStyles(styles),
  connect(mapStateToProps),
)(RecoReport);
