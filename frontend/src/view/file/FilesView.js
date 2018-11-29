import { binder, binder1 } from '../../util/binder';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPNReport } from '../../util/fetcher';
import { fetchcache } from '../../reducer/fetchcache';
import { getCurrencyFormatter } from '../../util/currency';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import CircularProgress from '@material-ui/core/CircularProgress';
import LayoutConfig from '../app/LayoutConfig';
import Pager from '../../util/Pager';
import Paper from '@material-ui/core/Paper';
import PropTypes from 'prop-types';
import React from 'react';
import Require from '../../util/Require';
import Typography from '@material-ui/core/Typography';


const tableWidth = 800;


const styles = {
  root: {
    fontSize: '0.9rem',
    padding: '0 16px',
  },
  pagerPaper: {
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
    border: '1px solid #bbb',
    padding: '4px 8px',
    fontWeight: 'normal',
    backgroundColor: '#ddd',
  },
  amountCell: {
    border: '1px solid #bbb',
    textAlign: 'right',
    padding: '4px 8px',
  },
};


class FilesView extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
    contentURL: PropTypes.string,
    content: PropTypes.object,
    loading: PropTypes.bool,
    ploop: PropTypes.object,
    pagerName: PropTypes.string.isRequired,
    initialRowsPerPage: PropTypes.number.isRequired,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
    this.binder1 = binder1(this);
  }

  render() {
    const {
      classes,
      contentURL,
      content,
      loading,
      ploop,
      pagerName,
      initialRowsPerPage,
    } = this.props;
    if (!contentURL) {
      // No peer loop selected.
      return null;
    }

    const require = (
      <div>
        <LayoutConfig title="Files" />
        <Require fetcher={fOPNReport} urls={[contentURL]} />
      </div>);

    if (!content) {
      if (loading) {
        return (
          <div className={classes.root}>
            {require}
            <Paper className={classes.tablePaper}
              style={{textAlign: 'center', }}
            >
              <CircularProgress style={{padding: '16px'}} />
            </Paper>
            <div style={{height: 1}}></div>
          </div>);
      }
      return <div className={classes.root}>{require}</div>;
    }

    const {
      rowcount,
    } = content;

    const {currency, loop_id} = ploop;
    const cfmt = new getCurrencyFormatter(currency);

    let headRow0, headRow1, columnCount;
    if (ploop.peer_id === 'c') {
      columnCount = 7;
      headRow0 = (
        <tr>
          <td colSpan="2" className={classes.headRow0}>Date</td>
          <td colSpan="1" className={classes.headRow0}>Status</td>
          <td colSpan="2" className={classes.headRow0}>Circulation</td>
          <td colSpan="2" className={classes.headRow0}>Surplus</td>
        </tr>
      );
      headRow1 = (
        <tr>
          <td className={classes.headRow1Left}>Start</td>
          <td className={classes.headRow1Right}>End</td>
          <td className={classes.headRow1Single}></td>
          <td className={classes.headRow1Left}>Start</td>
          <td className={classes.headRow1Right}>End</td>
          <td className={classes.headRow1Left}>Start</td>
          <td className={classes.headRow1Right}>End</td>
        </tr>
      );

    } else {
      columnCount = 5;
      headRow0 = (
        <tr>
          <td colSpan="2" className={classes.headRow0}>Date</td>
          <td colSpan="1" className={classes.headRow0}>Status</td>
          <td colSpan="2" className={classes.headRow0}>Balance</td>
        </tr>
      );
      headRow1 = (
        <tr>
          <td className={classes.headRow1Left}>Start</td>
          <td className={classes.headRow1Right}>End</td>
          <td className={classes.headRow1Single}></td>
          <td className={classes.headRow1Left}>Start</td>
          <td className={classes.headRow1Right}>End</td>
        </tr>
      );
    }

    return (
      <Typography className={classes.root} component="div">
        {require}
        <Paper className={classes.pagerPaper}>
          <Pager
            name={pagerName}
            initialRowsPerPage={initialRowsPerPage}
            rowcount={rowcount} />
        </Paper>
        <Paper className={classes.tablePaper}>
          <table className={classes.table}>
            <thead>
              <tr>
                <th className={classes.headCell}
                    colSpan={columnCount}>
                  {ploop.peer_title} Reconciliation Files
                  <div>
                    {currency}
                    {' '}{loop_id === '0' ? 'Open Loop' : ploop.loop_title}
                  </div>
                </th>
              </tr>
              {headRow0}
              {headRow1}
            </thead>
            <tbody>
            </tbody>
          </table>
        </Paper>
        <div style={{height: 1}}></div>
      </Typography>
    );
  }

}


function mapStateToProps(state, ownProps) {
  const pagerName = 'fileList';
  const initialRowsPerPage = 10;
  const {ploop} = ownProps;
  const pagerState = state.pager[pagerName] || {
    rowsPerPage: initialRowsPerPage,
    pageIndex: 0,
  };
  const {rowsPerPage, pageIndex} = pagerState;

  if (ploop) {
    const contentURL = fOPNReport.pathToURL(
      `/files?ploop_key=${encodeURIComponent(ploop.ploop_key)}` +
      `&offset=${encodeURIComponent(pageIndex * rowsPerPage)}` +
      `&limit=${encodeURIComponent(rowsPerPage || 'none')}`);
    const content = fetchcache.get(state, contentURL);
    const loading = fetchcache.fetching(state, contentURL);
    const loadError = !!fetchcache.getError(state, contentURL);
    return {
      contentURL,
      content,
      loading,
      loadError,
      pagerName,
      initialRowsPerPage,
    };
  } else {
    return {
      pagerName,
      initialRowsPerPage,
    };
  }
}


export default compose(
  withStyles(styles),
  withRouter,
  connect(mapStateToProps),
)(FilesView);
