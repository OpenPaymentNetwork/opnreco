import { binder, binder1 } from '../../util/binder';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPNReport } from '../../util/fetcher';
import { fetchcache } from '../../reducer/fetchcache';
import { getCurrencyFormatter } from '../../util/currency';
import { setTransferId } from '../../reducer/app';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import CircularProgress from '@material-ui/core/CircularProgress';
import Paper from '@material-ui/core/Paper';
import PropTypes from 'prop-types';
import React from 'react';
import Require from '../../util/Require';
import TransactionReportForm from './TransactionReportForm';
import Typography from '@material-ui/core/Typography';
import { wfTypeTitles, dashed } from '../../util/transferfmt';


const tableWidth = 800;


const styles = {
  root: {
    fontSize: '1.0rem',
    padding: '0 16px',
  },
  formPaper: {
    margin: '16px auto',
    maxWidth: tableWidth - 16,
    padding: '8px',
  },
  tablePaper: {
    margin: '16px auto',
    maxWidth: tableWidth,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    color: '#000',
  },
  cell: {
    border: '1px solid #bbb',
  },
  headCell: {
    padding: '4px 8px',
    fontWeight: 'normal',
    backgroundColor: '#ddd',
  },
  amountCell: {
    textAlign: 'right',
    padding: '4px 8px',
  },
};


class TransactionReport extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
    reportURL: PropTypes.string,
    report: PropTypes.object,
    loading: PropTypes.bool,
    file: PropTypes.object,
    shownRecoTypes: PropTypes.object,
    rowsPerPage: PropTypes.number,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
    this.binder1 = binder1(this);
  }

  handleClickTransfer(tid, event) {
    if (event.button === 0) {
      event.preventDefault();
      this.props.dispatch(setTransferId(tid));
      this.props.history.push(`/t/${tid}`);
    }
  }

  render() {
    const {classes, reportURL, report, loading, file} = this.props;
    if (!reportURL || !file) {
      // No peer loop or file selected.
      return null;
    }

    let content;

    if (report) {
      let fileDate;
      if (file.end_date) {
        fileDate = file.end_date;
      } else {
        fileDate = (new Date()).toLocaleDateString() + ' (current)';
      }

      const {peer_title, currency} = file;

      content = (
        <Paper className={classes.tablePaper}>
          <table className={classes.table}>
            <thead>
              <tr>
                <th className={`${classes.cell} ${classes.headCell}`}
                  colSpan="2"
                >
                  {peer_title} Transaction Report
                  <div>
                    {currency}
                    {' '}{file.loop_id === '0' ? 'Open Loop' : file.loop_title}
                    {' - '}{fileDate}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
            </tbody>
          </table>
        </Paper>
      );

    } else {
      if (loading) {
        content = (
          <Paper className={classes.tablePaper} style={{textAlign: 'center'}}>
            <CircularProgress style={{padding: '16px'}} />
          </Paper>
        );
      } else {
        content = null;
      }
    }

    return (
      <Typography className={classes.root} component="div">
        <Require fetcher={fOPNReport} urls={[reportURL]} />
        <Paper className={classes.formPaper}>
          <TransactionReportForm />
        </Paper>
        {content}
        <div style={{height: 1}}></div>
      </Typography>
    );
  }

}

function mapStateToProps(state, ownProps) {
  const {ploop, file} = ownProps;

  if (ploop) {
    const {
      shownRecoTypes,
      rowsPerPage,
      pageIndex,
    } = state.report;

    const recoTypesList = [];
    Object.keys(shownRecoTypes).forEach((key) => {
      if (shownRecoTypes[key]) {
        recoTypesList.push(key);
      }
    });
    recoTypesList.sort();
    const recoTypesStr = recoTypesList.join(' ');

    const reportURL = fOPNReport.pathToURL(
      `/transactions?ploop_key=${encodeURIComponent(ploop.ploop_key)}` +
      `&file_id=${encodeURIComponent(file ? file.file_id : 'current')}` +
      `&offset=${encodeURIComponent(pageIndex * rowsPerPage)}` +
      `&limit=${encodeURIComponent(rowsPerPage)}` +
      `&reco_types=${encodeURIComponent(recoTypesStr)}`);
    const report = fetchcache.get(state, reportURL);
    const loading = fetchcache.fetching(state, reportURL);
    const loadError = !!fetchcache.getError(state, reportURL);

    return {
      reportURL,
      report,
      loading,
      loadError,
      shownRecoTypes,
      rowsPerPage,
      pageIndex,
    };
  } else {
    return {};
  }
}


export default compose(
  withStyles(styles),
  withRouter,
  connect(mapStateToProps),
)(TransactionReport);
