
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fetchcache } from '../../reducer/fetchcache';
import { fOPNReco } from '../../util/fetcher';
import { isSimpleClick } from '../../util/click';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import CircularProgress from '@material-ui/core/CircularProgress';
import Paper from '@material-ui/core/Paper';
import PropTypes from 'prop-types';
import React from 'react';
import Require from '../../util/Require';
import Typography from '@material-ui/core/Typography';


const tableWidth = 800;

const styles = {
  content: {
    padding: '16px',
    textAlign: 'center',
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
  },
  headCell: {
    border: '1px solid #bbb',
    padding: '4px 8px',
    backgroundColor: '#eee',
    textAlign: 'left',
  },
  fileRow: {
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: '#eee',
    },
  },
  cell: {
    border: '1px solid #bbb',
  },
  cellLink: {
    color: '#000',
    display: 'block',
    textDecoration: 'none',
    padding: '4px 8px',
  },
  cellLinkArchived: {
    color: '#000',
    display: 'block',
    textDecoration: 'line-through',
    padding: '4px 8px',
  },
};


class FileList extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    contentURL: PropTypes.string.isRequired,
    dispatch: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
    content: PropTypes.object,
    loading: PropTypes.bool,
  };

  handleClickAnchor = (event, path) => {
    if (isSimpleClick(event)) {
      event.preventDefault();
      this.props.history.push(path);
    }
  }

  render() {
    const {
      classes,
      content,
      contentURL,
      loading,
    } = this.props;

    const rows = [];

    const requirements = (
        <Require fetcher={fOPNReco} urls={[contentURL]} />);

    if (!content) {
      if (loading) {
        return (
          <div className={classes.content}>
            {requirements}
            <CircularProgress size={24} className={classes.waitSpinner}/>
          </div>
        );
      } else {
        return (
          <div className={classes.content}>
            {requirements}
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
    }

    for (const fileId of content.file_order) {
      const file = content.files[fileId];
      const filePath = `/file/${encodeURIComponent(fileId)}`;

      const handleClickFile = (event) => {
        this.handleClickAnchor(event, filePath);
      };

      const linkClass = (
        file.archived ? classes.cellLinkArchived : classes.cellLink);

      rows.push(<tr className={classes.fileRow} key={fileId}>
        <td className={classes.cell}>
          <a className={linkClass} href={filePath} onClick={handleClickFile}>
            {file.title}
          </a>
        </td>
        <td className={classes.cell}>
          <a className={classes.cellLink} href={filePath} onClick={handleClickFile}>
            {file.open_period_count}
          </a>
        </td>
        <td className={classes.cell}>
          <a className={classes.cellLink} href={filePath} onClick={handleClickFile}>
            {file.closed_period_count}
          </a>
        </td>
      </tr>);
    }

    return (
      <Paper className={classes.tablePaper}>
        {requirements}
        <table className={classes.table}>
          <thead>
            <tr>
              <th className={classes.titleCell} colSpan="3">
                Files
              </th>
            </tr>
            <tr>
              <th width="60%" className={classes.headCell}>Title</th>
              <th width="20%" className={classes.headCell}>Open Periods</th>
              <th width="20%" className={classes.headCell}>Closed Periods</th>
            </tr>
          </thead>
          <tbody>
            {rows}
          </tbody>
        </table>
      </Paper>
    );

  }

}


function mapStateToProps(state, ownProps) {
  const contentURL = ownProps.contentURL;
  const content = fetchcache.get(state, contentURL);
  const loading = fetchcache.fetching(state, contentURL);

  return {
    content,
    contentURL,
    loading,
  };
}


export default compose(
  withStyles(styles),
  withRouter,
  connect(mapStateToProps),
)(FileList);
