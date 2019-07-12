import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPNReco } from '../../util/fetcher';
import { fetchcache } from '../../reducer/fetchcache';
import { getPagerState } from '../../reducer/pager';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import ButtonBase from '@material-ui/core/ButtonBase';
import CircularProgress from '@material-ui/core/CircularProgress';
import CheckBox from '@material-ui/icons/CheckBox';
import CheckBoxOutlineBlank from '@material-ui/icons/CheckBoxOutlineBlank';
import Pager from '../../util/Pager';
import Paper from '@material-ui/core/Paper';
import PropTypes from 'prop-types';
import React from 'react';
import Require from '../../util/Require';
import Typography from '@material-ui/core/Typography';


const tableWidth = 800;


const styles = {
  root: {
  },
  content: {
    fontSize: '0.9rem',
  },
  pagerPaper: {
    margin: '16px auto',
    maxWidth: tableWidth,
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
  titleCell: {
    border: '1px solid #bbb',
    padding: '4px 8px',
    fontWeight: 'normal',
    backgroundColor: '#ddd',
    textAlign: 'center',
  },
  headCell: {
    border: '1px solid #bbb',
    padding: '4px 8px',
    backgroundColor: '#eee',
  },
  textCell: {
    border: '1px solid #bbb',
    padding: '4px 8px',
  },
  checkCell: {
    border: '1px solid #bbb',
    textAlign: 'center',
  },
  loopRow: {
  },
};


class FileLoopTable extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
    contentURL: PropTypes.string.isRequired,
    contentFinalURL: PropTypes.string.isRequired,
    content: PropTypes.object,
    loading: PropTypes.bool,
    file: PropTypes.object,
    pagerName: PropTypes.string.isRequired,
    initialRowsPerPage: PropTypes.number.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {};
  }

  renderTableBody() {
    const {
      classes,
      content,
    } = this.props;

    const rows = [];
    for (const loopConfig of content.loops) {
      const loop_id = loopConfig.loop_id;

      const Icon = loopConfig.enabled ? CheckBox : CheckBoxOutlineBlank;

      rows.push(
        <tr
          key={loop_id}
          data-loop-id={loop_id}
          className={classes.loopRow}
        >
          <td className={classes.textCell}>
            {loopConfig.loop && loopConfig.loop.title ? `${loopConfig.loop.title} (${loop_id})` : loop_id}
          </td>
          <td className={classes.textCell}>
            {loopConfig.issuer && loopConfig.issuer.title ? `${loopConfig.issuer.title} (${loopConfig.issuer_id})` : loopConfig.loop.issuer_id}
          </td>
          <td className={classes.checkCell}>
            <ButtonBase
              centerRipple
              onClick={(event) => this.handleEnable(event, loop_id)}
              className={classes.button}
            >
              <Icon />
            </ButtonBase>
          </td>
        </tr>
      );
    }

    return <tbody>{rows}</tbody>;
  }

  renderTable() {
    const {
      classes,
      file,
    } = this.props;

    return (
      <Paper className={classes.tablePaper}>
        <table className={classes.table}>
          <thead>
            <tr>
              <th className={classes.titleCell} colSpan="3">
                Note Designs Enabled for Reconciliation
                <div>
                  File: {file.title} ({file.currency})
                </div>
              </th>
            </tr>
            <tr>
              <td className={classes.headCell} width="30%">Note Design</td>
              <td className={classes.headCell} width="30%">Issuer</td>
              <td className={classes.headCell} width="20%">Reconciliation Enabled</td>
            </tr>
          </thead>
          {this.renderTableBody()}
        </table>
      </Paper>
    );
  }

  render() {
    const {
      classes,
      contentURL,
      contentFinalURL,
      content,
      loading,
      pagerName,
      initialRowsPerPage,
    } = this.props;

    let pageContent, rowcount;

    if (!content) {
      rowcount = null;
      if (loading) {
        pageContent = (
          <div className={classes.root}>
            <Paper className={classes.tablePaper}
              style={{textAlign: 'center', }}
            >
              <CircularProgress style={{padding: '16px'}} />
            </Paper>
            <div style={{height: 1}}></div>
          </div>);
      } else {
        pageContent = null;
      }
    } else {
      rowcount = content.rowcount;
      pageContent = this.renderTable();
    }

    return (
      <div>
        <Paper className={classes.pagerPaper}>
          <Require
            fetcher={fOPNReco}
            urls={[contentURL]}
            options={{
              finalURL: contentFinalURL,
            }} />
          <Pager
            name={pagerName}
            initialRowsPerPage={initialRowsPerPage}
            rowcount={rowcount} />
        </Paper>
        <Typography className={classes.content} component="div">
          {pageContent}
        </Typography>
        <div style={{height: 1}}></div>
      </div>
    );
  }
}


function mapStateToProps(state, ownProps) {
  const {file} = ownProps;
  const pagerName = 'FileLoopTable';
  const {
    rowsPerPage,
    pageIndex,
    initialRowsPerPage,
  } = getPagerState(state, pagerName, 100);

  const fileIdEnc = encodeURIComponent(file.id);
  const query = (
    `?offset=${encodeURIComponent(pageIndex * rowsPerPage)}` +
    `&limit=${encodeURIComponent(rowsPerPage || 'none')}`);

  const contentURL = fOPNReco.pathToURL(
    `/file/${fileIdEnc}/loops${query}`);
  const contentFinalURL = fOPNReco.pathToURL(
    `/file/${fileIdEnc}/loops-final${query}`);
  const content = fetchcache.get(state, contentURL);
  const loading = fetchcache.fetching(state, contentURL);
  const loadError = !!fetchcache.getError(state, contentURL);

  return {
    contentURL,
    contentFinalURL,
    content,
    loading,
    loadError,
    pagerName,
    initialRowsPerPage,
    file,
  };
}


export default compose(
  withStyles(styles),
  withRouter,
  connect(mapStateToProps),
)(FileLoopTable);
